import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import { Role, DocVisibility, DocStatus } from "@prisma/client";
import { app } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { chatService } from "../../src/modules/ai/chat.service";
import {
  setLLMProvider,
  MockLLMProvider,
} from "../../src/lib/llm";
import {
  setEmbeddingsProvider,
  MockEmbeddingsProvider,
} from "../../src/lib/embeddings";
import {
  createUser,
  createDepartment,
  createDocument,
  createChunk,
} from "../helpers/factories";

describe("Integration: AI Chat Service & API Endpoints (Real Test DB)", () => {
  const mockLLM = new MockLLMProvider();
  const mockEmbeddings = new MockEmbeddingsProvider();

  let empA: { id: string; email: string; role: Role; departmentId: string | null; organizationId: string | null };
  let empB: { id: string; email: string; role: Role; departmentId: string | null; organizationId: string | null };
  let tokenA: string;
  let tokenB: string;

  let knowledgeDoc: { id: string };

  beforeAll(async () => {
    setLLMProvider(mockLLM);
    setEmbeddingsProvider(mockEmbeddings);

    const dept = await createDepartment("Support");
    const a = await createUser({ role: Role.EMPLOYEE, departmentId: dept.id });
    empA = a.user;
    tokenA = a.token;

    const b = await createUser({ role: Role.EMPLOYEE, departmentId: dept.id });
    empB = b.user;
    tokenB = b.token;

    knowledgeDoc = await createDocument(empA, {
      title: "Employee Leave and Absence Policy 2026",
      visibility: DocVisibility.ALL,
      status: DocStatus.READY,
    });

    await createChunk(knowledgeDoc.id, {
      content:
        "Standard annual leave allowance is 25 days for all full-time employees, accruable monthly.",
      pageNumber: 2,
    });
  });

  it("answer path: streams response and emits citation chip for matching document", async () => {
    mockLLM.setNormalAnswer(
      "Full-time employees receive 25 days of annual leave [1]."
    );

    const receivedTokens: string[] = [];
    let receivedCitations: any[] = [];

    const result = await chatService.streamChat(
      empA as any,
      "What is the annual leave allowance?",
      undefined,
      {
        onToken: (t) => receivedTokens.push(t),
        onCitations: (c) => (receivedCitations = c),
      }
    );

    expect(result.notFound).toBe(false);
    expect(result.content).toContain("25 days of annual leave [1]");
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].documentId).toBe(knowledgeDoc.id);
    expect(result.citations[0].pageNumber).toBe(2);

    // Verify session and message persistence in DB
    const session = await prisma.chatSession.findUnique({
      where: { id: result.sessionId },
      include: { messages: true },
    });
    expect(session).not.toBeNull();
    expect(session?.userId).toBe(empA.id);
    expect(session?.messages.length).toBeGreaterThanOrEqual(2);
  });

  it("not-found path: when query has no relevant company documents, LLM mock is NOT called", async () => {
    const streamSpy = vi.spyOn(mockLLM, "stream");
    streamSpy.mockClear();

    // Query on an obscure topic totally absent from our seeded chunks
    const result = await chatService.streamChat(
      empA as any,
      "xyzrandomobscurequeryneverindexed1234567890",
      undefined,
      {
        onToken: () => {},
        onCitations: () => {},
      }
    );

    // LLM mock must NOT have been called!
    expect(streamSpy).not.toHaveBeenCalled();
    expect(result.notFound).toBe(true);
    expect(result.content).toMatch(/cannot find|could not find|do not know/i);
    expect(result.citations).toHaveLength(0);

    streamSpy.mockRestore();
  });

  it("strips hallucinated fake citations: unmapped [99] marker is removed from final text", async () => {
    mockLLM.setFakeCitationAnswer(); // Returns "...section 4 [1] and phantom article [99]..."

    const result = await chatService.streamChat(
      empA as any,
      "Summarize leave allowance",
      undefined,
      {
        onToken: () => {},
        onCitations: () => {},
      }
    );

    // [1] is valid, [99] must be stripped
    expect(result.content).toContain("[1]");
    expect(result.content).not.toContain("[99]");
    expect(result.citations).toHaveLength(1);
  });

  it("enforces session ownership: User B cannot access or stream into User A's chat session", async () => {
    // Create a session for User A
    const sessionA = await prisma.chatSession.create({
      data: {
        organizationId: empA.organizationId!,
        userId: empA.id,
        title: "User A Sensitive Session",
      },
    });

    // User B tries to view session A
    const getRes = await request(app)
      .get(`/api/ai/sessions/${sessionA.id}`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect([403, 404]).toContain(getRes.status);

    // User B tries to delete session A
    const delRes = await request(app)
      .delete(`/api/ai/sessions/${sessionA.id}`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect([403, 404]).toContain(delRes.status);
  });
});
