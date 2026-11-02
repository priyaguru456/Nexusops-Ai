import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { Role, RequestStatus, ApprovalStatus, DocVisibility, DocStatus, Priority, RequestCategory } from "@prisma/client";
import { authService } from "../../src/modules/auth/auth.service";
import { approvalService } from "../../src/modules/approvals/approval.service";
import { requestService } from "../../src/modules/requests/request.service";
import { documentService } from "../../src/modules/documents/document.service";
import { retrievalService, reciprocalRankFusion, buildPermissionFilterSql } from "../../src/modules/ai/retrieval.service";
import { chatService } from "../../src/modules/ai/chat.service";
import { MockEmbeddingsProvider, formatVectorForPg } from "../../src/lib/embeddings";
import { MockLLMProvider, sanitizeAnthropicMessages } from "../../src/lib/llm";
import { userRepository } from "../../src/modules/users/user.repository";
import { authRepository } from "../../src/modules/auth/auth.repository";
import { requestRepository } from "../../src/modules/requests/request.repository";
import { approvalRepository } from "../../src/modules/approvals/approval.repository";
import { documentRepository } from "../../src/modules/documents/document.repository";
import { storageService } from "../../src/lib/storage";
import { documentQueue } from "../../src/lib/queue";
import { prisma } from "../../src/lib/prisma";
import { notificationService } from "../../src/modules/notifications/notification.service";

vi.mock("../../src/lib/prisma", () => {
  const mockClient = {
    $transaction: vi.fn(async (cb: any) => cb(mockClient)),
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    workRequest: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    approvalStep: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    task: {
      create: vi.fn().mockResolvedValue({ id: "auto-task-1", title: "Task 1" }),
    },
    chatSession: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "ses-1", title: "Session 1" }),
      update: vi.fn().mockResolvedValue({ id: "ses-1", title: "Session Updated" }),
      delete: vi.fn().mockResolvedValue({ id: "ses-1" }),
    },
    chatMessage: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "msg-1", content: "response" }),
      update: vi.fn().mockResolvedValue({ id: "msg-1", feedback: 1 }),
    },
  };
  return { prisma: mockClient };
});
vi.mock("../../src/modules/users/user.repository");
vi.mock("../../src/modules/auth/auth.repository");
vi.mock("../../src/modules/requests/request.repository");
vi.mock("../../src/modules/approvals/approval.repository");
vi.mock("../../src/modules/documents/document.repository");
vi.mock("../../src/lib/storage");
vi.mock("../../src/lib/queue", () => ({
  documentQueue: { add: vi.fn().mockResolvedValue({}) },
}));
vi.mock("../../src/modules/audit/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue({}) },
}));
vi.mock("../../src/modules/notifications/notification.service", () => ({
  notificationService: {
    notifyUser: vi.fn().mockResolvedValue({}),
    notifyRoles: vi.fn().mockResolvedValue({}),
    notifyUsers: vi.fn().mockResolvedValue({}),
    notifyMultiple: vi.fn().mockResolvedValue({}),
    notify: vi.fn().mockResolvedValue({}),
  },
}));

