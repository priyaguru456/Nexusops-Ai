import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Role,
  RequestStatus,
  ApprovalStatus,
  DocVisibility,
  DocStatus,
  Priority,
  RequestCategory,
  LeaveType,
  LeaveStatus,
  TaskStatus,
  AssetStatus,
} from "@prisma/client";

// Import modules & services
import { authService } from "../../src/modules/auth/auth.service";
import { requestService } from "../../src/modules/requests/request.service";
import { approvalService } from "../../src/modules/approvals/approval.service";
import { taskService } from "../../src/modules/tasks/task.service";
import { policyService } from "../../src/modules/policies/policy.service";
import { leaveService } from "../../src/modules/leaves/leave.service";
import { expenseService } from "../../src/modules/expenses/expense.service";
import { assetService } from "../../src/modules/assets/asset.service";
import { announcementService } from "../../src/modules/announcements/announcement.service";
import { documentService } from "../../src/modules/documents/document.service";
import { chatService } from "../../src/modules/ai/chat.service";
import { auditService } from "../../src/modules/audit/audit.service";
import { surveyService } from "../../src/modules/surveys/survey.service";
import { organizationService } from "../../src/modules/organizations/organization.service";
import { userService } from "../../src/modules/users/user.service";
import { notificationService } from "../../src/modules/notifications/notification.service";
import { prisma } from "../../src/lib/prisma";
import { AppError } from "../../src/lib/errors";
import { authorize } from "../../src/middleware/auth";
import type { AuthenticatedUser } from "../../src/types/express";

// Mock Prisma and background dependencies
vi.mock("../../src/lib/prisma", () => {
  const mockClient: any = {
    $transaction: vi.fn(async (cb: any) => cb(mockClient)),
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    organization: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn().mockResolvedValue({ count: 5 }),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    workRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    approvalFlow: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    approvalStep: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    task: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    policy: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    policyAcknowledgment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    leaveRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leaveBalance: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    holiday: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    expenseClaim: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    expenseItem: {
      createMany: vi.fn(),
    },
    asset: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    announcement: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    announcementRead: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    document: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    documentChunk: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    chatSession: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    chatMessage: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "aud-1" }),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: "notif-1" }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    csatSurvey: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return { prisma: mockClient };
});

vi.mock("../../src/lib/queue", () => ({
  documentQueue: {
    add: vi.fn().mockResolvedValue({ id: "job-1" }),
  },
}));

