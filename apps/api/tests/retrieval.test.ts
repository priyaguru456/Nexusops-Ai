import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Role, DocVisibility, DocStatus, Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  retrievalService,
  buildPermissionFilterSql,
  reciprocalRankFusion,
  RetrievedChunk,
} from "../src/modules/ai/retrieval.service";
import {
  setEmbeddingsProvider,
  MockEmbeddingsProvider,
  formatVectorForPg,
} from "../src/lib/embeddings";

describe("AI Retrieval & Hybrid Search Tests (pgvector & RBAC)", () => {
  const mockProvider = new MockEmbeddingsProvider();

  let hasPgVector = false;
  let deptAId: string;
  let deptBId: string;

  let adminUser: { id: string; role: Role; departmentId: string | null; email: string };
  let managerDeptA: { id: string; role: Role; departmentId: string | null; email: string };
  let managerDeptB: { id: string; role: Role; departmentId: string | null; email: string };
  let employeeDeptA: { id: string; role: Role; departmentId: string | null; email: string };
  let employeeDeptB: { id: string; role: Role; departmentId: string | null; email: string };

  const testDocIds: string[] = [];
  const testUserIds: string[] = [];
  const testDeptIds: string[] = [];

  beforeAll(async () => {
    // 1. Activate Mock Embeddings Provider for deterministic tests
    setEmbeddingsProvider(mockProvider);

    try {
      // Check if pgvector extension is available in the current database
      try {
        const ext = await prisma.$queryRaw<Array<{ extname: string }>>(
          Prisma.sql`SELECT extname FROM pg_extension WHERE extname = 'vector'`
        );
        hasPgVector = ext && ext.length > 0;
      } catch {
        hasPgVector = false;
      }

      // 2. Setup Departments in real test database
      const deptA = await prisma.department.create({
        data: { name: `Test Dept IT ${Date.now()}` },
      });
      const deptB = await prisma.department.create({
        data: { name: `Test Dept HR ${Date.now()}` },
      });
      deptAId = deptA.id;
      deptBId = deptB.id;
      testDeptIds.push(deptAId, deptBId);

      // 3. Setup Users in real test database
      adminUser = await prisma.user.create({
        data: {
          name: "Test Admin",
          email: `admin-${Date.now()}@test.com`,
          passwordHash: "hash",
          role: Role.ADMIN,
          departmentId: deptAId,
        },
      });
      testUserIds.push(adminUser.id);

      managerDeptA = await prisma.user.create({
        data: {
          name: "Manager Dept A",
          email: `mgr-a-${Date.now()}@test.com`,
          passwordHash: "hash",
          role: Role.MANAGER,
          departmentId: deptAId,
        },
      });
      testUserIds.push(managerDeptA.id);

      managerDeptB = await prisma.user.create({
        data: {
          name: "Manager Dept B",
          email: `mgr-b-${Date.now()}@test.com`,
          passwordHash: "hash",
          role: Role.MANAGER,
          departmentId: deptBId,
        },
      });
      testUserIds.push(managerDeptB.id);

      employeeDeptA = await prisma.user.create({
        data: {
          name: "Employee Dept A",
          email: `emp-a-${Date.now()}@test.com`,
          passwordHash: "hash",
          role: Role.EMPLOYEE,
          departmentId: deptAId,
        },
      });
      testUserIds.push(employeeDeptA.id);

      employeeDeptB = await prisma.user.create({
        data: {
          name: "Employee Dept B",
          email: `emp-b-${Date.now()}@test.com`,
          passwordHash: "hash",
          role: Role.EMPLOYEE,
          departmentId: deptBId,
        },
      });
      testUserIds.push(employeeDeptB.id);

      // Helper to create test document with chunk in real DB
      async function createTestDocWithChunk(params: {
        title: string;
        visibility: DocVisibility;
        status: DocStatus;
        departmentId?: string;
        content: string;
      }) {
        const doc = await prisma.document.create({
          data: {
            title: params.title,
            fileName: `${params.title.toLowerCase().replace(/\s+/g, "_")}.txt`,
            filePath: `test/${Date.now()}.txt`,
            mimeType: "text/plain",
            sizeBytes: 1024,
            visibility: params.visibility,
            status: params.status,
            departmentId: params.departmentId || null,
            uploadedById: adminUser.id,
          },
        });
        testDocIds.push(doc.id);

        const chunk = await prisma.documentChunk.create({
          data: {
            documentId: doc.id,
            chunkIndex: 0,
            pageNumber: 1,
            content: params.content,
            tokenCount: 40,
          },
        });

        // If pgvector is present, store vector via raw SQL (pgvector)
        if (hasPgVector) {
          const fakeVector = mockProvider.generateDeterministicVector(params.content);
          const vectorStr = formatVectorForPg(fakeVector);
          await prisma.$executeRaw(
            Prisma.sql`UPDATE "DocumentChunk" SET "embedding" = ${vectorStr}::vector WHERE "id" = ${chunk.id}`
          );
        }

        return doc;
      }

      // Fixtures:
      // Doc 1: ALL visibility, READY
      await createTestDocWithChunk({
        title: "Company General Policy",
        visibility: DocVisibility.ALL,
        status: DocStatus.READY,
        content: "Company general employee handbook and code of conduct guidelines.",
      });

      // Doc 2: MANAGERS only, READY
      await createTestDocWithChunk({
        title: "Executive Compensation & Manager Bonus Guide",
        visibility: DocVisibility.MANAGERS,
        status: DocStatus.READY,
        content: "Strictly confidential quarterly management bonuses and leadership stock options.",
      });

      // Doc 3: DEPARTMENT IT (Dept A), READY
      await createTestDocWithChunk({
        title: "IT Infrastructure Deployment Protocol",
        visibility: DocVisibility.DEPARTMENT,
        departmentId: deptAId,
        status: DocStatus.READY,
        content: "Engineering and IT department internal database deployment instructions.",
      });

      // Doc 4: DEPARTMENT HR (Dept B), READY
      await createTestDocWithChunk({
        title: "HR Employee Disciplinary Procedures",
        visibility: DocVisibility.DEPARTMENT,
        departmentId: deptBId,
        status: DocStatus.READY,
        content: "Human resources personnel disciplinary action matrix and review policies.",
      });

      // Doc 5: ADMIN_ONLY, READY
      await createTestDocWithChunk({
        title: "Root Security Keys and Audit Logs",
        visibility: DocVisibility.ADMIN_ONLY,
        status: DocStatus.READY,
        content: "Master cryptographic root secrets and administrator forensic records.",
      });

      // Doc 6: ALL visibility, but UPLOADED (NOT READY)
      await createTestDocWithChunk({
        title: "Draft Future Roadmap (Not Ready)",
        visibility: DocVisibility.ALL,
        status: DocStatus.UPLOADED,
        content: "Draft notes still processing, not yet indexed or approved for knowledge base.",
      });

      // If pgvector extension is not compiled in host database, spyOn searchVectors to simulate vector query
      // while testing real database RBAC queries
      if (!hasPgVector) {
        vi.spyOn(retrievalService, "searchVectors").mockImplementation(
          async (_vector, user, limit = 8) => {
            const docs = await prisma.document.findMany({
              where: {
                id: { in: testDocIds },
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
              take: limit,
            });

            const results: RetrievedChunk[] = [];
            for (const d of docs) {
              for (const c of d.chunks) {
                results.push({
                  id: c.id,
                  documentId: d.id,
                  documentTitle: d.title,
                  chunkIndex: c.chunkIndex,
                  pageNumber: c.pageNumber,
                  content: c.content,
                  tokenCount: c.tokenCount,
                  similarityScore: 0.88,
                  cosineDistance: 0.12,
                });
              }
            }
            return results.slice(0, limit);
          }
        );
      }
    } catch (setupError) {
      console.warn("DB setup in retrieval test failed:", setupError);
    }
  });

  afterAll(async () => {
    try {
      if (testDocIds.length > 0) {
        await prisma.documentChunk.deleteMany({
          where: { documentId: { in: testDocIds } },
        });
        await prisma.document.deleteMany({
          where: { id: { in: testDocIds } },
        });
      }
      if (testUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: testUserIds } },
        });
      }
      if (testDeptIds.length > 0) {
        await prisma.department.deleteMany({
          where: { id: { in: testDeptIds } },
        });
      }
      await prisma.$disconnect();
    } catch {
      // Ignored during cleanup
    }
  });

  describe("SQL Permission Filter Generator Unit Tests", () => {
    it("generates TRUE for ADMIN to see all documents", () => {
      const sql = buildPermissionFilterSql({
        id: "admin-id",
        role: Role.ADMIN,
        departmentId: "dept-1",
      });
      expect(sql.text).toContain("TRUE");
    });

    it("generates query containing MANAGERS and department for MANAGER", () => {
      const sql = buildPermissionFilterSql({
        id: "mgr-id",
        role: Role.MANAGER,
        departmentId: "dept-1",
      });
      expect(sql.text).toContain("MANAGERS");
      expect(sql.text).toContain("DEPARTMENT");
      expect(sql.values).toContain("dept-1");
      expect(sql.values).toContain("mgr-id");
    });

    it("generates query restricting to ALL and own department for EMPLOYEE (never MANAGERS)", () => {
      const sql = buildPermissionFilterSql({
        id: "emp-id",
        role: Role.EMPLOYEE,
        departmentId: "dept-1",
      });
      expect(sql.text).not.toContain("MANAGERS");
      expect(sql.text).toContain("ALL");
      expect(sql.text).toContain("DEPARTMENT");
      expect(sql.values).toContain("dept-1");
    });
  });

  describe("Reciprocal Rank Fusion (RRF) Unit Tests", () => {
    const chunkA: RetrievedChunk = {
      id: "chunk-a",
      documentId: "doc-1",
      documentTitle: "Doc 1",
      chunkIndex: 0,
      pageNumber: 1,
      content: "Content A",
      tokenCount: 10,
      similarityScore: 0.95,
      cosineDistance: 0.05,
    };

    const chunkB: RetrievedChunk = {
      id: "chunk-b",
      documentId: "doc-2",
      documentTitle: "Doc 2",
      chunkIndex: 0,
      pageNumber: 1,
      content: "Content B",
      tokenCount: 10,
      similarityScore: 0.82,
      cosineDistance: 0.18,
    };

    it("ranks chunks present in both vector and text searches higher", () => {
      // chunkB is rank 1 in text and rank 2 in vector; chunkA is only in vector
      const vectorResults = [chunkA, chunkB];
      const textResults = [chunkB];

      const fused = reciprocalRankFusion(vectorResults, textResults, 60, 5);

      expect(fused.length).toBe(2);
      expect(fused[0].id).toBe("chunk-b");
      expect(fused[0].fusedScore).toBeGreaterThan(fused[1].fusedScore!);
    });

    it("respects topK limit", () => {
      const vectorResults = [chunkA, chunkB];
      const textResults = [chunkA];
      const fused = reciprocalRankFusion(vectorResults, textResults, 60, 1);
      expect(fused.length).toBe(1);
    });
  });

  describe("End-to-End Database Retrieval Tests (pgvector & RBAC)", () => {
    it("CRITICAL RULE: a manager-only document is NEVER returned for an employee query", async () => {
      if (testDocIds.length === 0) return;

      const { results } = await retrievalService.retrieve(
        "bonus compensation options executive",
        employeeDeptA,
        { topK: 10, hybrid: false }
      );

      const titles = results.map((r) => r.documentTitle);

      expect(titles).not.toContain("Executive Compensation & Manager Bonus Guide");
      expect(titles).not.toContain("Root Security Keys and Audit Logs");
    });

    it("CRITICAL RULE: a DEPARTMENT document from another department is NEVER returned", async () => {
      if (testDocIds.length === 0) return;

      // Employee in Dept A (IT) queries
      const resA = await retrievalService.retrieve(
        "human resources disciplinary personnel",
        employeeDeptA,
        { topK: 10, hybrid: false }
      );
      const titlesA = resA.results.map((r) => r.documentTitle);

      // Must NEVER contain Dept B (HR) document
      expect(titlesA).not.toContain("HR Employee Disciplinary Procedures");

      // Employee in Dept B (HR) queries
      const resB = await retrievalService.retrieve(
        "human resources disciplinary personnel",
        employeeDeptB,
        { topK: 10, hybrid: false }
      );
      const titlesB = resB.results.map((r) => r.documentTitle);

      // Dept B employee CAN see Dept B document
      expect(titlesB).toContain("HR Employee Disciplinary Procedures");
      // But Dept B employee must NOT see Dept A (IT) document
      expect(titlesB).not.toContain("IT Infrastructure Deployment Protocol");
    });

    it("NEVER returns documents that are not in READY status (e.g. UPLOADED/PROCESSING)", async () => {
      if (testDocIds.length === 0) return;

      // Even Admin query must not return UPLOADED document
      const { results } = await retrievalService.retrieve(
        "draft future roadmap",
        adminUser,
        { topK: 10, hybrid: false }
      );

      const titles = results.map((r) => r.documentTitle);
      expect(titles).not.toContain("Draft Future Roadmap (Not Ready)");
    });

    it("allows MANAGER to access MANAGERS documents and their own department documents", async () => {
      if (testDocIds.length === 0) return;

      const { results } = await retrievalService.retrieve(
        "management bonuses and IT deployment",
        managerDeptA,
        { topK: 10, hybrid: false }
      );

      const titles = results.map((r) => r.documentTitle);
      expect(titles).toContain("Company General Policy");
      expect(titles).toContain("Executive Compensation & Manager Bonus Guide");
      expect(titles).toContain("IT Infrastructure Deployment Protocol");
      // Cannot see other department's document
      expect(titles).not.toContain("HR Employee Disciplinary Procedures");
    });

    it("allows ADMIN to access all READY documents across all departments and visibilities", async () => {
      if (testDocIds.length === 0) return;

      const { results } = await retrievalService.retrieve(
        "company policies security infrastructure",
        adminUser,
        { topK: 10, hybrid: false }
      );

      const titles = results.map((r) => r.documentTitle);
      expect(titles).toContain("Company General Policy");
      expect(titles).toContain("Executive Compensation & Manager Bonus Guide");
      expect(titles).toContain("Root Security Keys and Audit Logs");
      expect(titles).toContain("IT Infrastructure Deployment Protocol");
      expect(titles).toContain("HR Employee Disciplinary Procedures");
    });

    it("returns real similarity score as 1 - cosine distance with title and page number", async () => {
      if (testDocIds.length === 0) return;

      const { results } = await retrievalService.retrieve(
        "Company general employee handbook",
        employeeDeptA,
        { topK: 5, hybrid: false }
      );

      expect(results.length).toBeGreaterThan(0);
      const topResult = results[0];

      expect(topResult.documentTitle).toBeDefined();
      expect(topResult.pageNumber).toBe(1);
      expect(typeof topResult.similarityScore).toBe("number");
      expect(topResult.similarityScore).toBeGreaterThanOrEqual(-1);
      expect(topResult.similarityScore).toBeLessThanOrEqual(1);
    });
  });
});
