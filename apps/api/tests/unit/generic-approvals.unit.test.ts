import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  Role,
  ApprovalStatus,
  RequestStatus,
  TaskStatus,
  RequestCategory,
} from "@prisma/client";
import { ApprovalService } from "../../src/modules/approvals/approval.service";
import { ApprovalRepository } from "../../src/modules/approvals/approval.repository";
import { ApprovalEscalationService } from "../../src/modules/approvals/approval-escalation.service";
import { approvalHandlerRegistry } from "../../src/modules/approvals/handlers/approval-handler.registry";
import type {
  ApprovalEntityHandler,
  ApprovalEntityDetails,
  OnStepApprovedParams,
  OnFinalApprovedParams,
  OnRejectedParams,
} from "../../src/modules/approvals/handlers/approval-handler.interface";
import { prisma } from "../../src/lib/prisma";
import { notificationService } from "../../src/modules/notifications/notification.service";
import { auditService } from "../../src/modules/audit/audit.service";

vi.mock("../../src/lib/prisma", () => {
  const mockClient: any = {
    $transaction: vi.fn(async (cb: any) => cb(mockClient)),
    approvalStep: {
      createMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    approvalFlow: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    workRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    task: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
  return { prisma: mockClient };
});

vi.mock("../../src/modules/notifications/notification.service", () => ({
  notificationService: {
    notify: vi.fn(),
    notifyMultiple: vi.fn(),
  },
}));

vi.mock("../../src/modules/audit/audit.service", () => ({
  auditService: {
    log: vi.fn(),
  },
}));

describe("Approval System - WorkRequest Regression & Generic Entity Tests", () => {
  let approvalService: ApprovalService;
  let escalationService: ApprovalEscalationService;

  const requesterUser = {
    id: "usr-emp-1",
    name: "Employee Jane",
    email: "jane@nexusops.com",
    role: Role.EMPLOYEE,
    departmentId: "dept-engineering",
    managerId: "usr-mgr-1",
    isActive: true,
  };

  const managerUser = {
    id: "usr-mgr-1",
    name: "Manager Mark",
    email: "mark@nexusops.com",
    role: Role.MANAGER,
    departmentId: "dept-engineering",
    managerId: null,
    isActive: true,
  };

  const adminUser = {
    id: "usr-admin-1",
    name: "Admin Alice",
    email: "alice@nexusops.com",
    role: Role.ADMIN,
    departmentId: null,
    managerId: null,
    isActive: true,
  };

  const otherUser = {
    id: "usr-other-1",
    name: "Other User",
    email: "other@nexusops.com",
    role: Role.EMPLOYEE,
    departmentId: "dept-finance",
    managerId: null,
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    approvalHandlerRegistry.reset();
    approvalService = new ApprovalService();
    escalationService = new ApprovalEscalationService();
  });

  describe("PART 1: Regression Tests for WorkRequest (Behavior Unchanged)", () => {
    const requestId = "req-0000-0000-0000-000000000001";
    const baseRequest = {
      id: requestId,
      title: "New Dev Laptop",
      description: "MacBook Pro M3 Max for development",
      category: RequestCategory.IT,
      priority: "HIGH" as const,
      status: RequestStatus.SUBMITTED,
      amount: "250000",
      dueDate: new Date("2026-12-01"),
      requesterId: requesterUser.id,
      requester: requesterUser,
      flowId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("initializes multi-step approval steps for WorkRequest with entityType 'REQUEST'", async () => {
      // Mock flow matching
      (prisma.approvalFlow.findMany as any).mockResolvedValue([
        {
          id: "flow-it-high",
          name: "High Value IT",
          category: RequestCategory.IT,
          minAmount: 100000,
          maxAmount: null,
          isActive: true,
          steps: [
            { stepOrder: 1, approverRole: Role.MANAGER, approverId: null },
            { stepOrder: 2, approverRole: Role.ADMIN, approverId: null },
          ],
        },
      ]);

      (prisma.user.findUnique as any).mockResolvedValue(requesterUser);
      (prisma.user.findMany as any).mockResolvedValue([managerUser]);
      (prisma.approvalStep.createMany as any).mockResolvedValue({ count: 2 });
      (prisma.workRequest.update as any).mockResolvedValue({ ...baseRequest, flowId: "flow-it-high" });

      await approvalService.initializeApprovalSteps(requestId, {
        category: RequestCategory.IT,
        amount: 250000 as any,
        title: baseRequest.title,
        requesterId: requesterUser.id,
      });

      expect(prisma.approvalStep.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            entityType: "REQUEST",
            entityId: requestId,
            requestId,
            stepOrder: 1,
            approverRole: Role.MANAGER,
            status: ApprovalStatus.PENDING,
          }),
          expect.objectContaining({
            entityType: "REQUEST",
            entityId: requestId,
            requestId,
            stepOrder: 2,
            approverRole: Role.ADMIN,
            status: ApprovalStatus.PENDING,
          }),
        ],
      });

      // Notifies first approvers
      expect(notificationService.notifyMultiple).toHaveBeenCalledWith(
        [managerUser.id],
        "APPROVAL_REQUESTED",
        "Approval Requested",
        expect.stringContaining(baseRequest.title),
        `/requests/${requestId}`,
        "WorkRequest",
        requestId
      );
    });

    it("executes multi-step approval to final approval, auto-creating fulfillment task", async () => {
      const step1 = {
        id: "step-1",
        entityType: "REQUEST",
        entityId: requestId,
        requestId,
        stepOrder: 1,
        approverRole: Role.MANAGER,
        approverId: null,
        status: ApprovalStatus.PENDING,
        comment: null,
        decidedAt: null,
        activatedAt: new Date(),
        escalatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        request: {
          ...baseRequest,
          approvalSteps: [
            { id: "step-1", stepOrder: 1, status: ApprovalStatus.PENDING },
            { id: "step-2", stepOrder: 2, status: ApprovalStatus.PENDING },
          ],
        },
      };

      const step2 = {
        id: "step-2",
        entityType: "REQUEST",
        entityId: requestId,
        requestId,
        stepOrder: 2,
        approverRole: Role.ADMIN,
        approverId: null,
        status: ApprovalStatus.PENDING,
        comment: null,
        decidedAt: null,
        activatedAt: null,
        escalatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        request: {
          ...baseRequest,
          status: RequestStatus.IN_REVIEW,
          approvalSteps: [
            { id: "step-1", stepOrder: 1, status: ApprovalStatus.APPROVED },
            { id: "step-2", stepOrder: 2, status: ApprovalStatus.PENDING },
          ],
        },
      };

      // Step 1 approval by Manager
      (prisma.approvalStep.findUnique as any).mockResolvedValue(step1);
      (prisma.workRequest.findUnique as any).mockResolvedValue(baseRequest);
      (prisma.approvalStep.update as any).mockImplementation(({ data }: any) => ({
        ...step1,
        ...data,
      }));
      (prisma.user.findMany as any).mockResolvedValue([adminUser]);

      const res1 = await approvalService.approveStep("step-1", managerUser as any, "Looks good");
      expect(res1.status).toBe(ApprovalStatus.APPROVED);

      // Intermediate step: sets activatedAt on step-2 and moves request to IN_REVIEW
      expect(prisma.approvalStep.update).toHaveBeenCalledWith({
        where: { id: "step-2" },
        data: { activatedAt: expect.any(Date) },
      });
      expect(prisma.workRequest.update).toHaveBeenCalledWith({
        where: { id: requestId },
        data: { status: RequestStatus.IN_REVIEW },
      });

      // Step 2 approval by Admin (final step)
      (prisma.approvalStep.findUnique as any).mockResolvedValue(step2);
      (prisma.workRequest.findUnique as any).mockResolvedValue({
        ...baseRequest,
        status: RequestStatus.IN_REVIEW,
      });
      const createdTask = {
        id: "task-auto-1",
        title: `Fulfill Request: ${baseRequest.title}`,
        status: TaskStatus.TODO,
      };
      (prisma.task.create as any).mockResolvedValue(createdTask);

      const res2 = await approvalService.approveStep("step-2", adminUser as any, "Approved by executive");
      expect(res2.status).toBe(ApprovalStatus.APPROVED);

      // Final step: updates request to APPROVED and creates task
      expect(prisma.workRequest.update).toHaveBeenCalledWith({
        where: { id: requestId },
        data: { status: RequestStatus.APPROVED },
      });

      expect(prisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: `Fulfill Request: ${baseRequest.title}`,
          requestId,
          status: TaskStatus.TODO,
        }),
      });

      // Audit logs written
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "REQUEST_APPROVED",
          entityType: "WorkRequest",
          entityId: requestId,
        })
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TASK_CREATED",
          entityType: "Task",
          entityId: createdTask.id,
        })
      );

      // Notifies requester
      expect(notificationService.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: requesterUser.id,
          type: "APPROVAL_DECISION",
          title: "Request Approved",
          link: `/requests/${requestId}`,
          entityType: "WorkRequest",
          entityId: requestId,
        })
      );
    });

    it("rejects approval step with comment, marking request REJECTED and remaining steps SKIPPED", async () => {
      const step1 = {
        id: "step-1",
        entityType: "REQUEST",
        entityId: requestId,
        requestId,
        stepOrder: 1,
        approverRole: Role.MANAGER,
        approverId: null,
        status: ApprovalStatus.PENDING,
        comment: null,
        decidedAt: null,
        activatedAt: new Date(),
        escalatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        request: {
          ...baseRequest,
          approvalSteps: [
            { id: "step-1", stepOrder: 1, status: ApprovalStatus.PENDING },
            { id: "step-2", stepOrder: 2, status: ApprovalStatus.PENDING },
          ],
        },
      };

      (prisma.approvalStep.findUnique as any).mockResolvedValue(step1);
      (prisma.workRequest.findUnique as any).mockResolvedValue(baseRequest);
      (prisma.approvalStep.update as any).mockImplementation(({ data }: any) => ({
        ...step1,
        ...data,
      }));

      // Rejecting without comment throws Bad Request
      await expect(
        approvalService.rejectStep("step-1", managerUser as any, "  ")
      ).rejects.toThrow("Comment is required when rejecting an approval step");

      // Rejecting with comment succeeds
      const res = await approvalService.rejectStep(
        "step-1",
        managerUser as any,
        "Budget exceeded for Q4"
      );
      expect(res.status).toBe(ApprovalStatus.REJECTED);

      // Subsequent steps skipped
      expect(prisma.approvalStep.updateMany).toHaveBeenCalledWith({
        where: {
          requestId,
          stepOrder: { gt: 1 },
        },
        data: {
          status: ApprovalStatus.SKIPPED,
        },
      });

      // Request marked REJECTED
      expect(prisma.workRequest.update).toHaveBeenCalledWith({
        where: { id: requestId },
        data: { status: RequestStatus.REJECTED },
      });

      // Notifies requester of rejection
      expect(notificationService.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: requesterUser.id,
          type: "APPROVAL_DECISION",
          title: "Request Rejected",
          message: expect.stringContaining("Budget exceeded for Q4"),
          link: `/requests/${requestId}`,
        })
      );
    });

    it("blocks requester self-approval (403 Forbidden)", async () => {
      const step = {
        id: "step-1",
        entityType: "REQUEST",
        entityId: requestId,
        requestId,
        stepOrder: 1,
        approverRole: Role.EMPLOYEE,
        approverId: null,
        status: ApprovalStatus.PENDING,
        request: {
          ...baseRequest,
          requesterId: requesterUser.id,
          approvalSteps: [{ id: "step-1", stepOrder: 1, status: ApprovalStatus.PENDING }],
        },
      };

      (prisma.approvalStep.findUnique as any).mockResolvedValue(step);
      (prisma.workRequest.findUnique as any).mockResolvedValue(baseRequest);

      await expect(
        approvalService.approveStep("step-1", requesterUser as any)
      ).rejects.toThrow("Requesters cannot approve their own requests");
    });

    it("blocks out-of-order approval when preceding steps are not approved (400 Bad Request)", async () => {
      const step2 = {
        id: "step-2",
        entityType: "REQUEST",
        entityId: requestId,
        requestId,
        stepOrder: 2,
        approverRole: Role.ADMIN,
        approverId: null,
        status: ApprovalStatus.PENDING,
        request: {
          ...baseRequest,
          approvalSteps: [
            { id: "step-1", stepOrder: 1, status: ApprovalStatus.PENDING }, // not yet approved!
            { id: "step-2", stepOrder: 2, status: ApprovalStatus.PENDING },
          ],
        },
      };

      (prisma.approvalStep.findUnique as any).mockResolvedValue(step2);
      (prisma.workRequest.findUnique as any).mockResolvedValue(baseRequest);

      await expect(
        approvalService.approveStep("step-2", adminUser as any)
      ).rejects.toThrow("Cannot approve out-of-order step");
    });

    it("bulk approves steps with granular success and failure reporting", async () => {
      const step1 = {
        id: "step-1",
        entityType: "REQUEST",
        entityId: requestId,
        requestId,
        stepOrder: 1,
        approverRole: Role.MANAGER,
        status: ApprovalStatus.PENDING,
        request: {
          ...baseRequest,
          approvalSteps: [{ id: "step-1", stepOrder: 1, status: ApprovalStatus.PENDING }],
        },
      };

      (prisma.approvalStep.findUnique as any)
        .mockResolvedValueOnce(step1)
        .mockResolvedValueOnce(null); // Second step not found

      (prisma.workRequest.findUnique as any).mockResolvedValue(baseRequest);
      (prisma.approvalStep.update as any).mockResolvedValue({
        ...step1,
        status: ApprovalStatus.APPROVED,
      });
      (prisma.task.create as any).mockResolvedValue({ id: "t-1" });

      const bulkResult = await approvalService.bulkApproveSteps(
        ["step-1", "step-invalid"],
        adminUser as any,
        "Bulk approval note"
      );

      expect(bulkResult.summary).toEqual({
        total: 2,
        succeeded: 1,
        failed: 1,
      });
      expect(bulkResult.results[0].success).toBe(true);
      expect(bulkResult.results[1].success).toBe(false);
      expect(bulkResult.results[1].error).toContain("Approval step not found");
    });

    it("escalates overdue pending WorkRequest step, notifying admins with /requests link", async () => {
      const overdueStep = {
        id: "step-overdue-1",
        entityType: "REQUEST",
        entityId: requestId,
        requestId,
        stepOrder: 1,
        approverRole: Role.MANAGER,
        approverId: null,
        status: ApprovalStatus.PENDING,
        activatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48h ago
        escalatedAt: null,
        request: {
          ...baseRequest,
          approvalSteps: [{ id: "step-overdue-1", stepOrder: 1, status: ApprovalStatus.PENDING }],
        },
      };

      (prisma.approvalStep.findMany as any).mockResolvedValue([overdueStep]);
      (prisma.approvalStep.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.workRequest.findUnique as any).mockResolvedValue(baseRequest);
      (prisma.user.findMany as any).mockImplementation(({ where }: any) => {
        if (where?.role === Role.ADMIN) return [adminUser];
        return [managerUser];
      });

      const res = await escalationService.checkAndEscalateOverdueApprovals(24);
      expect(res.escalatedCount).toBe(1);
      expect(res.escalatedStepIds).toContain("step-overdue-1");

      // Admin escalation notification
      expect(notificationService.notifyMultiple).toHaveBeenCalledWith(
        [adminUser.id],
        "APPROVAL_ESCALATED",
        "Approval Overdue Escalation",
        expect.stringContaining('request "New Dev Laptop" is overdue'),
        `/requests/${requestId}`,
        "WorkRequest",
        requestId
      );
    });
  });

  describe("PART 2: Generic Entity Approval Path (Test-Only Custom Entity)", () => {
    const testItemId = "test-doc-999";

    // Custom test entity state store to verify lifecycle hooks
    let testEntityState: {
      status: string;
      approvedBy?: string;
      finalApproved: boolean;
      rejectedReason?: string;
    };

    let testEntityHandler: ApprovalEntityHandler;

    beforeEach(() => {
      testEntityState = {
        status: "SUBMITTED",
        finalApproved: false,
      };

      // Define and register a test-only handler for "TEST_DOC"
      testEntityHandler = {
        entityType: "TEST_DOC",
        getEntityTypeName: () => "TestDocument",
        getLink: (id: string) => `/test-documents/${id}`,
        getEntityDetails: async (id: string): Promise<ApprovalEntityDetails | null> => {
          return {
            id,
            title: `Q4 Compliance Audit Report #${id}`,
            description: "Annual security & compliance review document",
            requesterId: requesterUser.id,
            requester: requesterUser,
            status: testEntityState.status,
            link: `/test-documents/${id}`,
            metadata: { customField: "audit" },
          };
        },
        onStepApproved: async (params: OnStepApprovedParams) => {
          testEntityState.status = "IN_PROGRESS";
        },
        onFinalApproved: async (params: OnFinalApprovedParams) => {
          testEntityState.status = "COMPLETED";
          testEntityState.finalApproved = true;
          testEntityState.approvedBy = params.user.id;
        },
        onRejected: async (params: OnRejectedParams) => {
          testEntityState.status = "REJECTED";
          testEntityState.rejectedReason = params.comment;
        },
      };

      approvalHandlerRegistry.register(testEntityHandler);
    });

    it("initializes generic approval steps for TEST_DOC without requiring WorkRequest", async () => {
      (prisma.approvalStep.createMany as any).mockResolvedValue({ count: 2 });
      (prisma.user.findUnique as any).mockResolvedValue(requesterUser);
      (prisma.user.findMany as any).mockResolvedValue([managerUser]);

      await approvalService.initializeApprovalStepsForEntity({
        entityType: "TEST_DOC",
        entityId: testItemId,
        title: "Q4 Compliance Audit Report",
        requesterId: requesterUser.id,
        steps: [
          { stepOrder: 1, approverRole: Role.MANAGER, approverId: null },
          { stepOrder: 2, approverRole: Role.ADMIN, approverId: null },
        ],
      });

      expect(prisma.approvalStep.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            entityType: "TEST_DOC",
            entityId: testItemId,
            requestId: null,
            stepOrder: 1,
            approverRole: Role.MANAGER,
            status: ApprovalStatus.PENDING,
          }),
          expect.objectContaining({
            entityType: "TEST_DOC",
            entityId: testItemId,
            requestId: null,
            stepOrder: 2,
            approverRole: Role.ADMIN,
            status: ApprovalStatus.PENDING,
          }),
        ],
      });

      // Verifies notification uses custom link and entity name
      expect(notificationService.notifyMultiple).toHaveBeenCalledWith(
        [managerUser.id],
        "APPROVAL_REQUESTED",
        "Approval Requested",
        expect.stringContaining("Q4 Compliance Audit Report"),
        `/test-documents/${testItemId}`,
        "TestDocument",
        testItemId
      );
    });

    it("executes generic approval path invoking custom onStepApproved and onFinalApproved callbacks", async () => {
      const genericStep1 = {
        id: "step-td-1",
        entityType: "TEST_DOC",
        entityId: testItemId,
        requestId: null,
        stepOrder: 1,
        approverRole: Role.MANAGER,
        approverId: null,
        status: ApprovalStatus.PENDING,
        activatedAt: new Date(),
        escalatedAt: null,
        request: null,
      };

      const genericStep2 = {
        id: "step-td-2",
        entityType: "TEST_DOC",
        entityId: testItemId,
        requestId: null,
        stepOrder: 2,
        approverRole: Role.ADMIN,
        approverId: null,
        status: ApprovalStatus.PENDING,
        activatedAt: null,
        escalatedAt: null,
        request: null,
      };

      const siblingSteps = [
        { id: "step-td-1", stepOrder: 1, status: ApprovalStatus.PENDING },
        { id: "step-td-2", stepOrder: 2, status: ApprovalStatus.PENDING },
      ];

      (prisma.approvalStep.findMany as any).mockResolvedValue(siblingSteps);
      (prisma.approvalStep.findUnique as any).mockResolvedValue(genericStep1);
      (prisma.approvalStep.update as any).mockImplementation(({ data }: any) => ({
        ...genericStep1,
        ...data,
      }));

      // 1. Approve intermediate step 1
      const res1 = await approvalService.approveStep("step-td-1", managerUser as any, "Manager approved review");
      expect(res1.status).toBe(ApprovalStatus.APPROVED);

      // Verifies onStepApproved callback executed
      expect(testEntityState.status).toBe("IN_PROGRESS");
      expect(prisma.approvalStep.update).toHaveBeenCalledWith({
        where: { id: "step-td-2" },
        data: { activatedAt: expect.any(Date) },
      });

      // 2. Approve final step 2
      const updatedSiblings = [
        { id: "step-td-1", stepOrder: 1, status: ApprovalStatus.APPROVED },
        { id: "step-td-2", stepOrder: 2, status: ApprovalStatus.PENDING },
      ];
      (prisma.approvalStep.findMany as any).mockResolvedValue(updatedSiblings);
      (prisma.approvalStep.findUnique as any).mockResolvedValue(genericStep2);

      const res2 = await approvalService.approveStep("step-td-2", adminUser as any, "Final signoff granted");
      expect(res2.status).toBe(ApprovalStatus.APPROVED);

      // Verifies onFinalApproved callback executed
      expect(testEntityState.finalApproved).toBe(true);
      expect(testEntityState.status).toBe("COMPLETED");
      expect(testEntityState.approvedBy).toBe(adminUser.id);

      // Verifies generic audit logging for step decision
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "APPROVAL_STEP_APPROVED",
          entityType: "ApprovalStep",
          entityId: "step-td-2",
          metadata: expect.objectContaining({
            entityType: "TEST_DOC",
            entityId: testItemId,
          }),
        })
      );
    });

    it("executes generic rejection path invoking custom onRejected callback and skipping subsequent steps", async () => {
      const genericStep1 = {
        id: "step-td-1",
        entityType: "TEST_DOC",
        entityId: testItemId,
        requestId: null,
        stepOrder: 1,
        approverRole: Role.MANAGER,
        approverId: null,
        status: ApprovalStatus.PENDING,
        request: null,
      };

      const siblingSteps = [
        { id: "step-td-1", stepOrder: 1, status: ApprovalStatus.PENDING },
        { id: "step-td-2", stepOrder: 2, status: ApprovalStatus.PENDING },
      ];

      (prisma.approvalStep.findMany as any).mockResolvedValue(siblingSteps);
      (prisma.approvalStep.findUnique as any).mockResolvedValue(genericStep1);
      (prisma.approvalStep.update as any).mockImplementation(({ data }: any) => ({
        ...genericStep1,
        ...data,
      }));

      const res = await approvalService.rejectStep(
        "step-td-1",
        managerUser as any,
        "Documentation failed compliance standards"
      );

      expect(res.status).toBe(ApprovalStatus.REJECTED);

      // Custom onRejected callback was invoked
      expect(testEntityState.status).toBe("REJECTED");
      expect(testEntityState.rejectedReason).toBe("Documentation failed compliance standards");

      // Subsequent steps marked SKIPPED by (entityType, entityId)
      expect(prisma.approvalStep.updateMany).toHaveBeenCalledWith({
        where: {
          entityType: "TEST_DOC",
          entityId: testItemId,
          stepOrder: { gt: 1 },
        },
        data: {
          status: ApprovalStatus.SKIPPED,
        },
      });
    });

    it("includes generic entity items in getPendingApprovals with correct title and link", async () => {
      const genericStep = {
        id: "step-td-pending",
        entityType: "TEST_DOC",
        entityId: testItemId,
        requestId: null,
        stepOrder: 1,
        approverRole: Role.MANAGER,
        approverId: null,
        status: ApprovalStatus.PENDING,
        createdAt: new Date(),
        request: null,
      };

      (prisma.approvalStep.findMany as any)
        .mockResolvedValueOnce([genericStep]) // findActivePendingCandidateSteps
        .mockResolvedValueOnce([genericStep]); // findSiblingSteps

      const pending = await approvalService.getPendingApprovals(managerUser as any);
      expect(pending).toHaveLength(1);
      expect(pending[0].entityType).toBe("TEST_DOC");
      expect(pending[0].entityId).toBe(testItemId);
      expect(pending[0].itemTitle).toBe(`Q4 Compliance Audit Report #${testItemId}`);
      expect(pending[0].itemLink).toBe(`/test-documents/${testItemId}`);
    });

    it("throws a clear error when operating on an unregistered entity type", async () => {
      const unknownStep = {
        id: "step-unknown",
        entityType: "UNKNOWN_TYPE_XYZ",
        entityId: "xyz-1",
        requestId: null,
        stepOrder: 1,
        approverRole: Role.ADMIN,
        status: ApprovalStatus.PENDING,
      };

      (prisma.approvalStep.findUnique as any).mockResolvedValue(unknownStep);

      await expect(
        approvalService.approveStep("step-unknown", adminUser as any)
      ).rejects.toThrow("Unsupported approval entity type: UNKNOWN_TYPE_XYZ");
    });
  });
});
