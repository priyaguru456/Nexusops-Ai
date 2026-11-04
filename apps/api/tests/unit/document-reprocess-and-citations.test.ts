import { describe, it, expect, vi, beforeEach } from "vitest";
import { Role, DocVisibility, DocStatus } from "@prisma/client";
import { documentService } from "../../src/modules/documents/document.service";
import { documentRepository } from "../../src/modules/documents/document.repository";
import { documentQueue } from "../../src/lib/queue";
import { auditService } from "../../src/modules/audit/audit.service";
import { parseAndCleanCitations, formatSourcesContext } from "../../src/lib/llm";

vi.mock("../../src/modules/documents/document.repository", () => ({
  documentRepository: {
    findById: vi.fn(),
    deleteChunks: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../src/lib/queue", () => ({
  documentQueue: {
    add: vi.fn(),
  },
}));

vi.mock("../../src/modules/audit/audit.service", () => ({
  auditService: {
    log: vi.fn(),
  },
}));

describe("Document Reprocess & Citation Chunks Tests", () => {
  const adminUser = {
    id: "admin-1",
    role: Role.ADMIN,
    departmentId: "dept-1",
  };

  const managerUser = {
    id: "mgr-1",
    role: Role.MANAGER,
    departmentId: "dept-1",
  };

  const employeeUser = {
    id: "emp-1",
    role: Role.EMPLOYEE,
    departmentId: "dept-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("documentService.reprocess()", () => {
    it("allows Admin to reprocess a FAILED document, resets status, queues job, and logs audit", async () => {
      vi.mocked(documentRepository.findById).mockResolvedValueOnce({
        id: "doc-failed-1",
        title: "Architecture Guide",
        status: DocStatus.FAILED,
        visibility: DocVisibility.ALL,
        departmentId: null,
        uploadedById: "admin-1",
      } as any);

      vi.mocked(documentRepository.deleteChunks).mockResolvedValueOnce();
      vi.mocked(documentRepository.update).mockResolvedValueOnce({
        id: "doc-failed-1",
        title: "Architecture Guide",
        status: DocStatus.UPLOADED,
        errorMessage: null,
      } as any);

      const res = await documentService.reprocess("doc-failed-1", adminUser as any);

      expect(res.status).toBe(DocStatus.UPLOADED);
      expect(documentRepository.deleteChunks).toHaveBeenCalledWith("doc-failed-1");
      expect(documentRepository.update).toHaveBeenCalledWith("doc-failed-1", {
        status: DocStatus.UPLOADED,
        errorMessage: null,
      });
      expect(documentQueue.add).toHaveBeenCalledWith("process-document", {
        documentId: "doc-failed-1",
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: adminUser.id,
          action: "DOCUMENT_RETRY_EMBEDDING",
          entityType: "Document",
          entityId: "doc-failed-1",
        })
      );
    });

    it("allows Manager to reprocess document in their department", async () => {
      vi.mocked(documentRepository.findById).mockResolvedValueOnce({
        id: "doc-dept-1",
        title: "Dept Guidelines",
        status: DocStatus.FAILED,
        visibility: DocVisibility.DEPARTMENT,
        departmentId: "dept-1",
        uploadedById: "other-user",
      } as any);

      vi.mocked(documentRepository.deleteChunks).mockResolvedValueOnce();
      vi.mocked(documentRepository.update).mockResolvedValueOnce({
        id: "doc-dept-1",
        status: DocStatus.UPLOADED,
      } as any);

      const res = await documentService.reprocess("doc-dept-1", managerUser as any);
      expect(res.status).toBe(DocStatus.UPLOADED);
      expect(documentQueue.add).toHaveBeenCalled();
    });

    it("rejects user when they do not have visibility permissions for document", async () => {
      vi.mocked(documentRepository.findById).mockResolvedValueOnce({
        id: "doc-secret",
        title: "Admin Only Policy",
        status: DocStatus.FAILED,
        visibility: DocVisibility.ADMIN_ONLY,
        departmentId: "dept-2",
        uploadedById: "admin-1",
      } as any);

      await expect(
        documentService.reprocess("doc-secret", managerUser as any)
      ).rejects.toThrow(/do not have permission to reprocess/i);

      expect(documentQueue.add).not.toHaveBeenCalled();
    });

    it("throws 404 when document does not exist", async () => {
      vi.mocked(documentRepository.findById).mockResolvedValueOnce(null);

      await expect(
        documentService.reprocess("nonexistent-id", adminUser as any)
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("parseAndCleanCitations() with chunkIndex support", () => {
    it("extracts citations including chunkIndex when pageNumber is present or null", () => {
      const generatedText = "According to our policy [1], employees get 20 days off. See also [2].";
      const chunks = [
        {
          documentId: "doc-1",
          documentTitle: "Leave Policy",
          pageNumber: 4,
          chunkIndex: 2,
          content: "Employees are entitled to 20 days off per year.",
        },
        {
          documentId: "doc-2",
          documentTitle: "IT Security Notes",
          pageNumber: null,
          chunkIndex: 0,
          content: "Use multi-factor authentication on all company portals.",
        },
      ];

      const { cleanedText, citations } = parseAndCleanCitations(generatedText, chunks);

      expect(cleanedText).toBe("According to our policy [1], employees get 20 days off. See also [2].");
      expect(citations).toHaveLength(2);

      expect(citations[0]).toEqual({
        documentId: "doc-1",
        documentTitle: "Leave Policy",
        pageNumber: 4,
        chunkIndex: 2,
        snippet: "Employees are entitled to 20 days off per year.",
      });

      expect(citations[1]).toEqual({
        documentId: "doc-2",
        documentTitle: "IT Security Notes",
        pageNumber: null,
        chunkIndex: 0,
        snippet: "Use multi-factor authentication on all company portals.",
      });
    });

    it("strips citations that do not map to any valid chunk", () => {
      const generatedText = "Verified fact [1] and hallucinated source [99].";
      const chunks = [
        {
          documentId: "doc-1",
          documentTitle: "Leave Policy",
          pageNumber: 1,
          chunkIndex: 0,
          content: "Verified fact content.",
        },
      ];

      const { cleanedText, citations } = parseAndCleanCitations(generatedText, chunks);

      expect(cleanedText).toBe("Verified fact [1] and hallucinated source .");
      expect(citations).toHaveLength(1);
      expect(citations[0].documentId).toBe("doc-1");
    });
  });
});
