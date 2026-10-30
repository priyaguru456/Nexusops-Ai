import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import {
  Role,
  RequestStatus,
  Priority,
  RequestCategory,
  ApprovalStatus,
  TaskStatus,
} from "@prisma/client";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { approvalService } from "../src/modules/approvals/approval.service";
import { signAccessToken } from "../src/lib/jwt";

vi.mock("../src/lib/prisma", () => {
  return {
    prisma: {
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb(prisma);
      }),
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      workRequest: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      task: {
        create: vi.fn(),
      },
      approvalFlow: {
        findMany: vi.fn(),
      },
      approvalStep: {
        createMany: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      notification: {
        create: vi.fn(),
        createMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    },
  };
});

describe("Approval Workflow - Unit & Integration Tests", () => {
  const adminUser = {
    id: "a0000000-0000-4000-8000-000000000001",
    name: "Admin User",
    email: "admin@nexusops.com",
    role: Role.ADMIN,
    isActive: true,
    departmentId: null,
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const managerUser = {
    id: "b0000000-0000-4000-8000-000000000001",
    name: "Eng Manager",
    email: "manager@nexusops.com",
    role: Role.MANAGER,
    isActive: true,
    departmentId: "dept-eng",
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const employeeUser = {
    id: "c0000000-0000-4000-8000-000000000001",
    name: "Eng Employee",
    email: "emp@nexusops.com",
    role: Role.EMPLOYEE,
    isActive: true,
    departmentId: "dept-eng",
    managerId: managerUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const adminToken = signAccessToken({
    sub: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
  });

  const managerToken = signAccessToken({
    sub: managerUser.id,
    email: managerUser.email,
    role: managerUser.role,
  });

  const employeeToken = signAccessToken({
    sub: employeeUser.id,
    email: employeeUser.email,
    role: employeeUser.role,
  });

  const baseRequest = {
    id: "e0000000-0000-4000-8000-000000000001",
    title: "High Performance Server",
    description: "Purchase new server hardware for testing",
    category: RequestCategory.IT,
    priority: Priority.HIGH,
    status: RequestStatus.SUBMITTED,
    amount: "1500.00",
    dueDate: new Date("2026-12-01"),
    requesterId: employeeUser.id,
    requester: {
      id: employeeUser.id,
      name: employeeUser.name,
      email: employeeUser.email,
      departmentId: "dept-eng",
      managerId: managerUser.id,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const step1 = {
    id: "f0000000-0000-4000-8000-000000000001",
    requestId: baseRequest.id,
    stepOrder: 1,
    approverRole: Role.MANAGER,
    approverId: null,
    status: ApprovalStatus.PENDING,
    comment: null,
    decidedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    request: {
      ...baseRequest,
      approvalSteps: [] as any[],
    },
    approver: null,
  };

  const step2 = {
    id: "f0000000-0000-4000-8000-000000000002",
    requestId: baseRequest.id,
    stepOrder: 2,
    approverRole: Role.ADMIN,
    approverId: null,
    status: ApprovalStatus.PENDING,
    comment: null,
    decidedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    request: {
      ...baseRequest,
      approvalSteps: [] as any[],
    },
    approver: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(prisma.user.findUnique).mockImplementation(async ({ where }: any) => {
      if (where.id === adminUser.id) return adminUser as any;
      if (where.id === managerUser.id) return managerUser as any;
      if (where.id === employeeUser.id) return employeeUser as any;
      return null;
    });

    vi.mocked(prisma.user.findMany).mockResolvedValue([managerUser] as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
  });

  describe("Unit Tests: ApprovalService", () => {
    it("happy path: executes multi-step approval to final approval and auto-creates task", async () => {
      // Setup request with 2 steps
      const allSteps = [
        { ...step1, status: ApprovalStatus.PENDING },
        { ...step2, status: ApprovalStatus.PENDING },
      ];
      const step1WithSiblings = {
        ...step1,
        request: { ...baseRequest, approvalSteps: allSteps },
      };

      vi.mocked(prisma.approvalStep.findUnique).mockResolvedValueOnce(step1WithSiblings as any);
      vi.mocked(prisma.approvalStep.update).mockResolvedValueOnce({
        ...step1WithSiblings,
        status: ApprovalStatus.APPROVED,
        approverId: managerUser.id,
        decidedAt: new Date(),
      } as any);
      vi.mocked(prisma.workRequest.update).mockResolvedValueOnce({
        ...baseRequest,
        status: RequestStatus.IN_REVIEW,
      } as any);

      // 1. Manager approves step 1
      const res1 = await approvalService.approveStep(
        step1.id,
        { id: managerUser.id, role: managerUser.role, email: managerUser.email, name: managerUser.name, departmentId: managerUser.departmentId },
        "Looks good for engineering"
      );

      expect(res1.status).toBe(ApprovalStatus.APPROVED);
      expect(prisma.workRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: baseRequest.id },
          data: { status: RequestStatus.IN_REVIEW },
        })
      );

      // 2. Admin approves step 2 (final step)
      const step2WithSiblings = {
        ...step2,
        request: {
          ...baseRequest,
          status: RequestStatus.IN_REVIEW,
          approvalSteps: [
            { ...step1, status: ApprovalStatus.APPROVED },
            { ...step2, status: ApprovalStatus.PENDING },
          ],
        },
      };

      vi.mocked(prisma.approvalStep.findUnique).mockResolvedValueOnce(step2WithSiblings as any);
      vi.mocked(prisma.approvalStep.update).mockResolvedValueOnce({
        ...step2WithSiblings,
        status: ApprovalStatus.APPROVED,
        approverId: adminUser.id,
        decidedAt: new Date(),
      } as any);
      vi.mocked(prisma.workRequest.update).mockResolvedValueOnce({
        ...baseRequest,
        status: RequestStatus.APPROVED,
      } as any);
      vi.mocked(prisma.task.create).mockResolvedValueOnce({
        id: "d0000000-0000-4000-8000-000000000099",
        title: `Fulfill Request: ${baseRequest.title}`,
        status: TaskStatus.TODO,
        priority: baseRequest.priority,
        requestId: baseRequest.id,
      } as any);

      const res2 = await approvalService.approveStep(
        step2.id,
        { id: adminUser.id, role: adminUser.role, email: adminUser.email, name: adminUser.name, departmentId: null },
        "Budget approved"
      );

      expect(res2.status).toBe(ApprovalStatus.APPROVED);
      // Final approval sets request to APPROVED
      expect(prisma.workRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: baseRequest.id },
          data: { status: RequestStatus.APPROVED },
        })
      );
      // AUTO-CREATES a fulfillment task
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requestId: baseRequest.id,
            status: TaskStatus.TODO,
            title: `Fulfill Request: ${baseRequest.title}`,
          }),
        })
      );
    });

    it("rejection: requires comment and ends flow, marking request REJECTED and remaining steps SKIPPED", async () => {
      const allSteps = [
        { ...step1, status: ApprovalStatus.PENDING },
        { ...step2, status: ApprovalStatus.PENDING },
      ];
      const step1WithSiblings = {
        ...step1,
        request: { ...baseRequest, approvalSteps: allSteps },
      };

      // Attempt to reject without comment
      await expect(
        approvalService.rejectStep(
          step1.id,
          { id: managerUser.id, role: managerUser.role, email: managerUser.email, name: managerUser.name, departmentId: managerUser.departmentId },
          ""
        )
      ).rejects.toThrow("Comment is required when rejecting an approval step");

      // Reject with comment
      vi.mocked(prisma.approvalStep.findUnique).mockResolvedValueOnce(step1WithSiblings as any);
      vi.mocked(prisma.approvalStep.update).mockResolvedValueOnce({
        ...step1WithSiblings,
        status: ApprovalStatus.REJECTED,
        approverId: managerUser.id,
        comment: "Too expensive",
      } as any);
      vi.mocked(prisma.approvalStep.updateMany).mockResolvedValueOnce({ count: 1 });
      vi.mocked(prisma.workRequest.update).mockResolvedValueOnce({
        ...baseRequest,
        status: RequestStatus.REJECTED,
      } as any);

      const result = await approvalService.rejectStep(
        step1.id,
        { id: managerUser.id, role: managerUser.role, email: managerUser.email, name: managerUser.name, departmentId: managerUser.departmentId },
        "Too expensive"
      );

      expect(result.status).toBe(ApprovalStatus.REJECTED);
      // Remaining steps skipped
      expect(prisma.approvalStep.updateMany).toHaveBeenCalledWith({
        where: {
          requestId: baseRequest.id,
          stepOrder: { gt: 1 },
        },
        data: {
          status: ApprovalStatus.SKIPPED,
        },
      });
      // Request marked REJECTED
      expect(prisma.workRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: baseRequest.id },
          data: { status: RequestStatus.REJECTED },
        })
      );
    });

    it("self-approval blocked: requester cannot approve their own request", async () => {
      // Employee created the request and tries to approve Step 1
      const step1WithSiblings = {
        ...step1,
        request: {
          ...baseRequest,
          requesterId: employeeUser.id,
          approvalSteps: [{ ...step1, status: ApprovalStatus.PENDING }],
        },
      };

      vi.mocked(prisma.approvalStep.findUnique).mockResolvedValueOnce(step1WithSiblings as any);

      await expect(
        approvalService.approveStep(
          step1.id,
          { id: employeeUser.id, role: employeeUser.role, email: employeeUser.email, name: employeeUser.name, departmentId: employeeUser.departmentId },
          "I approve my own request"
        )
      ).rejects.toThrow("Requesters cannot approve their own requests");
    });

    it("out-of-order approval blocked: cannot approve Step 2 before Step 1 is approved", async () => {
      // Step 1 is still PENDING
      const allSteps = [
        { ...step1, status: ApprovalStatus.PENDING },
        { ...step2, status: ApprovalStatus.PENDING },
      ];
      const step2WithSiblings = {
        ...step2,
        request: {
          ...baseRequest,
          approvalSteps: allSteps,
        },
      };

      vi.mocked(prisma.approvalStep.findUnique).mockResolvedValueOnce(step2WithSiblings as any);

      await expect(
        approvalService.approveStep(
          step2.id,
          { id: adminUser.id, role: adminUser.role, email: adminUser.email, name: adminUser.name, departmentId: null },
          "Admin jumping ahead"
        )
      ).rejects.toThrow(
        "Cannot approve out-of-order step. Preceding approval steps must be approved first."
      );
    });
  });

  describe("Integration Tests: /api/approvals endpoints", () => {
    it("GET /api/approvals/pending returns active steps and filters out requester's own requests", async () => {
      const allSteps = [
        { ...step1, status: ApprovalStatus.PENDING },
        { ...step2, status: ApprovalStatus.PENDING },
      ];

      vi.mocked(prisma.approvalStep.findMany).mockResolvedValueOnce([
        {
          ...step1,
          request: {
            ...baseRequest,
            approvalSteps: allSteps,
          },
        },
        {
          ...step2,
          request: {
            ...baseRequest,
            approvalSteps: allSteps,
          },
        },
      ] as any);

      const res = await request(app)
        .get("/api/approvals/pending")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.steps)).toBe(true);
      // Manager should only see step 1 because step 2 is out of order and assigned to ADMIN
      expect(res.body.steps.length).toBe(1);
      expect(res.body.steps[0].id).toBe(step1.id);
    });

    it("POST /api/approvals/:stepId/approve succeeds with valid permissions", async () => {
      const step1WithSiblings = {
        ...step1,
        request: {
          ...baseRequest,
          approvalSteps: [{ ...step1, status: ApprovalStatus.PENDING }],
        },
      };

      vi.mocked(prisma.approvalStep.findUnique).mockResolvedValueOnce(step1WithSiblings as any);
      vi.mocked(prisma.approvalStep.update).mockResolvedValueOnce({
        ...step1WithSiblings,
        status: ApprovalStatus.APPROVED,
        approverId: managerUser.id,
        decidedAt: new Date(),
        comment: "Approved by manager",
      } as any);
      vi.mocked(prisma.workRequest.update).mockResolvedValueOnce({
        ...baseRequest,
        status: RequestStatus.APPROVED,
      } as any);
      vi.mocked(prisma.task.create).mockResolvedValueOnce({
        id: "d0000000-0000-4000-8000-000000000099",
        title: `Fulfill Request: ${baseRequest.title}`,
        status: TaskStatus.TODO,
      } as any);

      const res = await request(app)
        .post(`/api/approvals/${step1.id}/approve`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ comment: "Approved by manager" });

      expect(res.status).toBe(200);
      expect(res.body.step.status).toBe(ApprovalStatus.APPROVED);
    });

    it("POST /api/approvals/:stepId/reject returns 400 when comment is missing", async () => {
      const res = await request(app)
        .post(`/api/approvals/${step1.id}/reject`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ comment: "" });

      expect(res.status).toBe(400);
    });

    it("POST /api/approvals/:stepId/approve returns 403 on self-approval attempt", async () => {
      const step1WithSiblings = {
        ...step1,
        request: {
          ...baseRequest,
          requesterId: employeeUser.id,
          approvalSteps: [{ ...step1, status: ApprovalStatus.PENDING }],
        },
      };

      vi.mocked(prisma.approvalStep.findUnique).mockResolvedValueOnce(step1WithSiblings as any);

      const res = await request(app)
        .post(`/api/approvals/${step1.id}/approve`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ comment: "Trying to self-approve" });

      expect(res.status).toBe(403);
    });
  });
});