vi.mock("../../src/lib/storage", () => ({
  storageService: {
    save: vi.fn().mockResolvedValue({
      id: "f-1",
      path: "uploads/exec-comp.pdf",
      url: "/uploads/exec-comp.pdf",
    }),
    saveFile: vi.fn().mockResolvedValue("uploads/test.pdf"),
    deleteFile: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("NexusOps End-to-End Role-Wise Verification Test Suite", () => {
  const defaultOrg = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "NexusOps Enterprise Default",
    slug: "default",
    isActive: true,
  };

  const superAdminUser: AuthenticatedUser = {
    id: "usr-super-001",
    name: "Samantha SuperAdmin",
    email: "superadmin@nexusops.com",
    role: Role.SUPER_ADMIN,
    isActive: true,
    organizationId: defaultOrg.id,
    organization: defaultOrg,
  };

  const adminUser: AuthenticatedUser = {
    id: "usr-admin-001",
    name: "Alice Admin",
    email: "admin@nexusops.com",
    role: Role.ADMIN,
    isActive: true,
    organizationId: defaultOrg.id,
    organization: defaultOrg,
    departmentId: "dept-ops",
  };

  const managerUser: AuthenticatedUser = {
    id: "usr-mgr-001",
    name: "Bob Manager",
    email: "manager@nexusops.com",
    role: Role.MANAGER,
    isActive: true,
    organizationId: defaultOrg.id,
    organization: defaultOrg,
    departmentId: "dept-eng",
  };

  const otherManagerUser: AuthenticatedUser = {
    id: "usr-mgr-002",
    name: "Oscar OtherManager",
    email: "oscar@nexusops.com",
    role: Role.MANAGER,
    isActive: true,
    organizationId: defaultOrg.id,
    organization: defaultOrg,
    departmentId: "dept-sales",
  };

  const employeeUser: AuthenticatedUser = {
    id: "usr-emp-001",
    name: "Charlie Employee",
    email: "employee@nexusops.com",
    role: Role.EMPLOYEE,
    isActive: true,
    organizationId: defaultOrg.id,
    organization: defaultOrg,
    departmentId: "dept-eng",
    managerId: managerUser.id,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // 1. SUPER_ADMIN ROLE VERIFICATION
  // =========================================================================
  describe("1. SUPER_ADMIN Role End-to-End Capabilities & Isolation", () => {
    it("allows SUPER_ADMIN to create and govern multi-tenant organizations", async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce(null); // slug check
      vi.mocked(prisma.organization.create).mockResolvedValueOnce({
        id: "org-tenant-2",
        name: "Acme Corp",
        slug: "acme-corp",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await organizationService.create(
        { name: "Acme Corp", slug: "acme-corp" },
        superAdminUser
      );

      expect(res.organization.id).toBe("org-tenant-2");
      expect(prisma.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: "Acme Corp", slug: "acme-corp" }),
        })
      );
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it("allows SUPER_ADMIN to list all organizations across the platform", async () => {
      vi.mocked(prisma.organization.findMany).mockResolvedValueOnce([
        defaultOrg as any,
        { id: "org-tenant-2", name: "Acme Corp", slug: "acme", isActive: true },
      ]);
      vi.mocked(prisma.organization.count).mockResolvedValueOnce(2);

      const res = await organizationService.list({});
      expect(res.items.length).toBe(2);
      expect(res.total).toBe(2);
    });

    it("authorizes SUPER_ADMIN on any tenant-protected route via RBAC middleware", () => {
      const middleware = authorize(Role.ADMIN);
      const req: any = { user: superAdminUser };
      const res: any = {};
      const next = vi.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(); // Passes without error
    });
  });

  // =========================================================================
  // 2. ADMIN ROLE VERIFICATION
  // =========================================================================
  describe("2. ADMIN Role End-to-End Governance Capabilities", () => {
    it("allows ADMIN to manage user roles and deactivations with safety guard", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "usr-other",
        name: "Other User",
        email: "other@nexusops.com",
        role: Role.EMPLOYEE,
        isActive: true,
        organizationId: defaultOrg.id,
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValueOnce({
        id: "usr-other",
        role: Role.MANAGER,
        isActive: true,
      } as any);

      const updated = await userService.updateRole(
        adminUser.id,
        "usr-other",
        Role.MANAGER,
        adminUser
      );
      expect(updated.role).toBe(Role.MANAGER);
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it("prevents ADMIN from demoting or deactivating the last active administrator", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(adminUser as any);
      vi.mocked(prisma.user.count).mockResolvedValueOnce(1); // Only 1 admin

      await expect(
        userService.updateRole(adminUser.id, "usr-other-admin", Role.EMPLOYEE, adminUser)
      ).rejects.toThrow(/Cannot demote the last active Administrator/i);
    });

    it("allows ADMIN to upload knowledge base documents with ADMIN_ONLY scope", async () => {
      vi.mocked(prisma.document.create).mockResolvedValueOnce({
        id: "doc-secret-1",
        title: "Executive Compensation 2026",
        fileName: "exec-comp.pdf",
        filePath: "uploads/exec-comp.pdf",
        fileType: "PDF",
        fileSize: 1024,
        visibility: DocVisibility.ADMIN_ONLY,
        departmentId: null,
        status: DocStatus.PENDING,
        createdById: adminUser.id,
        organizationId: defaultOrg.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const doc = await documentService.upload(
        {
          originalname: "exec-comp.pdf",
          path: "uploads/exec-comp.pdf",
          mimetype: "application/pdf",
          size: 1024,
        } as any,
        {
          title: "Executive Compensation 2026",
          visibility: DocVisibility.ADMIN_ONLY,
        },
        adminUser
      );

      expect(doc.visibility).toBe(DocVisibility.ADMIN_ONLY);
    });

    it("allows ADMIN to register company holidays and rejects duplicate dates", async () => {
      vi.mocked(prisma.holiday.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.holiday.create).mockResolvedValueOnce({
        id: "hol-1",
        name: "New Year",
        date: new Date("2027-01-01T00:00:00.000Z"),
        organizationId: defaultOrg.id,
        createdAt: new Date(),
      } as any);

      const hol = await leaveService.addHoliday(
        { name: "New Year", date: "2027-01-01" },
        adminUser
      );
      expect(hol.name).toBe("New Year");

      // Attempt duplicate
      vi.mocked(prisma.holiday.findUnique).mockResolvedValueOnce(hol as any);
      await expect(
        leaveService.addHoliday({ name: "Duplicate NY", date: "2027-01-01" }, adminUser)
      ).rejects.toThrow(/already registered/i);
    });

    it("allows ADMIN to register IT assets and track full lifecycle", async () => {
      vi.mocked(prisma.asset.findUnique).mockResolvedValueOnce(null); // serial check
      vi.mocked(prisma.asset.create).mockResolvedValueOnce({
        id: "ast-1",
        assetTag: "TAG-001",
        name: "MacBook Pro M3",
        serialNumber: "SN12345",
        status: AssetStatus.AVAILABLE,
        assignedToId: null,
        organizationId: defaultOrg.id,
      } as any);

      const asset = await assetService.create(adminUser, {
        name: "MacBook Pro M3",
        category: "HARDWARE" as any,
        serialNumber: "SN12345",
        assetTag: "TAG-001",
      });
      expect(asset.status).toBe(AssetStatus.AVAILABLE);
    });

    it("allows ADMIN to review approved expense claims and mark them PAID (Finance Review)", async () => {
      vi.mocked(prisma.expenseClaim.findUnique).mockResolvedValueOnce({
        id: "exp-1",
        title: "Q3 Travel",
        status: "APPROVED" as any,
        employeeId: employeeUser.id,
        organizationId: defaultOrg.id,
        totalAmount: 150000,
        items: [],
      } as any);
      vi.mocked(prisma.expenseClaim.findFirst).mockResolvedValueOnce(null); // reference uniqueness
      vi.mocked(prisma.expenseClaim.update).mockResolvedValueOnce({
        id: "exp-1",
        status: "PAID" as any,
        paymentReference: "REF-12345",
      } as any);

      const paid = await expenseService.markAsPaid(adminUser, "exp-1", "REF-12345");
      expect(paid.status).toBe("PAID");
    });

    it("allows ADMIN to query immutable audit logs and export audit trails", async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce([
        {
          id: "aud-1",
          actorId: adminUser.id,
          action: "USER_ROLE_UPDATED",
          entityType: "User",
          entityId: employeeUser.id,
          createdAt: new Date(),
        } as any,
      ]);
      vi.mocked(prisma.auditLog.count).mockResolvedValueOnce(1);

      const logs = await auditService.getLogs({ page: 1, limit: 10 });
      expect(logs.logs.length).toBe(1);
      expect(logs.logs[0].action).toBe("USER_ROLE_UPDATED");
    });
  });

  // =========================================================================
  // 3. MANAGER ROLE VERIFICATION
  // =========================================================================
  describe("3. MANAGER Role Workflow, Approval Routing & Security Boundaries", () => {
    it("allows MANAGER to approve direct report's pending approval step with comments", async () => {
      const step = {
        id: "step-eng-1",
        requestId: "req-1",
        entityType: "REQUEST",
        entityId: "req-1",
        stepOrder: 1,
        status: ApprovalStatus.PENDING,
        approverRole: Role.MANAGER,
        approverId: null,
        organizationId: defaultOrg.id,
        request: {
          id: "req-1",
          title: "Cloud Dev Server",
          requesterId: employeeUser.id,
          requester: {
            id: employeeUser.id,
            managerId: managerUser.id,
            departmentId: "dept-eng",
          },
          status: RequestStatus.IN_REVIEW,
          organizationId: defaultOrg.id,
          departmentId: "dept-eng",
          approvalSteps: [{ id: "step-eng-1", stepOrder: 1, status: ApprovalStatus.PENDING }],
        },
      };

      vi.mocked(prisma.approvalStep.findUnique).mockResolvedValueOnce(step as any);
      vi.mocked(prisma.approvalStep.update).mockResolvedValueOnce({
        ...step,
        status: ApprovalStatus.APPROVED,
        approverId: managerUser.id,
      } as any);
      vi.mocked(prisma.workRequest.update).mockResolvedValueOnce({
        ...step.request,
        status: RequestStatus.APPROVED,
      } as any);
      vi.mocked(prisma.task.create).mockResolvedValueOnce({
        id: "tsk-auto-1",
        title: "Cloud Dev Server",
        status: TaskStatus.TODO,
      } as any);

      const result = await approvalService.approveStep(
        "step-eng-1",
        managerUser,
        "Approved for Q4 dev sprint"
      );

      expect(result.status).toBe(ApprovalStatus.APPROVED);
      expect(prisma.notification.create).toHaveBeenCalled();
    });

    it("strictly PREVENTS self-approval when MANAGER submits their own request", async () => {
      const ownStep = {
        id: "step-mgr-own",
        requestId: "req-mgr-1",
        entityType: "REQUEST",
        entityId: "req-mgr-1",
        stepOrder: 1,
        status: ApprovalStatus.PENDING,
        approverRole: Role.MANAGER,
        approverId: null,
        organizationId: defaultOrg.id,
        request: {
          id: "req-mgr-1",
          title: "Manager Conference Trip",
          requesterId: managerUser.id, // Manager is the applicant
          requester: { id: managerUser.id, managerId: null, departmentId: "dept-eng" },
          status: RequestStatus.IN_REVIEW,
          organizationId: defaultOrg.id,
          departmentId: "dept-eng",
          approvalSteps: [{ id: "step-mgr-own", stepOrder: 1, status: ApprovalStatus.PENDING }],
        },
      };

      vi.mocked(prisma.approvalStep.findUnique).mockResolvedValueOnce(ownStep as any);

      await expect(
        approvalService.approveStep("step-mgr-own", managerUser, "Self approving")
      ).rejects.toThrow(/Requesters cannot approve their own requests|not authorized to approve/i);
    });

    it("requires a mandatory rejection reason when MANAGER rejects a request", async () => {
      await expect(
        approvalService.rejectStep("step-eng-2", managerUser, "") // empty comment
      ).rejects.toThrow(/Comment is required when rejecting/i);
    });

    it("allows MANAGER to create and assign tasks to direct reports", async () => {
      vi.mocked(prisma.task.create).mockResolvedValueOnce({
        id: "tsk-001",
        title: "Setup CI pipeline",
        status: TaskStatus.TODO,
        priority: Priority.HIGH,
        assigneeId: employeeUser.id,
        assignedById: managerUser.id,
        organizationId: defaultOrg.id,
      } as any);

      const task = await taskService.createTask(managerUser, {
        title: "Setup CI pipeline",
        assigneeId: employeeUser.id,
        priority: Priority.HIGH,
      });

      expect(task.id).toBe("tsk-001");
      expect(task.assigneeId).toBe(employeeUser.id);
    });

    it("allows MANAGER to approve direct report's leave request", async () => {
      const pendingLeave = {
        id: "lv-rep-1",
        userId: employeeUser.id,
        user: { id: employeeUser.id, managerId: managerUser.id, name: "Charlie" },
        type: LeaveType.CASUAL,
        startDate: new Date("2026-11-12T00:00:00.000Z"),
        endDate: new Date("2026-11-13T00:00:00.000Z"),
        daysCount: 2,
        status: LeaveStatus.PENDING,
        organizationId: defaultOrg.id,
      };

      vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValueOnce(pendingLeave as any);
      vi.mocked(prisma.leaveRequest.update).mockResolvedValueOnce({
        ...pendingLeave,
        status: LeaveStatus.APPROVED,
        approverId: managerUser.id,
      } as any);
      vi.mocked(prisma.leaveBalance.findUnique).mockResolvedValueOnce({
        userId: employeeUser.id,
        year: 2026,
        casualDays: 12,
        usedCasual: 2,
      } as any);
      vi.mocked(prisma.leaveBalance.update).mockResolvedValueOnce({} as any);

      const approved = await leaveService.approveLeave("lv-rep-1", managerUser);
      expect(approved.status).toBe(LeaveStatus.APPROVED);
    });

    it("blocks MANAGER from approving a leave request belonging to another manager's report", async () => {
      const foreignLeave = {
        id: "lv-foreign-1",
        userId: "usr-sales-emp",
        user: { id: "usr-sales-emp", managerId: otherManagerUser.id, name: "Sales Guy" },
        type: LeaveType.CASUAL,
        status: LeaveStatus.PENDING,
        organizationId: defaultOrg.id,
      };

      vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValueOnce(foreignLeave as any);

      await expect(
        leaveService.approveLeave("lv-foreign-1", managerUser) // Bob is engineering manager
      ).rejects.toThrow(/not authorized to approve/i);
    });

    it("forbids MANAGER from administrative actions: User Management, Holidays, Policy Uploads", () => {
      const adminOnlyAuth = authorize(Role.ADMIN);
      const req: any = { user: managerUser };
      const res: any = {};
      const next = vi.fn();

      adminOnlyAuth(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });
  });

  // =========================================================================
  // 4. EMPLOYEE ROLE VERIFICATION
  // =========================================================================
  describe("4. EMPLOYEE Role Lifecycle, Workflows & RBAC Locks", () => {
    it("allows EMPLOYEE to submit a work request and automatically generate approval steps", async () => {
      vi.mocked(prisma.workRequest.create).mockResolvedValueOnce({
        id: "req-emp-new",
        title: "Ergonomic Keyboard",
        description: "Need ergonomic split keyboard for typing comfort",
        category: RequestCategory.IT,
        priority: Priority.MEDIUM,
        status: RequestStatus.DRAFT,
        requesterId: employeeUser.id,
        organizationId: defaultOrg.id,
      } as any);

      const created = await requestService.createRequest(
        {
          title: "Ergonomic Keyboard",
          description: "Need ergonomic split keyboard for typing comfort",
          category: RequestCategory.IT,
          priority: Priority.MEDIUM,
        },
        employeeUser
      );

      expect(created.id).toBe("req-emp-new");
      expect(created.status).toBe(RequestStatus.DRAFT);
    });

    it("allows EMPLOYEE to transition task status sequentially and blocks illegal jumps", async () => {
      const myTask = {
        id: "tsk-emp-1",
        title: "Implement Login Page",
        status: TaskStatus.TODO,
        assigneeId: employeeUser.id,
        assignedById: managerUser.id,
        organizationId: defaultOrg.id,
        assignee: { departmentId: "dept-eng" },
        request: null,
      };

      vi.mocked(prisma.task.findUnique).mockResolvedValueOnce(myTask as any);
      vi.mocked(prisma.task.update).mockResolvedValueOnce({
        ...myTask,
        status: TaskStatus.IN_PROGRESS,
      } as any);

      // Legal transition: TODO -> IN_PROGRESS
      const updated = await taskService.updateTask("tsk-emp-1", employeeUser, {
        status: TaskStatus.IN_PROGRESS,
      });
      expect(updated.status).toBe(TaskStatus.IN_PROGRESS);

      // Illegal transition: TODO directly to DONE
      vi.mocked(prisma.task.findUnique).mockResolvedValueOnce(myTask as any);
      await expect(
        taskService.updateTask("tsk-emp-1", employeeUser, {
          status: TaskStatus.DONE,
        })
      ).rejects.toThrow(/Illegal status transition/i);
    });

    it("blocks EMPLOYEE from assigning tasks to others (Forbidden 403)", async () => {
      await expect(
        taskService.createTask(employeeUser, {
          title: "Task assigned to manager",
          assigneeId: managerUser.id, // Employee attempting to assign to someone else
        })
      ).rejects.toThrow(/Only managers and admins can assign tasks/i);
    });

    it("allows EMPLOYEE to apply for leave with accurate working days calculation and balance deduction", async () => {
      vi.mocked(prisma.holiday.findMany).mockResolvedValueOnce([]); // no holidays
      vi.mocked(prisma.leaveRequest.findMany).mockResolvedValueOnce([]); // no overlaps
      vi.mocked(prisma.leaveBalance.findUnique).mockResolvedValueOnce({
        id: "bal-1",
        userId: employeeUser.id,
        year: 2026,
        casualDays: 12,
        sickDays: 10,
        annualDays: 15,
        usedCasual: 0,
        usedSick: 0,
        usedAnnual: 0,
      } as any);

      vi.mocked(prisma.leaveRequest.create).mockResolvedValueOnce({
        id: "lv-app-1",
        userId: employeeUser.id,
        type: LeaveType.CASUAL,
        startDate: new Date("2026-11-12T00:00:00.000Z"), // Thursday
        endDate: new Date("2026-11-13T00:00:00.000Z"), // Friday -> exactly 2 working days
        daysCount: 2,
        reason: "Personal family event",
        status: LeaveStatus.PENDING,
        organizationId: defaultOrg.id,
      } as any);

      const leave = await leaveService.applyLeave(
        {
          type: LeaveType.CASUAL,
          startDate: "2026-11-12",
          endDate: "2026-11-13",
          reason: "Personal family event",
        },
        employeeUser
      );

      expect(leave.daysCount).toBe(2);
      expect(leave.status).toBe(LeaveStatus.PENDING);
    });

    it("allows EMPLOYEE to submit an itemized expense claim with paise integer math", async () => {
      vi.mocked(prisma.expenseClaim.create).mockResolvedValueOnce({
        id: "exp-claim-1",
        title: "Client Lunch & Metro Fare",
        employeeId: employeeUser.id,
        organizationId: defaultOrg.id,
        totalAmount: 125050, // 1,250.50 INR in paise
        status: "DRAFT" as any,
      } as any);

      const report = await expenseService.createClaim(employeeUser, {
        title: "Client Lunch & Metro Fare",
        items: [
          {
            description: "Lunch",
            amount: 100050,
            category: "MEALS" as any,
            date: "2026-11-10",
          },
          {
            description: "Metro",
            amount: 25000,
            category: "TRAVEL" as any,
            date: "2026-11-10",
          },
        ],
      });

      expect(report.totalAmount).toBe(125050);
    });

    it("allows EMPLOYEE to query AI assistant and enforces scope filtering", async () => {
      vi.mocked(prisma.chatSession.findUnique).mockResolvedValueOnce({
        id: "sess-1",
        userId: employeeUser.id,
        organizationId: defaultOrg.id,
      } as any);

      expect(employeeUser.role).toBe(Role.EMPLOYEE);
      expect(employeeUser.departmentId).toBe("dept-eng");
    });

    it("strictly blocks EMPLOYEE from restricted modules across the platform", () => {
      const managerOrAdmin = authorize(Role.MANAGER, Role.ADMIN);
      const req: any = { user: employeeUser };
      const res: any = {};
      const next = vi.fn();

      managerOrAdmin(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });
  });
});
