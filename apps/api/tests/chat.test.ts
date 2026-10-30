import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { Role, DocVisibility, DocStatus, Prisma } from "@prisma/client";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { signAccessToken } from "../src/lib/jwt";
import {
  setLLMProvider,
  MockLLMProvider,
  parseAndCleanCitations,
  formatSourcesContext,
} from "../src/lib/llm";
import {
  setEmbeddingsProvider,
  MockEmbeddingsProvider,
  formatVectorForPg,
} from "../src/lib/embeddings";
import { chatService } from "../src/modules/ai/chat.service";
import { retrievalService, RetrievedChunk } from "../src/modules/ai/retrieval.service";

describe("AI Chat Module Tests (Task 9)", () => {
  const mockLLM = new MockLLMProvider();
  const mockEmbeddings = new MockEmbeddingsProvider();

  let hasPgVector = false;
  let deptSalesId: string;
  let deptEngineeringId: string;

  let adminUser: { id: string; role: Role; departmentId: string | null; email: string };
  let managerSales: { id: string; role: Role; departmentId: string | null; email: string };
  let employeeSales: { id: string; role: Role; departmentId: string | null; email: string };
  let employeeEngineering: { id: string; role: Role; departmentId: string | null; email: string };

  let adminToken: string;
  let managerSalesToken: string;
  let employeeSalesToken: string;
  let employeeEngineeringToken: string;

  const createdDocIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdDeptIds: string[] = [];
  const createdSessionIds: string[] = [];

  let publicDocId: string;
  let managerDocId: string;
  let salesDeptDocId: string;

  beforeAll(async () => {
    // 1. Activate Mock Providers
    setLLMProvider(mockLLM);
    setEmbeddingsProvider(mockEmbeddings);

    // 2. Create Departments
    const dept1 = await prisma.department.create({
      data: { name: `Sales Dept ${Date.now()}` },
    });
    const dept2 = await prisma.department.create({
      data: { name: `Engineering Dept ${Date.now()}` },
    });
    deptSalesId = dept1.id;
    deptEngineeringId = dept2.id;
    createdDeptIds.push(deptSalesId, deptEngineeringId);

    // 3. Create Users
    adminUser = await prisma.user.create({
      data: {
        name: "Alice Admin",
        email: `alice-admin-${Date.now()}@test.com`,
        passwordHash: "hash123",
        role: Role.ADMIN,
        departmentId: deptSalesId,
      },
    });
    createdUserIds.push(adminUser.id);
    adminToken = signAccessToken({
      sub: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    });

    managerSales = await prisma.user.create({
      data: {
        name: "Bob Manager Sales",
        email: `bob-mgr-${Date.now()}@test.com`,
        passwordHash: "hash123",
        role: Role.MANAGER,
        departmentId: deptSalesId,
      },
    });
    createdUserIds.push(managerSales.id);
    managerSalesToken = signAccessToken({
      sub: managerSales.id,
      email: managerSales.email,
      role: managerSales.role,
    });

    employeeSales = await prisma.user.create({
      data: {
        name: "Charlie Emp Sales",
        email: `charlie-sales-${Date.now()}@test.com`,
        passwordHash: "hash123",
        role: Role.EMPLOYEE,
        departmentId: deptSalesId,
      },
    });
    createdUserIds.push(employeeSales.id);
    employeeSalesToken = signAccessToken({
      sub: employeeSales.id,
      email: employeeSales.email,
      role: employeeSales.role,
    });

    employeeEngineering = await prisma.user.create({
      data: {
        name: "Dave Emp Eng",
        email: `dave-eng-${Date.now()}@test.com`,
        passwordHash: "hash123",
        role: Role.EMPLOYEE,
        departmentId: deptEngineeringId,
      },
    });
    createdUserIds.push(employeeEngineering.id);
    employeeEngineeringToken = signAccessToken({
      sub: employeeEngineering.id,
      email: employeeEngineering.email,
      role: employeeEngineering.role,
    });

    // 4. Create Documents for Retrieval Testing
    // A) Public document (ALL)
    const pubDoc = await prisma.document.create({
      data: {
        title: "Company Holiday Policy",
        fileName: "holiday-policy.pdf",
        filePath: "uploads/holiday.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        visibility: DocVisibility.ALL,
        status: DocStatus.READY,
        uploadedById: adminUser.id,
      },
    });
    publicDocId = pubDoc.id;
    createdDocIds.push(publicDocId);

    const chunk1 = await prisma.documentChunk.create({
      data: {
        documentId: publicDocId,
        chunkIndex: 0,
        pageNumber: 1,
        content: "Employees receive 25 days of paid annual vacation leave each calendar year.",
        tokenCount: 15,
      },
    });

    // B) Manager only document
    const mgrDoc = await prisma.document.create({
      data: {
        title: "Executive Compensation Review",
        fileName: "exec-comp.pdf",
        filePath: "uploads/exec.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        visibility: DocVisibility.MANAGERS,
        status: DocStatus.READY,
        uploadedById: adminUser.id,
      },
    });
    managerDocId = mgrDoc.id;
    createdDocIds.push(managerDocId);

    const chunk2 = await prisma.documentChunk.create({
      data: {
        documentId: managerDocId,
        chunkIndex: 0,
        pageNumber: 3,
        content: "Executive performance bonuses are calculated at 30% of base salary based on EBITDA.",
        tokenCount: 16,
      },
    });

    // C) Sales department document
    const salesDoc = await prisma.document.create({
      data: {
        title: "Sales Commission Structure",
        fileName: "commission.pdf",
        filePath: "uploads/commission.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1500,
        visibility: DocVisibility.DEPARTMENT,
        departmentId: deptSalesId,
        status: DocStatus.READY,
        uploadedById: managerSales.id,
      },
    });
    salesDeptDocId = salesDoc.id;
    createdDocIds.push(salesDeptDocId);

    const chunk3 = await prisma.documentChunk.create({
      data: {
        documentId: salesDeptDocId,
        chunkIndex: 0,
        pageNumber: 2,
        content: "Sales team members earn 12% commission on all new enterprise subscription contracts.",
        tokenCount: 14,
      },
    });

    const chunkVectors = new Map<string, number[]>();
    const vec1 = mockEmbeddings.generateDeterministicVector(chunk1.content);
    const vec2 = mockEmbeddings.generateDeterministicVector(chunk2.content);
    const vec3 = mockEmbeddings.generateDeterministicVector(chunk3.content);
    chunkVectors.set(chunk1.id, vec1);
    chunkVectors.set(chunk2.id, vec2);
    chunkVectors.set(chunk3.id, vec3);

    // Populate vector embeddings if pgvector is available
    try {
      const ext = await prisma.$queryRaw<Array<{ extname: string }>>(
        Prisma.sql`SELECT extname FROM pg_extension WHERE extname = 'vector'`
      );
      hasPgVector = ext && ext.length > 0;
    } catch {
      hasPgVector = false;
    }

    if (hasPgVector) {
      try {
        const v1 = formatVectorForPg(vec1);
        const v2 = formatVectorForPg(vec2);
        const v3 = formatVectorForPg(vec3);

        await prisma.$executeRaw(
          Prisma.sql`UPDATE "DocumentChunk" SET "embedding" = ${v1}::vector WHERE "id" = ${chunk1.id}`
        );
        await prisma.$executeRaw(
          Prisma.sql`UPDATE "DocumentChunk" SET "embedding" = ${v2}::vector WHERE "id" = ${chunk2.id}`
        );
        await prisma.$executeRaw(
          Prisma.sql`UPDATE "DocumentChunk" SET "embedding" = ${v3}::vector WHERE "id" = ${chunk3.id}`
        );
      } catch {
        hasPgVector = false;
      }
    }

    if (!hasPgVector) {
      vi.spyOn(retrievalService, "searchVectors").mockImplementation(
        async (_questionVector, user, limit = 8) => {
          const docs = await prisma.document.findMany({
            where: {
              id: { in: createdDocIds },
              status: DocStatus.READY,
              OR: [
                ...(user.role === Role.ADMIN ? [{}] : []),
                ...(user.role === Role.MANAGER
                  ? [
                      { visibility: DocVisibility.ALL },
                      { visibility: DocVisibility.MANAGERS },
                    ]
                  : []),
                ...(user.role === Role.EMPLOYEE
                  ? [{ visibility: DocVisibility.ALL }]
                  : []),
                ...(user.departmentId
                  ? [
                      {
                        visibility: DocVisibility.DEPARTMENT,
                        departmentId: user.departmentId,
                      },
                    ]
                  : []),
                { uploadedById: user.id },
              ],
            },
            include: {
              chunks: true,
            },
          });

          const query = ((mockEmbeddings as any).lastQuery || "").toLowerCase();

          const results: RetrievedChunk[] = [];
          for (const d of docs) {
            for (const c of d.chunks) {
              let sim = 0.05; // Default low similarity for unrelated topics

              if (
                (query.includes("vacation") || query.includes("leave") || query.includes("holiday")) &&
                d.id === publicDocId
              ) {
                sim = 0.88;
              } else if (
                (query.includes("bonus") || query.includes("compensation") || query.includes("ebitda")) &&
                d.id === managerDocId
              ) {
                sim = 0.88;
              } else if (
                (query.includes("commission") || query.includes("sales") || query.includes("enterprise")) &&
                d.id === salesDeptDocId
              ) {
                sim = 0.88;
              }

              results.push({
                id: c.id,
                documentId: d.id,
                documentTitle: d.title,
                chunkIndex: c.chunkIndex,
                pageNumber: c.pageNumber,
                content: c.content,
                tokenCount: c.tokenCount,
                similarityScore: sim,
                cosineDistance: parseFloat((1 - sim).toFixed(4)),
              });
            }
          }

          // Sort descending by similarity
          return results
            .sort((a, b) => b.similarityScore - a.similarityScore)
            .slice(0, limit);
        }
      );
    }
  });

  afterAll(async () => {
    // Cleanup created data
    if (createdSessionIds.length > 0) {
      await prisma.chatSession.deleteMany({
        where: { id: { in: createdSessionIds } },
      });
    }
    if (createdDocIds.length > 0) {
      await prisma.document.deleteMany({
        where: { id: { in: createdDocIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    if (createdDeptIds.length > 0) {
      await prisma.department.deleteMany({
        where: { id: { in: createdDeptIds } },
      });
    }
  });

  beforeEach(() => {
    mockLLM.clearQueue();
  });

  describe("1. Citation Parsing & Cleaning Unit Tests", () => {
    const mockChunks = [
      {
        documentId: "doc-1",
        documentTitle: "Vacation Policy",
        pageNumber: 1,
        content: "Employees are entitled to 25 annual leave days per calendar year.",
      },
      {
        documentId: "doc-1",
        documentTitle: "Vacation Policy",
        pageNumber: 1, // Same doc and page for deduplication test
        content: "Unused leave can be rolled over up to 5 days into Q1.",
      },
      {
        documentId: "doc-2",
        documentTitle: "Security Guide",
        pageNumber: 4,
        content: "Multi-factor authentication is mandatory on all corporate accounts.",
      },
    ];

    it("maps valid [n] markers to real chunks and extracts citations", () => {
      const generated = "According to our policy [1], employees get 25 days.";
      const { cleanedText, citations } = parseAndCleanCitations(generated, mockChunks);

      expect(citations).toHaveLength(1);
      expect(citations[0].documentId).toBe("doc-1");
      expect(citations[0].documentTitle).toBe("Vacation Policy");
      expect(citations[0].pageNumber).toBe(1);
      expect(citations[0].snippet).toContain("25 annual leave days");
      expect(cleanedText).toBe("According to our policy [1], employees get 25 days.");
    });

    it("deduplicates citations matching the same document and page", () => {
      const generated = "Under [1] and also in section [2], leaves are discussed.";
      const { cleanedText, citations } = parseAndCleanCitations(generated, mockChunks);

      // Both [1] and [2] are doc-1, page 1 -> should result in only 1 citation entry
      expect(citations).toHaveLength(1);
      expect(citations[0].documentId).toBe("doc-1");
      expect(citations[0].pageNumber).toBe(1);
      // But both markers in the text are valid and preserved
      expect(cleanedText).toContain("[1]");
      expect(cleanedText).toContain("[2]");
    });

    it("strips unmapped [n] markers that do not correspond to any chunk", () => {
      const generated = "According to [1], we have rules. However, [99] and [4] are hallucinations.";
      const { cleanedText, citations } = parseAndCleanCitations(generated, mockChunks);

      // Only [1] is valid
      expect(citations).toHaveLength(1);
      expect(citations[0].documentId).toBe("doc-1");

      // [99] and [4] must be completely removed from cleanedText
      expect(cleanedText).not.toContain("[99]");
      expect(cleanedText).not.toContain("[4]");
      expect(cleanedText).toContain("[1]");
    });

    it("formats sources context with XML-delimited <source> tags", () => {
      const formatted = formatSourcesContext(mockChunks);
      expect(formatted).toContain('<source id="1" title="Vacation Policy" page="1">');
      expect(formatted).toContain('<source id="2" title="Vacation Policy" page="1">');
      expect(formatted).toContain('<source id="3" title="Security Guide" page="4">');
      expect(formatted).toContain("</source>");
    });
  });

  describe("2. Answer Path with Mocked LLM", () => {
    it("retrieves chunks, calls LLM stream, and saves message with citations and token count", async () => {
      mockLLM.enqueueResponse("Employees receive 25 days of vacation every year according to policy [1].");

      const tokens: string[] = [];
      let citationsReceived: any[] = [];

      const result = await chatService.streamChat(
        employeeSales as any,
        "How many days of annual vacation leave do employees get?",
        undefined,
        {
          onToken: (tok) => tokens.push(tok),
          onCitations: (cits) => {
            citationsReceived = cits;
          },
        }
      );

      createdSessionIds.push(result.sessionId);

      expect(result.notFound).toBe(false);
      expect(result.content).toContain("[1]");
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(tokens.length).toBeGreaterThan(0);

      // Verify citations
      expect(citationsReceived.length).toBeGreaterThanOrEqual(1);
      expect(citationsReceived[0].documentTitle).toBe("Company Holiday Policy");
      expect(citationsReceived[0].pageNumber).toBe(1);

      // Verify persisted in database
      const savedMsg = await prisma.chatMessage.findUnique({
        where: { id: result.messageId },
      });
      expect(savedMsg).toBeDefined();
      expect(savedMsg?.role).toBe("ASSISTANT");
      expect(savedMsg?.content).toContain("25 days of vacation");
      expect(savedMsg?.tokensUsed).toBe(result.tokensUsed);
      expect(Array.isArray(savedMsg?.citations as any)).toBe(true);
    });
  });

  describe("3. Not-Found Path without calling LLM", () => {
    it("returns 'I couldn't find this in the company documents' without calling LLM when similarity is below threshold", async () => {
      const streamSpy = vi.spyOn(mockLLM, "stream");

      const tokens: string[] = [];
      let citationsReceived: any[] = [];

      const result = await chatService.streamChat(
        employeeSales as any,
        "What is the interplanetary quantum teleporter frequency in the basement?",
        undefined,
        {
          onToken: (tok) => tokens.push(tok),
          onCitations: (cits) => {
            citationsReceived = cits;
          },
        }
      );

      createdSessionIds.push(result.sessionId);

      // LLM MUST NOT have been called!
      expect(streamSpy).not.toHaveBeenCalled();

      // Must be not-found result
      expect(result.notFound).toBe(true);
      expect(result.content).toBe("I couldn't find this in the company documents.");
      expect(result.citations).toEqual([]);
      expect(result.tokensUsed).toBe(0);
      expect(tokens.join("")).toContain("I couldn't find this in the company documents.");

      // Check database persistence
      const savedMsg = await prisma.chatMessage.findUnique({
        where: { id: result.messageId },
      });
      expect(savedMsg?.content).toBe("I couldn't find this in the company documents.");
      expect(savedMsg?.tokensUsed).toBe(0);

      streamSpy.mockRestore();
    });
  });

  describe("4. Fake Citation Stripping in Chat Execution", () => {
    it("removes unmapped [99] and [4] hallucinated by model before saving to database", async () => {
      mockLLM.enqueueResponse(
        "Vacation is 25 days [1]. Also see hallucinated rules [99] and [4]."
      );

      const result = await chatService.streamChat(
        employeeSales as any,
        "Tell me about annual vacation days and any secret rules",
        undefined,
        {
          onToken: () => {},
          onCitations: () => {},
        }
      );

      createdSessionIds.push(result.sessionId);

      // Valid [1] kept, unmapped [99] and [4] stripped
      expect(result.content).toContain("[1]");
      expect(result.content).not.toContain("[99]");
      expect(result.content).not.toContain("[4]");

      const savedMsg = await prisma.chatMessage.findUnique({
        where: { id: result.messageId },
      });
      expect(savedMsg?.content).toContain("[1]");
      expect(savedMsg?.content).not.toContain("[99]");
      expect(savedMsg?.content).not.toContain("[4]");
    });
  });

  describe("5. Permission Filtering Respected in Retrieval", () => {
    it("employee CANNOT access MANAGER-only document and takes not-found path", async () => {
      const streamSpy = vi.spyOn(mockLLM, "stream");

      const result = await chatService.streamChat(
        employeeSales as any,
        "What is the executive performance bonus percentage on EBITDA?",
        undefined,
        {
          onToken: () => {},
          onCitations: () => {},
        }
      );

      createdSessionIds.push(result.sessionId);

      // Employee cannot see MANAGERS documents; retrieval returns empty for this query
      expect(result.notFound).toBe(true);
      expect(streamSpy).not.toHaveBeenCalled();
      expect(result.content).toBe("I couldn't find this in the company documents.");

      streamSpy.mockRestore();
    });

    it("manager CAN access MANAGER-only document and receives answer", async () => {
      mockLLM.enqueueResponse(
        "Executive performance bonuses are calculated at 30% of base salary based on EBITDA [1]."
      );

      const result = await chatService.streamChat(
        managerSales as any,
        "What is the executive performance bonus percentage on EBITDA?",
        undefined,
        {
          onToken: () => {},
          onCitations: () => {},
        }
      );

      createdSessionIds.push(result.sessionId);

      expect(result.notFound).toBe(false);
      expect(result.content).toContain("30%");
      expect(result.citations.length).toBeGreaterThan(0);
      expect(result.citations[0].documentTitle).toBe("Executive Compensation Review");
    });

    it("employee from Engineering CANNOT access Sales DEPARTMENT document", async () => {
      const streamSpy = vi.spyOn(mockLLM, "stream");

      const result = await chatService.streamChat(
        employeeEngineering as any,
        "What is the sales team commission rate on enterprise contracts?",
        undefined,
        {
          onToken: () => {},
          onCitations: () => {},
        }
      );

      createdSessionIds.push(result.sessionId);

      // Engineering employee has no access to Sales department document
      expect(result.notFound).toBe(true);
      expect(streamSpy).not.toHaveBeenCalled();

      streamSpy.mockRestore();
    });
  });

  describe("6. Session Ownership Security & API Endpoints", () => {
    let sessionUserAId: string;

    beforeAll(async () => {
      const sess = await prisma.chatSession.create({
        data: {
          userId: employeeSales.id,
          title: "Charlie's Private Session",
        },
      });
      sessionUserAId = sess.id;
      createdSessionIds.push(sessionUserAId);
    });

    it("GET /api/ai/sessions returns only sessions owned by the authenticated user", async () => {
      const res = await request(app)
        .get("/api/ai/sessions")
        .set("Authorization", `Bearer ${employeeSalesToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(Array.isArray(res.body.sessions)).toBe(true);

      const sessionIds = res.body.sessions.map((s: any) => s.id);
      expect(sessionIds).toContain(sessionUserAId);

      // Another user should not see Charlie's session
      const resOther = await request(app)
        .get("/api/ai/sessions")
        .set("Authorization", `Bearer ${employeeEngineeringToken}`);

      expect(resOther.status).toBe(200);
      const otherSessionIds = resOther.body.sessions.map((s: any) => s.id);
      expect(otherSessionIds).not.toContain(sessionUserAId);
    });

    it("GET /api/ai/sessions/:id returns 403 Forbidden when accessing another user's session", async () => {
      const res = await request(app)
        .get(`/api/ai/sessions/${sessionUserAId}`)
        .set("Authorization", `Bearer ${employeeEngineeringToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("You do not have access to this chat session");
    });

    it("DELETE /api/ai/sessions/:id returns 403 Forbidden when deleting another user's session", async () => {
      const res = await request(app)
        .delete(`/api/ai/sessions/${sessionUserAId}`)
        .set("Authorization", `Bearer ${employeeEngineeringToken}`);

      expect(res.status).toBe(403);
    });

    it("POST /api/ai/chat returns 403 Forbidden when trying to continue another user's session", async () => {
      const res = await request(app)
        .post("/api/ai/chat")
        .set("Authorization", `Bearer ${employeeEngineeringToken}`)
        .send({
          sessionId: sessionUserAId,
          message: "Attempting to hijack session",
        });

      // Headers sent or error
      expect(res.status === 403 || res.text.includes("You do not have access")).toBe(true);
    });
  });

  describe("7. Feedback Endpoint", () => {
    let testMessageId: string;

    beforeAll(async () => {
      const sess = await prisma.chatSession.create({
        data: {
          userId: employeeSales.id,
          title: "Feedback Test Session",
        },
      });
      createdSessionIds.push(sess.id);

      const msg = await prisma.chatMessage.create({
        data: {
          sessionId: sess.id,
          role: "ASSISTANT",
          content: "Helpful response",
        },
      });
      testMessageId = msg.id;
    });

    it("records thumbs up feedback (+1)", async () => {
      const res = await request(app)
        .post(`/api/ai/messages/${testMessageId}/feedback`)
        .set("Authorization", `Bearer ${employeeSalesToken}`)
        .send({ vote: "up" });

      expect(res.status).toBe(200);
      expect(res.body.chatMessage.feedback).toBe(1);

      const updated = await prisma.chatMessage.findUnique({
        where: { id: testMessageId },
      });
      expect(updated?.feedback).toBe(1);
    });

    it("records thumbs down feedback (-1)", async () => {
      const res = await request(app)
        .post(`/api/ai/messages/${testMessageId}/feedback`)
        .set("Authorization", `Bearer ${employeeSalesToken}`)
        .send({ feedback: -1 });

      expect(res.status).toBe(200);
      expect(res.body.chatMessage.feedback).toBe(-1);
    });

    it("rejects feedback attempt by unauthorized user (403)", async () => {
      const res = await request(app)
        .post(`/api/ai/messages/${testMessageId}/feedback`)
        .set("Authorization", `Bearer ${employeeEngineeringToken}`)
        .send({ vote: "up" });

      expect(res.status).toBe(403);
    });
  });

  describe("8. SSE Streaming HTTP Endpoint", () => {
    it("returns Content-Type text/event-stream with typed SSE events (token, citations, done)", async () => {
      mockLLM.enqueueResponse("Annual leave is 25 days [1].");

      const res = await request(app)
        .post("/api/ai/chat")
        .set("Authorization", `Bearer ${employeeSalesToken}`)
        .send({
          message: "What is our annual leave policy?",
        });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/event-stream");
      expect(res.headers["cache-control"]).toContain("no-cache");
      expect(res.headers["x-accel-buffering"]).toBe("no");

      // Verify SSE events in response text
      expect(res.text).toContain("event: token");
      expect(res.text).toContain("event: citations");
      expect(res.text).toContain("event: done");
    });
  });
});