describe("Core Services Unit Tests (Auth, Requests, Approvals, Documents, AI)", () => {
  const dummyPasswordHash = bcrypt.hashSync("Password123!", 10);

  const empUser = {
    id: "usr-emp-1",
    name: "Emp One",
    email: "emp1@test.com",
    role: Role.EMPLOYEE,
    isActive: true,
    passwordHash: dummyPasswordHash,
    departmentId: "dept-eng",
    managerId: "usr-mgr-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mgrUser = {
    id: "usr-mgr-1",
    name: "Mgr One",
    email: "mgr1@test.com",
    role: Role.MANAGER,
    isActive: true,
    passwordHash: dummyPasswordHash,
    departmentId: "dept-eng",
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const adminUser = {
    id: "usr-adm-1",
    name: "Adm One",
    email: "adm1@test.com",
    role: Role.ADMIN,
    isActive: true,
    passwordHash: dummyPasswordHash,
    departmentId: null,
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AuthService Unit Tests", () => {
    it("register creates a new user with EMPLOYEE role and returns access and refresh tokens", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValueOnce(null);
      vi.mocked(userRepository.createUser).mockResolvedValueOnce(empUser as any);
      vi.mocked(authRepository.createRefreshToken).mockResolvedValueOnce({} as any);

      const result = await authService.register({
        name: "New Person",
        email: "new@test.com",
        password: "Password123!",
      });

      expect(result.user.email).toBe(empUser.email);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it("register throws 409 Conflict if email is already registered", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValueOnce(empUser as any);

      await expect(
        authService.register({
          name: "Duplicate",
          email: empUser.email,
          password: "Password123!",
        })
      ).rejects.toThrow(/already exists/i);
    });

    it("login succeeds with valid credentials and creates a refresh session", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValueOnce(empUser as any);
      vi.mocked(authRepository.createRefreshToken).mockResolvedValueOnce({} as any);

      const res = await authService.login({
        email: empUser.email,
        password: "Password123!",
      });

      expect(res.user.id).toBe(empUser.id);
      expect(res.accessToken).toBeDefined();
      expect(res.refreshToken).toBeDefined();
    });

    it("login throws 401 Unauthorized for incorrect password", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValueOnce(empUser as any);

      await expect(
        authService.login({
          email: empUser.email,
          password: "WrongPassword!",
        })
      ).rejects.toThrow(/invalid email or password/i);
    });

    it("login throws 403 Forbidden for deactivated accounts", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValueOnce({
        ...empUser,
        isActive: false,
      } as any);

      await expect(
        authService.login({
          email: empUser.email,
          password: "Password123!",
        })
      ).rejects.toThrow(/deactivated/i);
    });

    it("refresh succeeds and rotates tokens", async () => {
      vi.mocked(authRepository.findRefreshToken).mockResolvedValueOnce({
        id: "session-1",
        tokenHash: "abc",
        expiresAt: new Date(Date.now() + 100000),
        revoked: false,
        user: empUser,
      } as any);
      vi.mocked(authRepository.revokeRefreshToken).mockResolvedValueOnce({} as any);
      vi.mocked(authRepository.createRefreshToken).mockResolvedValueOnce({} as any);

      const res = await authService.refresh("valid-refresh-token-40-chars");
      expect(res.accessToken).toBeDefined();
      expect(res.refreshToken).toBeDefined();
    });

    it("logout revokes the session in the database", async () => {
      vi.mocked(authRepository.revokeRefreshTokenByHash).mockResolvedValueOnce({ count: 1 } as any);
      await authService.logout("raw-token-abc");
      expect(authRepository.revokeRefreshTokenByHash).toHaveBeenCalledTimes(1);
    });
  });

  describe("RequestService Unit Tests", () => {
    const draftRequest = {
      id: "req-101",
      title: "Draft Request",
      description: "Description text",
      status: RequestStatus.DRAFT,
      category: RequestCategory.IT,
      priority: Priority.MEDIUM,
      requesterId: empUser.id,
      departmentId: "dept-eng",
      requester: { departmentId: "dept-eng" },
    };

    it("createRequest saves a DRAFT work request", async () => {
      vi.mocked(requestRepository.create).mockResolvedValueOnce(draftRequest as any);

      const created = await requestService.createRequest(empUser as any, {
        title: "Draft Request",
        description: "Description text",
        category: RequestCategory.IT,
        priority: Priority.MEDIUM,
      });

      expect(created.id).toBe(draftRequest.id);
      expect(requestRepository.create).toHaveBeenCalled();
    });

    it("assertCanViewRequest allows requester and denies other department employees", async () => {
      vi.mocked(requestRepository.findById).mockResolvedValueOnce(draftRequest as any);

      const req = await requestService.getRequestById("req-101", empUser as any);
      expect(req.id).toBe(draftRequest.id);

      // Attempt view with other employee
      const otherEmp = { ...empUser, id: "usr-other", departmentId: "dept-marketing" };
      vi.mocked(requestRepository.findById).mockResolvedValueOnce(draftRequest as any);

      await expect(
        requestService.getRequestById("req-101", otherEmp as any)
      ).rejects.toThrow(/do not have permission/i);
    });

    it("updateRequest rejects modifications if request is not DRAFT with 409", async () => {
      vi.mocked(requestRepository.findById).mockResolvedValueOnce({
        ...draftRequest,
        status: RequestStatus.SUBMITTED,
      } as any);

      await expect(
        requestService.updateRequest("req-101", empUser as any, { title: "New Title" })
      ).rejects.toThrow(/only be edited while in DRAFT status/i);
    });

    it("transitionStatus rejects invalid transition with 409 Conflict", async () => {
      vi.mocked(requestRepository.findById).mockResolvedValueOnce(draftRequest as any);

      // Cannot jump DRAFT -> COMPLETED
      await expect(
        requestService.transitionStatus("req-101", RequestStatus.COMPLETED, mgrUser as any)
      ).rejects.toThrow(/illegal status transition/i);
    });

    it("getRequests applies query filters and role visibility", async () => {
      vi.mocked(requestRepository.findAll).mockResolvedValueOnce({
        requests: [draftRequest as any],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const res = await requestService.getRequests(empUser as any, { page: 1, limit: 10, search: "Draft" });
      expect(res.requests).toHaveLength(1);
      expect(requestRepository.findAll).toHaveBeenCalled();
    });

    it("submitRequest transitions DRAFT to SUBMITTED and initializes approval flow", async () => {
      vi.mocked(requestRepository.findById).mockResolvedValueOnce(draftRequest as any);
      vi.mocked(requestRepository.updateStatus).mockResolvedValueOnce({
        ...draftRequest,
        status: RequestStatus.SUBMITTED,
      } as any);
      vi.spyOn(approvalService, "initializeApprovalSteps").mockResolvedValueOnce();

      const res = await requestService.submitRequest("req-101", empUser as any);
      expect(res.status).toBe(RequestStatus.SUBMITTED);
      expect(approvalService.initializeApprovalSteps).toHaveBeenCalled();
    });

    it("cancelRequest cancels active request and rejects cancelling COMPLETED request", async () => {
      vi.mocked(requestRepository.findById).mockResolvedValueOnce(draftRequest as any);
      vi.mocked(requestRepository.updateStatus).mockResolvedValueOnce({
        ...draftRequest,
        status: RequestStatus.CANCELLED,
      } as any);

      const cancelled = await requestService.cancelRequest("req-101", empUser as any);
      expect(cancelled.status).toBe(RequestStatus.CANCELLED);

      // Cannot cancel COMPLETED request
      vi.mocked(requestRepository.findById).mockResolvedValueOnce({
        ...draftRequest,
        status: RequestStatus.COMPLETED,
      } as any);

      await expect(
        requestService.cancelRequest("req-101", empUser as any)
      ).rejects.toThrow(/cannot cancel request from current status completed/i);
    });

    it("transitionStatus successfully moves APPROVED to IN_PROGRESS for manager", async () => {
      vi.mocked(requestRepository.findById).mockResolvedValueOnce({
        ...draftRequest,
        status: RequestStatus.APPROVED,
      } as any);
      vi.mocked(requestRepository.updateStatus).mockResolvedValueOnce({
        ...draftRequest,
        status: RequestStatus.IN_PROGRESS,
      } as any);

      const res = await requestService.transitionStatus("req-101", RequestStatus.IN_PROGRESS, mgrUser as any, "Starting work");
      expect(res.status).toBe(RequestStatus.IN_PROGRESS);
      expect(requestRepository.updateStatus).toHaveBeenCalledWith("req-101", RequestStatus.IN_PROGRESS, undefined);
    });

    it("addAttachment saves attachment and logs audit", async () => {
      vi.mocked(requestRepository.findById).mockResolvedValueOnce(draftRequest as any);
      vi.mocked(requestRepository.addAttachment).mockResolvedValueOnce({
        id: "att-1",
        fileName: "spec.pdf",
        filePath: "spec-uuid.pdf",
      } as any);

      const dummyFile: Express.Multer.File = {
        originalname: "spec.pdf",
        filename: "spec-uuid.pdf",
      } as any;

      const att = await requestService.addAttachment("req-101", empUser as any, dummyFile);
      expect(att.fileName).toBe("spec.pdf");
      expect(requestRepository.addAttachment).toHaveBeenCalled();
    });

    it("getActivityHistory returns timeline for request", async () => {
      vi.mocked(requestRepository.findById).mockResolvedValueOnce(draftRequest as any);
      vi.mocked(requestRepository.getActivityHistory).mockResolvedValueOnce([
        { id: "act-1", action: "CREATED" } as any,
      ]);

      const history = await requestService.getActivityHistory("req-101", empUser as any);
      expect(history).toHaveLength(1);
    });
  });

  describe("ApprovalService Unit Tests", () => {
    it("blocks requester from approving their own request", async () => {
      const step = {
        id: "step-1",
        requestId: "req-1",
        stepOrder: 1,
        status: ApprovalStatus.PENDING,
        approverRole: Role.MANAGER,
        approverId: null,
        request: {
          requesterId: mgrUser.id, // Manager is the requester!
          requester: { departmentId: "dept-eng", managerId: null },
          approvalSteps: [],
        },
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => cb(prisma));
      vi.mocked(approvalRepository.findStepById).mockResolvedValueOnce(step as any);

      await expect(
        approvalService.approveStep("step-1", mgrUser as any, "Approve")
      ).rejects.toThrow(/requesters cannot approve their own requests/i);
    });

    it("rejects approval if a preceding step is still PENDING", async () => {
      const step2 = {
        id: "step-2",
        requestId: "req-1",
        stepOrder: 2,
        status: ApprovalStatus.PENDING,
        approverRole: Role.ADMIN,
        approverId: null,
        request: {
          requesterId: empUser.id,
          requester: { departmentId: "dept-eng", managerId: "usr-mgr-1" },
          approvalSteps: [
            { id: "step-1", stepOrder: 1, status: ApprovalStatus.PENDING },
            { id: "step-2", stepOrder: 2, status: ApprovalStatus.PENDING },
          ],
        },
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => cb(prisma));
      vi.mocked(approvalRepository.findStepById).mockResolvedValueOnce(step2 as any);

      await expect(
        approvalService.approveStep("step-2", adminUser as any, "Approve step 2")
      ).rejects.toThrow(/preceding approval steps must be approved/i);
    });

    it("rejectStep requires a non-empty comment", async () => {
      await expect(
        approvalService.rejectStep("step-1", mgrUser as any, "   ")
      ).rejects.toThrow(/comment is required/i);
    });

    it("initializeApprovalSteps creates steps from flow and notifies approvers", async () => {
      vi.mocked(approvalRepository.findApprovalFlow).mockResolvedValueOnce({
        id: "flow-1",
        category: RequestCategory.IT,
        minAmount: null,
        steps: [{ id: "fs-1", flowId: "flow-1", stepOrder: 1, approverRole: Role.MANAGER }],
      } as any);
      vi.mocked(approvalRepository.createApprovalSteps).mockResolvedValueOnce({ count: 1 } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ departmentId: "dept-eng", managerId: "usr-mgr-1" } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ id: "usr-mgr-1" }] as any);

      await approvalService.initializeApprovalSteps("req-1", {
        category: RequestCategory.IT,
        amount: null,
        title: "Test Req",
        requesterId: empUser.id,
      });

      expect(approvalRepository.createApprovalSteps).toHaveBeenCalled();
      expect(notificationService.notifyMultiple).toHaveBeenCalled();
    });

    it("getPendingApprovals returns eligible active steps for manager", async () => {
      const pendingStep = {
        id: "step-1",
        stepOrder: 1,
        status: ApprovalStatus.PENDING,
        approverRole: Role.MANAGER,
        approverId: null,
        request: {
          requesterId: empUser.id,
          requester: { departmentId: "dept-eng", managerId: "usr-mgr-1" },
          approvalSteps: [{ id: "step-1", stepOrder: 1, status: ApprovalStatus.PENDING }],
        },
      };
      vi.mocked(approvalRepository.findActivePendingCandidateSteps).mockResolvedValueOnce([pendingStep as any]);

      const steps = await approvalService.getPendingApprovals(mgrUser as any);
      expect(steps).toHaveLength(1);
    });

    it("approveStep completes final step, marks request APPROVED, and auto-creates task", async () => {
      const step = {
        id: "step-1",
        requestId: "req-1",
        stepOrder: 1,
        status: ApprovalStatus.PENDING,
        approverRole: Role.MANAGER,
        approverId: null,
        request: {
          id: "req-1",
          title: "Hardware Upgrade",
          description: "New monitor",
          priority: Priority.HIGH,
          dueDate: new Date(),
          status: RequestStatus.SUBMITTED,
          requesterId: empUser.id,
          requester: { departmentId: "dept-eng", managerId: "usr-mgr-1" },
          approvalSteps: [{ id: "step-1", stepOrder: 1, status: ApprovalStatus.PENDING }],
        },
      };

      vi.mocked(approvalRepository.findStepById).mockResolvedValueOnce(step as any);
      vi.mocked(approvalRepository.updateStep).mockResolvedValueOnce({ ...step, status: ApprovalStatus.APPROVED } as any);

      const approved = await approvalService.approveStep("step-1", mgrUser as any, "Approved by manager");

      expect(approved.status).toBe(ApprovalStatus.APPROVED);
      expect(prisma.workRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: RequestStatus.APPROVED } })
      );
      expect(prisma.task.create).toHaveBeenCalled();
    });

    it("rejectStep marks step REJECTED, skips subsequent steps, and marks request REJECTED", async () => {
      const step1 = {
        id: "step-1",
        requestId: "req-1",
        stepOrder: 1,
        status: ApprovalStatus.PENDING,
        approverRole: Role.MANAGER,
        approverId: null,
        request: {
          id: "req-1",
          title: "Hardware Upgrade",
          requesterId: empUser.id,
          requester: { departmentId: "dept-eng", managerId: "usr-mgr-1" },
          approvalSteps: [
            { id: "step-1", stepOrder: 1, status: ApprovalStatus.PENDING },
            { id: "step-2", stepOrder: 2, status: ApprovalStatus.PENDING },
          ],
        },
      };

      vi.mocked(approvalRepository.findStepById).mockResolvedValueOnce(step1 as any);
      vi.mocked(approvalRepository.updateStep).mockResolvedValueOnce({ ...step1, status: ApprovalStatus.REJECTED } as any);

      const rejected = await approvalService.rejectStep("step-1", mgrUser as any, "Budget exceeded");

      expect(rejected.status).toBe(ApprovalStatus.REJECTED);
      expect(prisma.approvalStep.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: ApprovalStatus.SKIPPED } })
      );
      expect(prisma.workRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: RequestStatus.REJECTED } })
      );
    });

    it("approveStep intermediate step advances request to IN_REVIEW and notifies next approver", async () => {
      const step1 = {
        id: "step-1",
        requestId: "req-1",
        stepOrder: 1,
        status: ApprovalStatus.PENDING,
        approverRole: Role.MANAGER,
        approverId: null,
        request: {
          id: "req-1",
          title: "Large IT Purchase",
          status: RequestStatus.SUBMITTED,
          requesterId: empUser.id,
          requester: { departmentId: "dept-eng", managerId: "usr-mgr-1" },
          approvalSteps: [
            { id: "step-1", stepOrder: 1, status: ApprovalStatus.PENDING, approverRole: Role.MANAGER },
            { id: "step-2", stepOrder: 2, status: ApprovalStatus.PENDING, approverRole: Role.ADMIN },
          ],
        },
      };

      vi.mocked(approvalRepository.findStepById).mockResolvedValueOnce(step1 as any);
      vi.mocked(approvalRepository.updateStep).mockResolvedValueOnce({ ...step1, status: ApprovalStatus.APPROVED } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ id: adminUser.id }] as any);

      const approved = await approvalService.approveStep("step-1", mgrUser as any, "Manager approved");
      expect(approved.status).toBe(ApprovalStatus.APPROVED);
      expect(prisma.workRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: RequestStatus.IN_REVIEW } })
      );
    });

    it("reassignStep allows admin to delegate approval and rejects non-admin with 403", async () => {
      const step = {
        id: "step-1",
        status: ApprovalStatus.PENDING,
        approverId: null,
        request: { title: "Test Request" },
      };

      vi.mocked(approvalRepository.findStepById).mockResolvedValueOnce(step as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "usr-mgr-2", isActive: true } as any);
      vi.mocked(approvalRepository.updateStep).mockResolvedValueOnce({ ...step, approverId: "usr-mgr-2" } as any);

      const reassigned = await approvalService.reassignStep("step-1", adminUser as any, "usr-mgr-2");
      expect(reassigned.approverId).toBe("usr-mgr-2");

      // Non-admin attempt throws 403
      await expect(
        approvalService.reassignStep("step-1", empUser as any, "usr-mgr-2")
      ).rejects.toThrow(/only admins can reassign/i);
    });
  });

  describe("DocumentService Unit Tests", () => {
    it("upload stores file, creates document record in UPLOADED status, and queues OCR", async () => {
      const dummyFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "test.pdf",
        encoding: "7bit",
        mimetype: "application/pdf",
        size: 2048,
        destination: "./uploads",
        filename: "test-uuid.pdf",
        path: "./uploads/test-uuid.pdf",
        buffer: Buffer.from("pdf-data"),
        stream: null as any,
      };

      vi.mocked(storageService.save).mockResolvedValueOnce({
        relativePath: "uploads/test-uuid.pdf",
        absolutePath: "/tmp/uploads/test-uuid.pdf",
        sizeBytes: 2048,
      });
      vi.mocked(documentRepository.create).mockResolvedValueOnce({
        id: "doc-new",
        title: "Test Doc",
        status: DocStatus.UPLOADED,
      } as any);

      const result = await documentService.upload(
        dummyFile,
        {
          title: "Test Doc",
          visibility: DocVisibility.ALL,
        },
        adminUser as any
      );

      expect(result.id).toBe("doc-new");
      expect(storageService.save).toHaveBeenCalled();
      expect(documentQueue.add).toHaveBeenCalled();
    });

    it("delete deletes from database and physical storage", async () => {
      vi.mocked(documentRepository.findById).mockResolvedValueOnce({
        id: "doc-1",
        uploadedById: adminUser.id,
        filePath: "uploads/doc-1.pdf",
      } as any);
      vi.mocked(documentRepository.delete).mockResolvedValueOnce({} as any);
      vi.mocked(storageService.delete).mockResolvedValueOnce();

      await documentService.delete("doc-1", adminUser as any);

      expect(documentRepository.delete).toHaveBeenCalledWith("doc-1");
      expect(storageService.delete).toHaveBeenCalledWith("uploads/doc-1.pdf");
    });

    it("list returns accessible documents with search and pagination", async () => {
      vi.mocked(documentRepository.findMany).mockResolvedValueOnce([{ id: "doc-1", title: "Policy" } as any]);
      vi.mocked(documentRepository.count).mockResolvedValueOnce(1);

      const res = await documentService.list({ page: 1, limit: 10, search: "Policy" }, empUser as any);
      expect(res.documents).toHaveLength(1);
    });

    it("getFile returns file stream for accessible document and throws 403 for unauthorized", async () => {
      vi.mocked(documentRepository.findById).mockResolvedValueOnce({
        id: "doc-1",
        fileName: "policy.pdf",
        filePath: "uploads/doc-1.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1000,
        visibility: DocVisibility.ALL,
        departmentId: null,
        uploadedById: adminUser.id,
      } as any);
      vi.mocked(storageService.getStream).mockResolvedValueOnce("stream-data" as any);

      const file = await documentService.getFile("doc-1", empUser as any);
      expect(file.fileName).toBe("policy.pdf");

      // Unauthorized document
      vi.mocked(documentRepository.findById).mockResolvedValueOnce({
        id: "doc-secret",
        fileName: "secret.pdf",
        filePath: "uploads/secret.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1000,
        visibility: DocVisibility.ADMIN_ONLY,
        departmentId: null,
        uploadedById: adminUser.id,
      } as any);

      await expect(
        documentService.getFile("doc-secret", empUser as any)
      ).rejects.toThrow(/do not have permission to download/i);
    });

    it("reprocess resets document to UPLOADED, deletes old chunks, and queues job", async () => {
      vi.mocked(documentRepository.findById).mockResolvedValueOnce({
        id: "doc-1",
        visibility: DocVisibility.ALL,
        departmentId: null,
        uploadedById: adminUser.id,
      } as any);
      vi.mocked(documentRepository.deleteChunks).mockResolvedValueOnce();
      vi.mocked(documentRepository.update).mockResolvedValueOnce({ id: "doc-1", status: DocStatus.UPLOADED } as any);

      const res = await documentService.reprocess("doc-1", adminUser as any);
      expect(res.status).toBe(DocStatus.UPLOADED);
      expect(documentRepository.deleteChunks).toHaveBeenCalledWith("doc-1");
      expect(documentQueue.add).toHaveBeenCalled();
    });
  });

  describe("AI Retrieval & Hybrid Search Unit Tests", () => {
    it("reciprocalRankFusion computes correct reciprocal rank scores", () => {
      const vectorList = [
        { id: "c1", documentId: "d1", documentTitle: "Doc 1", chunkIndex: 0, pageNumber: 1, content: "text 1", similarityScore: 0.9, tokenCount: 10 },
        { id: "c2", documentId: "d2", documentTitle: "Doc 2", chunkIndex: 0, pageNumber: 1, content: "text 2", similarityScore: 0.8, tokenCount: 10 },
      ];
      const keywordList = [
        { id: "c2", documentId: "d2", documentTitle: "Doc 2", chunkIndex: 0, pageNumber: 1, content: "text 2", similarityScore: 0, tokenCount: 10 },
        { id: "c3", documentId: "d3", documentTitle: "Doc 3", chunkIndex: 0, pageNumber: 1, content: "text 3", similarityScore: 0, tokenCount: 10 },
      ];

      const fused = reciprocalRankFusion(vectorList, keywordList, 60);

      expect(fused.length).toBe(3);
      // c2 is in both lists, so its RRF score is 1/(60+2) + 1/(60+1) which is highest
      expect(fused[0].id).toBe("c2");
      expect(fused[0].fusedScore!).toBeGreaterThan(fused[1].fusedScore!);
    });

    it("buildPermissionFilterSql produces proper SQL restrictions per role", () => {
      const adminSql = buildPermissionFilterSql(adminUser as any);
      expect(adminSql.sql).toContain("TRUE");

      const empSql = buildPermissionFilterSql(empUser as any);
      expect(empSql.sql).toContain("visibility");

      const mgrSql = buildPermissionFilterSql(mgrUser as any);
      expect(mgrSql.sql).toContain("MANAGERS");
    });

    it("searchVectors executes vector search query against pgvector and returns parsed chunks", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
        {
          id: "chunk-1",
          documentId: "doc-1",
          chunkIndex: 0,
          pageNumber: 1,
          content: "Policy text",
          tokenCount: 20,
          documentTitle: "Policy 2026",
          similarityScore: 0.8523,
          cosineDistance: 0.1477,
        },
      ]);

      const dummyVector = new Array(1536).fill(0.01);
      const results = await retrievalService.searchVectors(dummyVector, empUser as any, 5);

      expect(results).toHaveLength(1);
      expect(results[0].documentTitle).toBe("Policy 2026");
      expect(results[0].similarityScore).toBe(0.8523);
    });

    it("searchFullText executes PostgreSQL ts_rank query and returns ranked chunks", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
        {
          id: "chunk-2",
          documentId: "doc-2",
          chunkIndex: 0,
          pageNumber: 2,
          content: "Leave days entitlement",
          tokenCount: 15,
          documentTitle: "Leave Guide",
          textRank: 0.92,
        },
      ]);

      const results = await retrievalService.searchFullText("leave entitlement", empUser as any, 5);

      expect(results).toHaveLength(1);
      expect(results[0].documentTitle).toBe("Leave Guide");
    });

    it("retrieve combines vector and fulltext searches via hybrid mode", async () => {
      vi.spyOn(retrievalService, "searchVectors").mockResolvedValueOnce([
        { id: "c1", documentId: "d1", documentTitle: "Doc 1", chunkIndex: 0, pageNumber: 1, content: "text 1", similarityScore: 0.9, tokenCount: 10 },
      ]);
      vi.spyOn(retrievalService, "searchFullText").mockResolvedValueOnce([
        { id: "c1", documentId: "d1", documentTitle: "Doc 1", chunkIndex: 0, pageNumber: 1, content: "text 1", similarityScore: 0, tokenCount: 10 },
      ]);

      const { results } = await retrievalService.retrieve("test query", empUser as any, { topK: 5, hybrid: true });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].id).toBe("c1");
    });
  });

  describe("ChatService Unit Tests", () => {
    it("streamChat returns 'not found' message immediately if no relevant chunks meet threshold", async () => {
      vi.mocked(prisma.chatSession.create).mockResolvedValueOnce({ id: "ses-1", userId: empUser.id, title: "Query" } as any);
      vi.mocked(prisma.chatMessage.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.chatMessage.create).mockResolvedValueOnce({ id: "msg-user-1" } as any);
      vi.spyOn(retrievalService, "retrieve").mockResolvedValueOnce({ results: [] });
      vi.mocked(prisma.chatMessage.create).mockResolvedValueOnce({ id: "msg-asst-1" } as any);

      const tokens: string[] = [];
      const citationsReceived: any[] = [];

      const result = await chatService.streamChat(
        empUser as any,
        "Unknown topic",
        undefined,
        {
          onToken: (t) => tokens.push(t),
          onCitations: (c) => citationsReceived.push(...c),
        }
      );

      expect(result.notFound).toBe(true);
      expect(tokens[0]).toContain("couldn't find this in the company documents");
    });

    it("streamChat answer path streams tokens, extracts citations, and saves assistant message", async () => {
      vi.mocked(prisma.chatSession.findUnique).mockResolvedValueOnce({ id: "ses-existing", userId: empUser.id, title: "Existing" } as any);
      vi.mocked(prisma.chatMessage.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.chatMessage.create).mockResolvedValueOnce({ id: "msg-u-1" } as any);

      const matchingChunk = {
        id: "chunk-match",
        documentId: "doc-leave",
        documentTitle: "Leave Policy",
        chunkIndex: 0,
        pageNumber: 2,
        content: "Employees receive 20 days paid annual leave.",
        tokenCount: 10,
        similarityScore: 0.88,
      };
      vi.spyOn(retrievalService, "retrieve").mockResolvedValueOnce({ results: [matchingChunk] });

      const tokens: string[] = [];
      let citationsEmitted: any[] = [];

      vi.mocked(prisma.chatMessage.create).mockResolvedValueOnce({ id: "msg-a-1" } as any);

      const result = await chatService.streamChat(
        empUser as any,
        "How many leave days?",
        "ses-existing",
        {
          onToken: (t) => tokens.push(t),
          onCitations: (c) => { citationsEmitted = c; },
        }
      );

      expect(result.notFound).toBe(false);
      expect(tokens.length).toBeGreaterThan(0);
      expect(result.citations).toBeDefined();
    });

    it("getUserSessions returns all sessions for user", async () => {
      vi.mocked(prisma.chatSession.findMany).mockResolvedValueOnce([
        { id: "s1", userId: empUser.id, title: "Session 1" } as any,
      ]);

      const sessions = await chatService.getUserSessions(empUser.id);
      expect(sessions).toHaveLength(1);
    });

    it("getSessionById returns session for owner and rejects unauthorized user with 403", async () => {
      vi.mocked(prisma.chatSession.findUnique).mockResolvedValueOnce({
        id: "s1",
        userId: empUser.id,
        title: "Session 1",
        messages: [],
      } as any);

      const session = await chatService.getSessionById("s1", empUser.id);
      expect(session.id).toBe("s1");

      // Attempt view with another user
      vi.mocked(prisma.chatSession.findUnique).mockResolvedValueOnce({
        id: "s1",
        userId: empUser.id,
        title: "Session 1",
        messages: [],
      } as any);

      await expect(
        chatService.getSessionById("s1", "other-user-id")
      ).rejects.toThrow(/do not have access to this chat session/i);
    });

    it("renameSession renames session for owner and rejects unauthorized user with 403", async () => {
      vi.mocked(prisma.chatSession.findUnique).mockResolvedValueOnce({ id: "s1", userId: empUser.id } as any);
      vi.mocked(prisma.chatSession.update).mockResolvedValueOnce({ id: "s1", title: "New Name" } as any);

      const updated = await chatService.renameSession("s1", empUser.id, "New Name");
      expect(updated.title).toBe("New Name");

      // Attempt rename by other user
      vi.mocked(prisma.chatSession.findUnique).mockResolvedValueOnce({ id: "s1", userId: empUser.id } as any);

      await expect(
        chatService.renameSession("s1", "other-user", "Hacked Title")
      ).rejects.toThrow(/do not have access to this chat session/i);
    });

    it("deleteSession deletes session for owner and rejects unauthorized user with 403", async () => {
      vi.mocked(prisma.chatSession.findUnique).mockResolvedValueOnce({ id: "s1", userId: empUser.id } as any);
      vi.mocked(prisma.chatSession.delete).mockResolvedValueOnce({ id: "s1" } as any);

      await chatService.deleteSession("s1", empUser.id);
      expect(prisma.chatSession.delete).toHaveBeenCalledWith({ where: { id: "s1" } });

      // Attempt delete by other user
      vi.mocked(prisma.chatSession.findUnique).mockResolvedValueOnce({ id: "s1", userId: empUser.id } as any);

      await expect(
        chatService.deleteSession("s1", "other-user")
      ).rejects.toThrow(/do not have access to this chat session/i);
    });

    it("submitFeedback updates message feedback for owner and rejects other user with 403", async () => {
      vi.mocked(prisma.chatMessage.findUnique).mockResolvedValueOnce({
        id: "m1",
        session: { userId: empUser.id },
      } as any);
      vi.mocked(prisma.chatMessage.update).mockResolvedValueOnce({ id: "m1", feedback: 1 } as any);

      const res = await chatService.submitFeedback("m1", empUser.id, 1);
      expect(res.feedback).toBe(1);

      // Attempt feedback by another user
      vi.mocked(prisma.chatMessage.findUnique).mockResolvedValueOnce({
        id: "m1",
        session: { userId: empUser.id },
      } as any);

      await expect(
        chatService.submitFeedback("m1", "other-user", -1)
      ).rejects.toThrow(/do not have access to this message/i);
    });
  });

  describe("Embeddings & LLM Provider Unit Tests", () => {
    it("MockEmbeddingsProvider generates 1536-dimensional normalized vectors", async () => {
      const provider = new MockEmbeddingsProvider();
      const vec = await provider.embedQuery("Leave Policy");

      expect(vec).toHaveLength(1536);

      // Verify L2 unit norm sum(v^2) ~ 1.0
      const normSquared = vec.reduce((sum, v) => sum + v * v, 0);
      expect(normSquared).toBeCloseTo(1.0, 1);
    });

    it("formatVectorForPg formats vector into PostgreSQL pgvector string format", () => {
      const dummyVec = new Array(1536).fill(0.123);
      const formatted = formatVectorForPg(dummyVec);

      expect(formatted.startsWith("[")).toBe(true);
      expect(formatted.endsWith("]")).toBe(true);
      expect(formatted).toContain("0.123");

      // Dimension mismatch throws
      expect(() => formatVectorForPg([0.1, 0.2])).toThrow(/dimension mismatch/i);
    });

    it("MockLLMProvider handles mid-stream error properly", async () => {
      const mockLLM = new MockLLMProvider();
      mockLLM.setErrorMidStream(true, "Stream broke abruptly");

      const streamRes = await mockLLM.stream({
        systemPrompt: "system",
        messages: [{ role: "user", content: "test" }],
      });

      const tokens: string[] = [];
      await expect(async () => {
        for await (const t of streamRes.textStream) {
          tokens.push(t);
        }
      }).rejects.toThrow("Stream broke abruptly");

      // Verify tokens were emitted before error
      expect(tokens.length).toBeGreaterThanOrEqual(1);
    });

    it("sanitizeAnthropicMessages ensures messages start with user and alternate roles", () => {
      const rawMessages: Array<{ role: "user" | "assistant"; content: string }> = [
        { role: "assistant", content: "Initial greeting" },
        { role: "user", content: "First query" },
        { role: "user", content: "Second query in a row" },
      ];

      const sanitized = sanitizeAnthropicMessages(rawMessages);

      expect(sanitized[0].role).toBe("user");
      // Consecutive user messages should be joined
      expect(sanitized[sanitized.length - 1].content).toContain("First query\n\nSecond query in a row");
    });
  });

  describe("Storage Service Unit Tests", () => {
    it("S3StorageService throws not implemented for methods", async () => {
      const { S3StorageService } = await vi.importActual<any>("../../src/lib/storage");
      const s3 = new S3StorageService("my-bucket");

      expect(s3.getFullPath("file.pdf")).toBe("s3://my-bucket/file.pdf");
      await expect(s3.save(Buffer.from("abc"), "test.txt")).rejects.toThrow(/not yet implemented/i);
      await expect(s3.read("file.pdf")).rejects.toThrow(/not yet implemented/i);
      await expect(s3.getStream("file.pdf")).rejects.toThrow(/not yet implemented/i);
      await expect(s3.delete("file.pdf")).rejects.toThrow(/not yet implemented/i);
      await expect(s3.exists("file.pdf")).rejects.toThrow(/not yet implemented/i);
    });
  });
});
