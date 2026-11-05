import { describe, it, expect, vi, beforeEach } from "vitest";
import { Role, LeaveType, LeaveStatus } from "@prisma/client";
import { leaveService } from "../../src/modules/leaves/leave.service";
import { leaveRepository } from "../../src/modules/leaves/leave.repository";
import {
  calculateWorkingDays,
  isWeekendUTC,
  normalizeDateToUTC,
  formatDateKeyUTC,
  isWithinPastGracePeriod,
  datesOverlap,
} from "../../src/modules/leaves/leave.utils";
import { LEAVE_CONFIG } from "../../src/modules/leaves/leave.config";
import { approvalService } from "../../src/modules/approvals/approval.service";
import { auditService } from "../../src/modules/audit/audit.service";
import { notificationService } from "../../src/modules/notifications/notification.service";
import { prisma } from "../../src/lib/prisma";
import { AppError } from "../../src/lib/errors";
import type { AuthenticatedUser } from "../../src/types/express";

vi.mock("../../src/lib/prisma", () => {
  const mockClient: any = {
    $transaction: vi.fn(async (cb: any) => cb(mockClient)),
    leaveRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    leaveBalance: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    holiday: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    approvalStep: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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

vi.mock("../../src/modules/approvals/approval.service", () => ({
  approvalService: {
    initializeApprovalStepsForEntity: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../src/modules/audit/audit.service", () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../src/modules/notifications/notification.service", () => ({
  notificationService: {
    notify: vi.fn().mockResolvedValue(undefined),
    notifyMultiple: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("Leave Management - Backend Unit Tests", () => {
  const employeeUser: AuthenticatedUser = {
    id: "usr-emp-1",
    name: "Alice Employee",
    email: "alice@nexusops.com",
    role: Role.EMPLOYEE,
    departmentId: "dept-eng",
  };

  const managerUser: AuthenticatedUser = {
    id: "usr-mgr-1",
    name: "Bob Manager",
    email: "bob@nexusops.com",
    role: Role.MANAGER,
    departmentId: "dept-eng",
  };

  const otherManagerUser: AuthenticatedUser = {
    id: "usr-mgr-2",
    name: "Carol Manager",
    email: "carol@nexusops.com",
    role: Role.MANAGER,
    departmentId: "dept-sales",
  };

  const adminUser: AuthenticatedUser = {
    id: "usr-admin-1",
    name: "Dave Admin",
    email: "admin@nexusops.com",
    role: Role.ADMIN,
    departmentId: "dept-it",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Working Days Calculation Utilities", () => {
    it("identifies Saturday and Sunday as weekends in UTC", () => {
      // 2026-11-07 is Saturday, 2026-11-08 is Sunday
      const saturday = new Date(Date.UTC(2026, 10, 7));
      const sunday = new Date(Date.UTC(2026, 10, 8));
      const monday = new Date(Date.UTC(2026, 10, 9));

      expect(isWeekendUTC(saturday)).toBe(true);
      expect(isWeekendUTC(sunday)).toBe(true);
      expect(isWeekendUTC(monday)).toBe(false);
    });

    it("calculates exactly 5 working days for a standard Monday to Friday week", () => {
      // Monday Nov 9, 2026 to Friday Nov 13, 2026
      const start = new Date(Date.UTC(2026, 10, 9));
      const end = new Date(Date.UTC(2026, 10, 13));

      const count = calculateWorkingDays(start, end);
      expect(count).toBe(5);
    });

    it("excludes weekends when range spans across a weekend", () => {
      // Friday Nov 6, 2026 to Tuesday Nov 10, 2026 (Fri, Sat, Sun, Mon, Tue = 3 working days)
      const start = new Date(Date.UTC(2026, 10, 6));
      const end = new Date(Date.UTC(2026, 10, 10));

      const count = calculateWorkingDays(start, end);
      expect(count).toBe(3);
    });

    it("excludes company holidays falling on weekdays", () => {
      // Monday Nov 9 to Friday Nov 13 (5 days)
      // Wednesday Nov 11 is an official company holiday
      const start = new Date(Date.UTC(2026, 10, 9));
      const end = new Date(Date.UTC(2026, 10, 13));
      const holidaySet = new Set(["2026-11-11"]);

      const count = calculateWorkingDays(start, end, holidaySet);
      expect(count).toBe(4);
    });

    it("returns 0 if date range falls completely on a weekend", () => {
      // Saturday Nov 7, 2026 to Sunday Nov 8, 2026
      const start = new Date(Date.UTC(2026, 10, 7));
      const end = new Date(Date.UTC(2026, 10, 8));

      const count = calculateWorkingDays(start, end);
      expect(count).toBe(0);
    });

    it("returns 0 if start date is after end date", () => {
      const start = new Date(Date.UTC(2026, 10, 15));
      const end = new Date(Date.UTC(2026, 10, 10));

      const count = calculateWorkingDays(start, end);
      expect(count).toBe(0);
    });

    it("accurately detects date overlaps", () => {
      // Nov 10 to Nov 15
      const startA = new Date(Date.UTC(2026, 10, 10));
      const endA = new Date(Date.UTC(2026, 10, 15));

      // Overlapping Nov 12 to Nov 18
      const startB = new Date(Date.UTC(2026, 10, 12));
      const endB = new Date(Date.UTC(2026, 10, 18));
      expect(datesOverlap(startA, endA, startB, endB)).toBe(true);

      // Non-overlapping Nov 16 to Nov 20
      const startC = new Date(Date.UTC(2026, 10, 16));
      const endC = new Date(Date.UTC(2026, 10, 20));
      expect(datesOverlap(startA, endA, startC, endC)).toBe(false);
    });

    it("enforces past-dated leave grace period correctly", () => {
      const fixedNow = new Date(Date.UTC(2026, 10, 15)); // Nov 15, 2026

      // 3 days in the past (Nov 12) -> Allowed (<= 7 days)
      const allowedPast = new Date(Date.UTC(2026, 10, 12));
      expect(isWithinPastGracePeriod(allowedPast, 7, fixedNow)).toBe(true);

      // 10 days in the past (Nov 5) -> Rejected (> 7 days)
      const rejectedPast = new Date(Date.UTC(2026, 10, 5));
      expect(isWithinPastGracePeriod(rejectedPast, 7, fixedNow)).toBe(false);

      // Future date -> Allowed
      const future = new Date(Date.UTC(2026, 10, 20));
      expect(isWithinPastGracePeriod(future, 7, fixedNow)).toBe(true);
    });
  });

  describe("2. Leave Application & Business Rules", () => {
    it("rejects leave application if start date is after end date", async () => {
      await expect(
        leaveService.applyLeave(
          {
            type: LeaveType.CASUAL,
            startDate: "2026-11-20",
            endDate: "2026-11-15",
            reason: "Vacation",
          },
          employeeUser
        )
      ).rejects.toThrow("Start date cannot be after end date");
    });

    it("rejects leave application if start date exceeds the past grace period", async () => {
      // 30 days in the past
      const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      await expect(
        leaveService.applyLeave(
          {
            type: LeaveType.CASUAL,
            startDate: pastDate,
            endDate: pastDate,
            reason: "Doctor visit",
          },
          employeeUser
        )
      ).rejects.toThrow(/past-dated grace period/);
    });

    it("rejects leave application if date range contains 0 working days", async () => {
      vi.spyOn(leaveRepository, "findHolidaysBetween").mockResolvedValue([]);

      // Nov 7 and Nov 8, 2026 are Saturday and Sunday
      await expect(
        leaveService.applyLeave(
          {
            type: LeaveType.CASUAL,
            startDate: "2026-11-07",
            endDate: "2026-11-08",
            reason: "Weekend rest",
          },
          employeeUser
        )
      ).rejects.toThrow(/0 working days/);
    });

    it("rejects leave application if it overlaps with an existing pending or approved leave", async () => {
      vi.spyOn(leaveRepository, "findHolidaysBetween").mockResolvedValue([]);
      vi.spyOn(leaveRepository, "findOverlappingLeaves").mockResolvedValue([
        {
          id: "lv-existing-1",
          userId: employeeUser.id,
          type: LeaveType.CASUAL,
          startDate: new Date("2026-11-10"),
          endDate: new Date("2026-11-12"),
          daysCount: 3,
          reason: "Existing leave",
          status: LeaveStatus.PENDING,
          approverId: null,
          decidedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await expect(
        leaveService.applyLeave(
          {
            type: LeaveType.CASUAL,
            startDate: "2026-11-11",
            endDate: "2026-11-13",
            reason: "Personal work",
          },
          employeeUser
        )
      ).rejects.toThrow(/overlaps with an existing/);
    });

    it("rejects leave application when leave balance is insufficient", async () => {
      vi.spyOn(leaveRepository, "findHolidaysBetween").mockResolvedValue([]);
      vi.spyOn(leaveRepository, "findOverlappingLeaves").mockResolvedValue([]);
      vi.spyOn(leaveRepository, "findBalance").mockResolvedValue({
        id: "bal-1",
        userId: employeeUser.id,
        year: 2026,
        casualDays: 12,
        sickDays: 12,
        annualDays: 15,
        usedCasual: 11, // only 1 day remaining!
        usedSick: 0,
        usedAnnual: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Applying for 3 days of CASUAL leave (Monday to Wednesday: 3 days)
      await expect(
        leaveService.applyLeave(
          {
            type: LeaveType.CASUAL,
            startDate: "2026-11-09",
            endDate: "2026-11-11",
            reason: "Trip",
          },
          employeeUser
        )
      ).rejects.toThrow(/Insufficient casual leave balance/);
    });

    it("exempts UNPAID leave from balance verification", async () => {
      vi.spyOn(leaveRepository, "findHolidaysBetween").mockResolvedValue([]);
      vi.spyOn(leaveRepository, "findOverlappingLeaves").mockResolvedValue([]);
      vi.spyOn(leaveRepository, "findBalance").mockResolvedValue({
        id: "bal-1",
        userId: employeeUser.id,
        year: 2026,
        casualDays: 12,
        sickDays: 12,
        annualDays: 15,
        usedCasual: 12, // exhausted
        usedSick: 12, // exhausted
        usedAnnual: 15, // exhausted
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (prisma.leaveRequest.create as any).mockResolvedValue({
        id: "lv-unpaid-1",
        userId: employeeUser.id,
        type: LeaveType.UNPAID,
        startDate: new Date("2026-11-09"),
        endDate: new Date("2026-11-11"),
        daysCount: 3,
        reason: "Sabbatical days",
        status: LeaveStatus.PENDING,
      });

      (prisma.user.findUnique as any).mockResolvedValue({
        id: employeeUser.id,
        managerId: managerUser.id,
        manager: { id: managerUser.id, isActive: true },
      });

      const result = await leaveService.applyLeave(
        {
          type: LeaveType.UNPAID,
          startDate: "2026-11-09",
          endDate: "2026-11-11",
          reason: "Sabbatical days",
        },
        employeeUser
      );

      expect(result.id).toBe("lv-unpaid-1");
      expect(approvalService.initializeApprovalStepsForEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "LEAVE",
          entityId: "lv-unpaid-1",
          steps: expect.arrayContaining([
            expect.objectContaining({
              approverRole: Role.MANAGER,
              approverId: managerUser.id,
            }),
          ]),
        }),
        expect.anything()
      );
    });

    it("routes approval to employee's manager when manager is assigned", async () => {
      vi.spyOn(leaveRepository, "findHolidaysBetween").mockResolvedValue([]);
      vi.spyOn(leaveRepository, "findOverlappingLeaves").mockResolvedValue([]);
      vi.spyOn(leaveRepository, "findBalance").mockResolvedValue({
        id: "bal-1",
        userId: employeeUser.id,
        year: 2026,
        casualDays: 12,
        sickDays: 12,
        annualDays: 15,
        usedCasual: 0,
        usedSick: 0,
        usedAnnual: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (prisma.leaveRequest.create as any).mockResolvedValue({
        id: "lv-routed-1",
        userId: employeeUser.id,
        type: LeaveType.CASUAL,
        startDate: new Date("2026-11-09"),
        endDate: new Date("2026-11-10"),
        daysCount: 2,
        reason: "Family function",
        status: LeaveStatus.PENDING,
      });

      (prisma.user.findUnique as any).mockResolvedValue({
        id: employeeUser.id,
        managerId: managerUser.id,
        manager: { id: managerUser.id, isActive: true },
      });

      await leaveService.applyLeave(
        {
          type: LeaveType.CASUAL,
          startDate: "2026-11-09",
          endDate: "2026-11-10",
          reason: "Family function",
        },
        employeeUser
      );

      expect(approvalService.initializeApprovalStepsForEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "LEAVE",
          steps: [
            {
              stepOrder: 1,
              approverRole: Role.MANAGER,
              approverId: managerUser.id,
            },
          ],
        }),
        expect.anything()
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "LEAVE_SUBMITTED",
          entityType: "Leave",
        })
      );
    });

    it("routes approval to ADMIN fallback when employee has no manager", async () => {
      vi.spyOn(leaveRepository, "findHolidaysBetween").mockResolvedValue([]);
      vi.spyOn(leaveRepository, "findOverlappingLeaves").mockResolvedValue([]);
      vi.spyOn(leaveRepository, "findBalance").mockResolvedValue({
        id: "bal-1",
        userId: employeeUser.id,
        year: 2026,
        casualDays: 12,
        sickDays: 12,
        annualDays: 15,
        usedCasual: 0,
        usedSick: 0,
        usedAnnual: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (prisma.leaveRequest.create as any).mockResolvedValue({
        id: "lv-routed-fallback",
        userId: employeeUser.id,
        type: LeaveType.ANNUAL,
        startDate: new Date("2026-11-09"),
        endDate: new Date("2026-11-10"),
        daysCount: 2,
        reason: "Annual break",
        status: LeaveStatus.PENDING,
      });

      (prisma.user.findUnique as any).mockResolvedValue({
        id: employeeUser.id,
        managerId: null, // No manager!
        manager: null,
      });

      await leaveService.applyLeave(
        {
          type: LeaveType.ANNUAL,
          startDate: "2026-11-09",
          endDate: "2026-11-10",
          reason: "Annual break",
        },
        employeeUser
      );

      expect(approvalService.initializeApprovalStepsForEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "LEAVE",
          steps: [
            {
              stepOrder: 1,
              approverRole: Role.ADMIN,
              approverId: null,
            },
          ],
        }),
        expect.anything()
      );
    });
  });

  describe("3. Leave Approval & Balance Deduction Flow", () => {
    const mockPendingLeave = {
      id: "lv-test-approve",
      userId: employeeUser.id,
      type: LeaveType.CASUAL,
      startDate: new Date(Date.UTC(2026, 10, 9)),
      endDate: new Date(Date.UTC(2026, 10, 10)),
      daysCount: 2,
      reason: "Rest",
      status: LeaveStatus.PENDING,
      approverId: null,
      decidedAt: null,
      user: {
        id: employeeUser.id,
        name: "Alice Employee",
        email: "alice@nexusops.com",
        role: Role.EMPLOYEE,
        departmentId: "dept-eng",
        managerId: managerUser.id,
      },
    };

    it("approves leave, deducts balance in transaction, and notifies employee", async () => {
      vi.spyOn(leaveRepository, "findLeaveById").mockResolvedValue(mockPendingLeave as any);
      vi.spyOn(leaveRepository, "findBalance").mockResolvedValue({
        id: "bal-1",
        userId: employeeUser.id,
        year: 2026,
        casualDays: 12,
        sickDays: 12,
        annualDays: 15,
        usedCasual: 2,
        usedSick: 0,
        usedAnnual: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const updateBalanceSpy = vi.spyOn(leaveRepository, "updateBalance").mockResolvedValue({} as any);
      const updateLeaveSpy = vi.spyOn(leaveRepository, "updateLeaveRequest").mockResolvedValue({
        ...mockPendingLeave,
        status: LeaveStatus.APPROVED,
        approverId: managerUser.id,
      } as any);

      (prisma.approvalStep.findFirst as any).mockResolvedValue({
        id: "step-1",
        status: "PENDING",
      });

      const approved = await leaveService.approveLeave("lv-test-approve", managerUser, "Enjoy your leave!");

      expect(updateBalanceSpy).toHaveBeenCalledWith(
        "bal-1",
        { usedCasual: 4 }, // 2 + 2 days deducted!
        expect.anything()
      );
      expect(updateLeaveSpy).toHaveBeenCalledWith(
        "lv-test-approve",
        expect.objectContaining({
          status: LeaveStatus.APPROVED,
          approverId: managerUser.id,
        }),
        expect.anything()
      );
      expect(notificationService.notify).toHaveBeenCalledWith(
        employeeUser.id,
        "LEAVE_APPROVED",
        "Leave Request Approved",
        expect.stringContaining("has been approved"),
        "/leaves/lv-test-approve",
        "Leave",
        "lv-test-approve"
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "LEAVE_APPROVED",
          entityType: "Leave",
          actorId: managerUser.id,
        })
      );
      expect(approved.status).toBe(LeaveStatus.APPROVED);
    });

    it("prevents self-approval (applicant cannot approve their own leave)", async () => {
      vi.spyOn(leaveRepository, "findLeaveById").mockResolvedValue(mockPendingLeave as any);

      await expect(
        leaveService.approveLeave("lv-test-approve", employeeUser)
      ).rejects.toThrow("Requesters cannot approve their own leave requests");
    });

    it("blocks unauthorized user from approving (manager of another department)", async () => {
      vi.spyOn(leaveRepository, "findLeaveById").mockResolvedValue(mockPendingLeave as any);

      await expect(
        leaveService.approveLeave("lv-test-approve", otherManagerUser)
      ).rejects.toThrow("You are not authorized to approve this leave request");
    });

    it("allows ADMIN to approve leave for any employee", async () => {
      vi.spyOn(leaveRepository, "findLeaveById").mockResolvedValue(mockPendingLeave as any);
      vi.spyOn(leaveRepository, "findBalance").mockResolvedValue({
        id: "bal-1",
        userId: employeeUser.id,
        year: 2026,
        casualDays: 12,
        sickDays: 12,
        annualDays: 15,
        usedCasual: 0,
        usedSick: 0,
        usedAnnual: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.spyOn(leaveRepository, "updateBalance").mockResolvedValue({} as any);
      vi.spyOn(leaveRepository, "updateLeaveRequest").mockResolvedValue({
        ...mockPendingLeave,
        status: LeaveStatus.APPROVED,
      } as any);

      const approved = await leaveService.approveLeave("lv-test-approve", adminUser);
      expect(approved.status).toBe(LeaveStatus.APPROVED);
    });

    it("rejects approval attempt if leave is not in PENDING status", async () => {
      vi.spyOn(leaveRepository, "findLeaveById").mockResolvedValue({
        ...mockPendingLeave,
        status: LeaveStatus.APPROVED,
      } as any);

      await expect(
        leaveService.approveLeave("lv-test-approve", managerUser)
      ).rejects.toThrow(/already been decided/);
    });
  });

  describe("4. Leave Rejection Flow", () => {
    const mockPendingLeave = {
      id: "lv-test-reject",
      userId: employeeUser.id,
      type: LeaveType.SICK,
      startDate: new Date(Date.UTC(2026, 10, 9)),
      endDate: new Date(Date.UTC(2026, 10, 10)),
      daysCount: 2,
      reason: "Not feeling well",
      status: LeaveStatus.PENDING,
      user: {
        id: employeeUser.id,
        name: "Alice Employee",
        email: "alice@nexusops.com",
        managerId: managerUser.id,
      },
    };

    it("rejects leave without deducting balance, logs audit, and notifies employee", async () => {
      vi.spyOn(leaveRepository, "findLeaveById").mockResolvedValue(mockPendingLeave as any);
      const updateBalanceSpy = vi.spyOn(leaveRepository, "updateBalance");
      const updateLeaveSpy = vi.spyOn(leaveRepository, "updateLeaveRequest").mockResolvedValue({
        ...mockPendingLeave,
        status: LeaveStatus.REJECTED,
      } as any);

      (prisma.approvalStep.findFirst as any).mockResolvedValue({
        id: "step-rej",
        status: "PENDING",
      });

      const rejected = await leaveService.rejectLeave(
        "lv-test-reject",
        managerUser,
        "Critical sprint deadline"
      );

      // Balance must NOT be deducted on rejection!
      expect(updateBalanceSpy).not.toHaveBeenCalled();

      expect(updateLeaveSpy).toHaveBeenCalledWith(
        "lv-test-reject",
        expect.objectContaining({
          status: LeaveStatus.REJECTED,
          approverId: managerUser.id,
        }),
        expect.anything()
      );

      expect(notificationService.notify).toHaveBeenCalledWith(
        employeeUser.id,
        "LEAVE_REJECTED",
        "Leave Request Rejected",
        expect.stringContaining("Critical sprint deadline"),
        "/leaves/lv-test-reject",
        "Leave",
        "lv-test-reject"
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "LEAVE_REJECTED",
          entityType: "Leave",
        })
      );
      expect(rejected.status).toBe(LeaveStatus.REJECTED);
    });
  });

  describe("5. Leave Cancellation & Balance Restoration Flow", () => {
    it("cancelling a PENDING leave marks it cancelled without modifying balance", async () => {
      vi.spyOn(leaveRepository, "findLeaveById").mockResolvedValue({
        id: "lv-pending-cancel",
        userId: employeeUser.id,
        type: LeaveType.CASUAL,
        startDate: new Date(Date.UTC(2026, 10, 9)),
        endDate: new Date(Date.UTC(2026, 10, 10)),
        daysCount: 2,
        status: LeaveStatus.PENDING,
        user: { id: employeeUser.id, managerId: managerUser.id, name: "Alice" },
      } as any);

      const updateBalanceSpy = vi.spyOn(leaveRepository, "updateBalance");
      vi.spyOn(leaveRepository, "updateLeaveRequest").mockResolvedValue({
        id: "lv-pending-cancel",
        status: LeaveStatus.CANCELLED,
      } as any);

      const res = await leaveService.cancelLeave("lv-pending-cancel", employeeUser, "Plans changed");

      expect(updateBalanceSpy).not.toHaveBeenCalled();
      expect(res.status).toBe(LeaveStatus.CANCELLED);
      expect(prisma.approvalStep.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entityType: "LEAVE", entityId: "lv-pending-cancel", status: "PENDING" },
          data: expect.objectContaining({ status: "SKIPPED" }),
        })
      );
    });

    it("cancelling an APPROVED leave restores the deducted balance in transaction", async () => {
      vi.spyOn(leaveRepository, "findLeaveById").mockResolvedValue({
        id: "lv-approved-cancel",
        userId: employeeUser.id,
        type: LeaveType.ANNUAL,
        startDate: new Date(Date.UTC(2026, 10, 9)),
        endDate: new Date(Date.UTC(2026, 10, 13)),
        daysCount: 5, // 5 days was deducted!
        status: LeaveStatus.APPROVED,
        approverId: managerUser.id,
        user: { id: employeeUser.id, managerId: managerUser.id, name: "Alice" },
      } as any);

      vi.spyOn(leaveRepository, "findBalance").mockResolvedValue({
        id: "bal-restore",
        userId: employeeUser.id,
        year: 2026,
        casualDays: 12,
        sickDays: 12,
        annualDays: 15,
        usedCasual: 0,
        usedSick: 0,
        usedAnnual: 5, // currently 5
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updateBalanceSpy = vi.spyOn(leaveRepository, "updateBalance").mockResolvedValue({} as any);
      vi.spyOn(leaveRepository, "updateLeaveRequest").mockResolvedValue({
        id: "lv-approved-cancel",
        status: LeaveStatus.CANCELLED,
      } as any);

      await leaveService.cancelLeave("lv-approved-cancel", employeeUser, "Trip cancelled");

      // Balance restored: 5 - 5 = 0
      expect(updateBalanceSpy).toHaveBeenCalledWith(
        "bal-restore",
        { usedAnnual: 0 },
        expect.anything()
      );
      expect(notificationService.notify).toHaveBeenCalledWith(
        managerUser.id,
        "LEAVE_CANCELLED",
        "Approved Leave Cancelled",
        expect.stringContaining("cancelled their approved ANNUAL leave"),
        "/leaves/lv-approved-cancel",
        "Leave",
        "lv-approved-cancel"
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "LEAVE_CANCELLED",
          metadata: expect.objectContaining({
            wasApproved: true,
            balanceRestored: true,
          }),
        })
      );
    });

    it("rejects cancellation of an already CANCELLED leave with 409 Conflict", async () => {
      vi.spyOn(leaveRepository, "findLeaveById").mockResolvedValue({
        id: "lv-already-canc",
        userId: employeeUser.id,
        status: LeaveStatus.CANCELLED,
        user: { id: employeeUser.id, managerId: managerUser.id },
      } as any);

      await expect(
        leaveService.cancelLeave("lv-already-canc", employeeUser)
      ).rejects.toThrow("Cannot cancel leave request that is already cancelled");
    });

    it("blocks unauthorized user from cancelling someone else's leave", async () => {
      vi.spyOn(leaveRepository, "findLeaveById").mockResolvedValue({
        id: "lv-auth-check",
        userId: employeeUser.id,
        status: LeaveStatus.PENDING,
        user: { id: employeeUser.id, managerId: managerUser.id },
      } as any);

      // Carol from Sales tries to cancel Alice's leave
      await expect(
        leaveService.cancelLeave("lv-auth-check", otherManagerUser)
      ).rejects.toThrow("You are not authorized to cancel this leave request");
    });
  });

  describe("6. Role-Based List & Balance Permissions", () => {
    it("employee can only view their own leave list (throws 403 when requesting other user)", async () => {
      await expect(
        leaveService.listLeaves({ userId: "usr-emp-2" } as any, employeeUser)
      ).rejects.toThrow("Employees can only view their own leave requests");
    });

    it("manager can view direct report's leaves", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: employeeUser.id,
        managerId: managerUser.id,
      });
      vi.spyOn(leaveRepository, "listLeaves").mockResolvedValue([]);
      vi.spyOn(leaveRepository, "countLeaves").mockResolvedValue(0);

      const result = await leaveService.listLeaves(
        { userId: employeeUser.id } as any,
        managerUser
      );
      expect(result.leaves).toEqual([]);
    });

    it("manager is forbidden from viewing non-report's leaves", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "usr-other-report",
        managerId: "usr-different-manager",
      });

      await expect(
        leaveService.listLeaves({ userId: "usr-other-report" } as any, managerUser)
      ).rejects.toThrow("Managers can only view leaves of their direct reports or themselves");
    });

    it("employee cannot view another user's balance", async () => {
      await expect(
        leaveService.getBalance("usr-emp-2", 2026, employeeUser)
      ).rejects.toThrow("Employees can only view their own leave balance");
    });

    it("returns remaining leave counts alongside total and used balances", async () => {
      vi.spyOn(leaveRepository, "findBalance").mockResolvedValue({
        id: "bal-emp",
        userId: employeeUser.id,
        year: 2026,
        casualDays: 12,
        sickDays: 12,
        annualDays: 15,
        usedCasual: 3,
        usedSick: 2,
        usedAnnual: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const balance = await leaveService.getBalance(undefined, 2026, employeeUser);

      expect(balance.remainingCasual).toBe(9); // 12 - 3
      expect(balance.remainingSick).toBe(10); // 12 - 2
      expect(balance.remainingAnnual).toBe(10); // 15 - 5
    });
  });

  describe("7. Holiday Registration & Listing", () => {
    it("allows ADMIN to register a company holiday", async () => {
      vi.spyOn(leaveRepository, "findHolidayByDate").mockResolvedValue(null);
      vi.spyOn(leaveRepository, "createHoliday").mockResolvedValue({
        id: "hol-1",
        name: "Republic Day",
        date: new Date(Date.UTC(2026, 0, 26)),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const holiday = await leaveService.addHoliday(
        { name: "Republic Day", date: "2026-01-26" },
        adminUser
      );

      expect(holiday.name).toBe("Republic Day");
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "HOLIDAY_CREATED",
          entityType: "Holiday",
        })
      );
    });

    it("forbids non-admin users from registering company holidays", async () => {
      await expect(
        leaveService.addHoliday(
          { name: "Republic Day", date: "2026-01-26" },
          employeeUser
        )
      ).rejects.toThrow("Only Administrators can register company holidays");
    });

    it("rejects duplicate holiday registration on the same date with 409 Conflict", async () => {
      vi.spyOn(leaveRepository, "findHolidayByDate").mockResolvedValue({
        id: "hol-existing",
        name: "Republic Day",
        date: new Date(Date.UTC(2026, 0, 26)),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        leaveService.addHoliday(
          { name: "Republic Day Duplicate", date: "2026-01-26" },
          adminUser
        )
      ).rejects.toThrow(/already registered/);
    });
  });
});
