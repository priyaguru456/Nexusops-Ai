import { describe, it, expect, vi, beforeEach } from "vitest";
import { RequestCategory, Role, RequestStatus } from "@prisma/client";
import {
  ApprovalFlowService,
  checkIntervalOverlap,
} from "../../src/modules/approvals/approval-flow.service";
import { ApprovalRepository } from "../../src/modules/approvals/approval.repository";
import { ApprovalService } from "../../src/modules/approvals/approval.service";
import { approvalFlowController } from "../../src/modules/approvals/approval-flow.controller";
import { authorize } from "../../src/middleware/auth";
import { prisma } from "../../src/lib/prisma";
import { notificationService } from "../../src/modules/notifications/notification.service";
import { auditService } from "../../src/modules/audit/audit.service";
import type { Request, Response, NextFunction } from "express";

vi.mock("../../src/lib/prisma", () => {
  const mockClient = {
    $transaction: vi.fn(async (cb: any) => cb(mockClient)),
    approvalFlow: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    approvalFlowStep: {
      deleteMany: vi.fn(),
    },
    approvalStep: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    workRequest: {
      count: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      createMany: vi.fn(),
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

const createMockResponse = () => {
  const res: Partial<Response> & { statusCode?: number; body?: any } = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res as Response;
  };
  res.json = (data: any) => {
    res.body = data;
    return res as Response;
  };
  return res as Response & { statusCode: number; body: any };
};

describe("Configurable Approval Workflows - Unit Tests", () => {
  let flowService: ApprovalFlowService;
  let repo: ApprovalRepository;
  let approvalService: ApprovalService;

  const adminUser = {
    id: "usr-admin-1",
    name: "Admin Alice",
    email: "admin@nexusops.com",
    role: Role.ADMIN,
    organizationId: "00000000-0000-4000-8000-000000000001",
    departmentId: "dept-it",
    isActive: true,
  };

  const managerUser = {
    id: "usr-mgr-1",
    name: "Manager Bob",
    email: "manager@nexusops.com",
    role: Role.MANAGER,
    organizationId: "00000000-0000-4000-8000-000000000001",
    departmentId: "dept-it",
    isActive: true,
  };

  const employeeUser = {
    id: "usr-emp-1",
    name: "Employee Charlie",
    email: "emp@nexusops.com",
    role: Role.EMPLOYEE,
    organizationId: "00000000-0000-4000-8000-000000000001",
    departmentId: "dept-it",
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    flowService = new ApprovalFlowService();
    repo = new ApprovalRepository();
    approvalService = new ApprovalService();
  });

  describe("1. Interval Overlap Mathematical Detection", () => {
    it("detects overlap when ranges partially intersect", () => {
      expect(
        checkIntervalOverlap({ minAmount: 0, maxAmount: 1000 }, { minAmount: 500, maxAmount: 2000 })
      ).toBe(true);
    });

    it("detects overlap on exact shared boundary amounts (inclusive bounds)", () => {
      expect(
        checkIntervalOverlap({ minAmount: 0, maxAmount: 1000 }, { minAmount: 1000, maxAmount: 2000 })
      ).toBe(true);
    });

    it("recognizes strictly disjoint contiguous ranges with no overlap", () => {
      expect(
        checkIntervalOverlap({ minAmount: 0, maxAmount: 1000 }, { minAmount: 1000.01, maxAmount: 2000 })
      ).toBe(false);
    });

    it("detects overlap when one or both flows have unbounded maxAmount (null)", () => {
      expect(
        checkIntervalOverlap({ minAmount: 500, maxAmount: null }, { minAmount: 1000, maxAmount: 2000 })
      ).toBe(true);

      expect(
        checkIntervalOverlap({ minAmount: 1000, maxAmount: null }, { minAmount: 2000, maxAmount: null })
      ).toBe(true);
    });

    it("recognizes completely disjoint ranges when one is unbounded", () => {
      expect(
        checkIntervalOverlap({ minAmount: 0, maxAmount: 500 }, { minAmount: 1000, maxAmount: null })
      ).toBe(false);
    });
  });

  describe("2. ApprovalFlowService Validations & In-Use Safety", () => {
    it("rejects flow creation with empty steps array", async () => {
      await expect(
        flowService.createFlow(
          {
            name: "Empty Steps Flow",
            category: RequestCategory.IT,
            minAmount: 0,
            maxAmount: null,
            isActive: true,
            steps: [] as any,
          },
          adminUser as any
        )
      ).rejects.toThrow(/at least one step/i);
    });

    it("rejects flow creation with duplicate step orders", async () => {
      await expect(
        flowService.createFlow(
          {
            name: "Duplicate Steps Flow",
            category: RequestCategory.IT,
            minAmount: 0,
            maxAmount: null,
            isActive: true,
            steps: [
              { stepOrder: 1, approverRole: Role.MANAGER },
              { stepOrder: 1, approverRole: Role.ADMIN },
            ],
          },
          adminUser as any
        )
      ).rejects.toThrow(/duplicate step orders/i);
    });

    it("rejects flow creation if a step has neither approverRole nor approverId", async () => {
      await expect(
        flowService.createFlow(
          {
            name: "No Approver Flow",
            category: RequestCategory.IT,
            minAmount: 0,
            maxAmount: null,
            isActive: true,
            steps: [{ stepOrder: 1, approverRole: null, approverId: null }],
          },
          adminUser as any
        )
      ).rejects.toThrow(/must specify an approver role or a specific approver ID/i);
    });

    it("rejects flow creation if specific approverId does not exist or is deactivated", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      await expect(
        flowService.createFlow(
          {
            name: "Unknown User Step",
            category: RequestCategory.IT,
            minAmount: 0,
            maxAmount: null,
            isActive: true,
            steps: [{ stepOrder: 1, approverId: "non-existent-user-id" }],
          },
          adminUser as any
        )
      ).rejects.toThrow(/not found/i);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "inactive-user",
        isActive: false,
        role: Role.MANAGER,
        organizationId: "00000000-0000-4000-8000-000000000001",
      } as any);

      await expect(
        flowService.createFlow(
          {
            name: "Inactive User Step",
            category: RequestCategory.IT,
            minAmount: 0,
            maxAmount: null,
            isActive: true,
            steps: [{ stepOrder: 1, approverId: "inactive-user" }],
          },
          adminUser as any
        )
      ).rejects.toThrow(/deactivated/i);
    });

    it("rejects creation if amount range overlaps an existing active flow in the same category", async () => {
      vi.mocked(prisma.approvalFlow.findMany).mockResolvedValueOnce([
        {
          id: "existing-flow-1",
          name: "IT Small",
          category: RequestCategory.IT,
          minAmount: 0 as any,
          maxAmount: 1000 as any,
        } as any,
      ]);

      await expect(
        flowService.createFlow(
          {
            name: "Conflicting Flow",
            category: RequestCategory.IT,
            minAmount: 500,
            maxAmount: 2000,
            isActive: true,
            steps: [{ stepOrder: 1, approverRole: Role.MANAGER }],
          },
          adminUser as any
        )
      ).rejects.toThrow(/overlaps with existing active flow "IT Small"/i);
    });

    it("allows creating an overlapping flow if created as inactive (isActive: false)", async () => {
      vi.mocked(prisma.approvalFlow.create).mockResolvedValueOnce({
        id: "flow-draft",
        name: "Draft Flow",
        category: RequestCategory.IT,
        minAmount: 500 as any,
        maxAmount: 2000 as any,
        isActive: false,
        steps: [{ id: "s1", stepOrder: 1, approverRole: Role.MANAGER }],
      } as any);

      const created = await flowService.createFlow(
        {
          name: "Draft Flow",
          category: RequestCategory.IT,
          minAmount: 500,
          maxAmount: 2000,
          isActive: false,
          steps: [{ stepOrder: 1, approverRole: Role.MANAGER }],
        },
        adminUser as any
      );

      expect(created.id).toBe("flow-draft");
      expect(created.isActive).toBe(false);
    });

    it("prevents deleting an approval flow that is in use by requests (deactivate instead)", async () => {
      vi.mocked(prisma.approvalFlow.findUnique).mockResolvedValueOnce({
        id: "in-use-flow",
        name: "In Use Flow",
        category: RequestCategory.FINANCE,
        minAmount: 0 as any,
        maxAmount: null,
        isActive: true,
      } as any);

      vi.mocked(prisma.workRequest.count).mockResolvedValueOnce(3);

      await expect(
        flowService.deleteFlow("in-use-flow", adminUser as any)
      ).rejects.toThrow(/in use by 3 request\(s\) and cannot be deleted\. Deactivate it instead\./i);
    });

    it("allows deleting an approval flow when no requests are using it", async () => {
      vi.mocked(prisma.approvalFlow.findUnique).mockResolvedValueOnce({
        id: "unused-flow",
        name: "Unused Flow",
        category: RequestCategory.OTHER,
        minAmount: 0 as any,
        maxAmount: null,
        isActive: true,
      } as any);

      vi.mocked(prisma.workRequest.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.approvalFlow.delete).mockResolvedValueOnce({ id: "unused-flow" } as any);

      const res = await flowService.deleteFlow("unused-flow", adminUser as any);
      expect(res.success).toBe(true);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "APPROVAL_FLOW_DELETED",
          entityId: "unused-flow",
        })
      );
    });
  });

  describe("3. Workflow Matching Engine: Boundary Amounts, Overlaps, Fallback & Inactive Flows", () => {
    const activeTiers = [
      {
        id: "tier-1",
        name: "IT Small",
        category: RequestCategory.IT,
        minAmount: 0,
        maxAmount: 1000,
        isActive: true,
        steps: [{ stepOrder: 1, approverRole: Role.MANAGER, approverId: null }],
      },
      {
        id: "tier-2",
        name: "IT Medium",
        category: RequestCategory.IT,
        minAmount: 1000.01,
        maxAmount: 5000,
        isActive: true,
        steps: [
          { stepOrder: 1, approverRole: Role.MANAGER, approverId: null },
          { stepOrder: 2, approverRole: Role.ADMIN, approverId: null },
        ],
      },
      {
        id: "tier-3",
        name: "IT Enterprise",
        category: RequestCategory.IT,
        minAmount: 5000.01,
        maxAmount: null,
        isActive: true,
        steps: [
          { stepOrder: 1, approverRole: Role.MANAGER, approverId: null },
          { stepOrder: 2, approverRole: Role.ADMIN, approverId: "usr-finance-head" },
        ],
      },
    ];

    it("matches boundary amounts correctly to respective tiers", async () => {
      vi.mocked(prisma.approvalFlow.findMany).mockResolvedValue(activeTiers as any);

      // Amount = 0 -> Tier 1
      const matchZero = await repo.findMatchingFlow(RequestCategory.IT, 0);
      expect(matchZero?.id).toBe("tier-1");

      // Amount = 1000 (Upper boundary of Tier 1) -> Tier 1
      const match1000 = await repo.findMatchingFlow(RequestCategory.IT, 1000);
      expect(match1000?.id).toBe("tier-1");

      // Amount = 1000.01 (Lower boundary of Tier 2) -> Tier 2
      const match1000_01 = await repo.findMatchingFlow(RequestCategory.IT, 1000.01);
      expect(match1000_01?.id).toBe("tier-2");

      // Amount = 5000 (Upper boundary of Tier 2) -> Tier 2
      const match5000 = await repo.findMatchingFlow(RequestCategory.IT, 5000);
      expect(match5000?.id).toBe("tier-2");

      // Amount = 5000.01 (Lower boundary of Tier 3) -> Tier 3
      const match5000_01 = await repo.findMatchingFlow(RequestCategory.IT, 5000.01);
      expect(match5000_01?.id).toBe("tier-3");

      // Amount = 100000 (Unbounded Tier 3) -> Tier 3
      const matchHuge = await repo.findMatchingFlow(RequestCategory.IT, 100000);
      expect(matchHuge?.id).toBe("tier-3");
    });

    it("matches request with null amount to tier starting at 0", async () => {
      vi.mocked(prisma.approvalFlow.findMany).mockResolvedValue(activeTiers as any);

      const matchNullAmount = await repo.findMatchingFlow(RequestCategory.IT, null);
      expect(matchNullAmount?.id).toBe("tier-1");
    });

    it("does not match inactive flows, falling back when active flow is disabled", async () => {
      // Tier 1 is disabled/inactive
      const flowsWithTier1Inactive = activeTiers.filter((t) => t.id !== "tier-1");
      vi.mocked(prisma.approvalFlow.findMany).mockResolvedValue(flowsWithTier1Inactive as any);

      // Request amount = 500 falls in the inactive Tier 1 range
      const match = await repo.findMatchingFlow(RequestCategory.IT, 500);
      expect(match).toBeNull();
    });

    it("falls back to default single-step manager approval when nothing matches", async () => {
      // Category with no flows in DB
      vi.mocked(prisma.approvalFlow.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        departmentId: "dept-it",
        managerId: "usr-mgr-1",
      } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "usr-mgr-1" }] as any);

      await approvalService.initializeApprovalSteps("req-fallback-1", {
        category: RequestCategory.OTHER,
        amount: 250 as any,
        title: "Miscellaneous Supply Request",
        requesterId: employeeUser.id,
      });

      // Default single-step manager approval created
      expect(prisma.approvalStep.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              requestId: "req-fallback-1",
              stepOrder: 1,
              approverRole: Role.MANAGER,
              approverId: null,
              status: "PENDING",
            }),
          ],
        })
      );
    });

    it("workflow engine initializes multi-step approval with specific approver and links flowId", async () => {
      vi.mocked(prisma.approvalFlow.findMany).mockResolvedValue(activeTiers as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        departmentId: "dept-it",
        managerId: "usr-mgr-1",
      } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "usr-mgr-1" }] as any);

      // Amount = 7500 matches Tier 3 (2 steps: MANAGER then specific approver usr-finance-head)
      await approvalService.initializeApprovalSteps("req-enterprise-1", {
        category: RequestCategory.IT,
        amount: 7500 as any,
        title: "Enterprise Server Hardware",
        requesterId: employeeUser.id,
      });

      // Updates workRequest with flowId
      expect(prisma.workRequest.update).toHaveBeenCalledWith({
        where: { id: "req-enterprise-1" },
        data: { flowId: "tier-3" },
      });

      // Creates 2 steps with step 2 having specific approverId
      expect(prisma.approvalStep.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              requestId: "req-enterprise-1",
              stepOrder: 1,
              approverRole: Role.MANAGER,
              approverId: null,
            }),
            expect.objectContaining({
              requestId: "req-enterprise-1",
              stepOrder: 2,
              approverRole: Role.ADMIN,
              approverId: "usr-finance-head",
            }),
          ],
        })
      );

      // Step 1 approver notified
      expect(notificationService.notifyMultiple).toHaveBeenCalledWith(
        ["usr-mgr-1"],
        "APPROVAL_REQUESTED",
        "Approval Requested",
        expect.stringContaining("Enterprise Server Hardware"),
        "/requests/req-enterprise-1",
        "WorkRequest",
        "req-enterprise-1"
      );
    });
  });

  describe("4. Controller & RBAC Route Protection", () => {
    it("enforces Role.ADMIN on flow routes; rejects MANAGER and EMPLOYEE with 403 Forbidden", () => {
      const adminAuth = authorize(Role.ADMIN);

      // Manager access attempt
      const reqManager = { user: managerUser } as unknown as Request;
      const resManager = createMockResponse();
      let managerError: any = null;
      adminAuth(reqManager, resManager, (err) => {
        managerError = err;
      });
      expect(managerError).toBeDefined();
      expect(managerError?.statusCode).toBe(403);

      // Employee access attempt
      const reqEmp = { user: employeeUser } as unknown as Request;
      const resEmp = createMockResponse();
      let empError: any = null;
      adminAuth(reqEmp, resEmp, (err) => {
        empError = err;
      });
      expect(empError).toBeDefined();
      expect(empError?.statusCode).toBe(403);

      // Admin access succeeds
      const reqAdmin = { user: adminUser } as unknown as Request;
      const resAdmin = createMockResponse();
      let adminPassed = false;
      adminAuth(reqAdmin, resAdmin, (err) => {
        expect(err).toBeUndefined();
        adminPassed = true;
      });
      expect(adminPassed).toBe(true);
    });

    it("approvalFlowController.listFlows returns 200 with list of flows", async () => {
      const mockFlows = [{ id: "f-1", name: "IT Small", steps: [] }];
      vi.mocked(prisma.approvalFlow.findMany).mockResolvedValueOnce(mockFlows as any);

      const req = { user: adminUser, query: {} } as unknown as Request;
      const res = createMockResponse();
      let nextCalled = false;

      await approvalFlowController.listFlows(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(200);
      expect(res.body.flows).toEqual(mockFlows);
    });

    it("approvalFlowController.createFlow returns 201 with created flow", async () => {
      const newFlow = {
        name: "Facilities General",
        category: RequestCategory.FACILITIES,
        minAmount: 0,
        maxAmount: null,
        steps: [{ stepOrder: 1, approverRole: Role.MANAGER }],
      };

      vi.mocked(prisma.approvalFlow.findMany).mockResolvedValueOnce([]); // no existing flows
      vi.mocked(prisma.approvalFlow.create).mockResolvedValueOnce({
        id: "flow-fac-1",
        ...newFlow,
        isActive: true,
        steps: [{ id: "st-1", stepOrder: 1, approverRole: Role.MANAGER }],
      } as any);

      const req = { user: adminUser, body: newFlow } as unknown as Request;
      const res = createMockResponse();
      let nextCalled = false;

      await approvalFlowController.createFlow(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(201);
      expect(res.body.flow.id).toBe("flow-fac-1");
    });
  });
});
