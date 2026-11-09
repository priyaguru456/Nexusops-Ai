import { describe, it, expect, vi, beforeEach } from "vitest";
import { Role, LeaveStatus, TaskStatus, Priority, RequestCategory, RequestStatus } from "@prisma/client";
import { calendarService } from "../../src/modules/calendar/calendar.service";
import { leaveService } from "../../src/modules/leaves/leave.service";
import { leaveRepository } from "../../src/modules/leaves/leave.repository";
import { auditService } from "../../src/modules/audit/audit.service";
import { prisma } from "../../src/lib/prisma";
import { AppError } from "../../src/lib/errors";
import type { AuthenticatedUser } from "../../src/types/express";

vi.mock("../../src/lib/prisma", () => {
  const mockClient: any = {
    $transaction: vi.fn(async (cb: any) => cb(mockClient)),
    task: {
      findMany: vi.fn(),
    },
    workRequest: {
      findMany: vi.fn(),
    },
    leaveRequest: {
      findMany: vi.fn(),
    },
    holiday: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
  return { prisma: mockClient };
});

vi.mock("../../src/modules/audit/audit.service", () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("Calendar Module - Backend Unit Tests", () => {
  const employeeUser: AuthenticatedUser = {
    id: "usr-emp-1",
    name: "Emp User",
    email: "emp@nexusops.com",
    role: Role.EMPLOYEE,
    departmentId: "dept-eng",
  };

  const managerUser: AuthenticatedUser = {
    id: "usr-mgr-1",
    name: "Mgr User",
    email: "mgr@nexusops.com",
    role: Role.MANAGER,
    departmentId: "dept-eng",
  };

  const adminUser: AuthenticatedUser = {
    id: "usr-admin-1",
    name: "Admin User",
    email: "admin@nexusops.com",
    role: Role.ADMIN,
    departmentId: "dept-exec",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("CalendarService.getEvents", () => {
    it("fetches role-scoped events for EMPLOYEE (own tasks, requests, leaves, and all holidays)", async () => {
      const mockTasks = [
        {
          id: "task-1",
          title: "Complete audit checklist",
          dueDate: new Date("2026-11-10T12:00:00.000Z"),
          status: TaskStatus.IN_PROGRESS,
          priority: Priority.HIGH,
          assigneeId: employeeUser.id,
          assignee: { name: employeeUser.name },
        },
      ];

      const mockRequests = [
        {
          id: "req-1",
          title: "MacBook Upgrade Request",
          dueDate: new Date("2026-11-12T15:00:00.000Z"),
          status: RequestStatus.SUBMITTED,
          priority: Priority.MEDIUM,
          category: RequestCategory.IT,
          requesterId: employeeUser.id,
          requester: { name: employeeUser.name },
          amount: 150000,
        },
      ];

      const mockLeaves = [
        {
          id: "leave-1",
          userId: employeeUser.id,
          type: "CASUAL",
          startDate: new Date("2026-11-15T00:00:00.000Z"),
          endDate: new Date("2026-11-16T00:00:00.000Z"),
          daysCount: 2,
          reason: "Personal work",
          status: LeaveStatus.APPROVED,
          user: { name: employeeUser.name, email: employeeUser.email, department: { name: "Engineering" } },
        },
      ];

      const mockHolidays = [
        {
          id: "hol-1",
          name: "Diwali",
          date: new Date("2026-11-08T00:00:00.000Z"),
        },
      ];

      (prisma.task.findMany as any).mockResolvedValue(mockTasks);
      (prisma.workRequest.findMany as any).mockResolvedValue(mockRequests);
      (prisma.leaveRequest.findMany as any).mockResolvedValue(mockLeaves);
      (prisma.holiday.findMany as any).mockResolvedValue(mockHolidays);

      const result = await calendarService.getEvents(
        { start: "2026-11-01", end: "2026-11-30" },
        employeeUser
      );

      expect(result.events).toHaveLength(4);
      expect(result.events.map((e) => e.type)).toEqual(
        expect.arrayContaining(["TASK", "REQUEST", "LEAVE", "HOLIDAY"])
      );

      // Verify Prisma queries included role-scoping for Employee
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { assigneeId: employeeUser.id },
              { request: { requesterId: employeeUser.id } },
            ],
          }),
        })
      );

      expect(prisma.workRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            requesterId: employeeUser.id,
          }),
        })
      );

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: LeaveStatus.APPROVED,
            userId: employeeUser.id,
          }),
        })
      );
    });

    it("fetches department-scoped leaves, tasks, and requests for MANAGER", async () => {
      (prisma.task.findMany as any).mockResolvedValue([]);
      (prisma.workRequest.findMany as any).mockResolvedValue([]);
      (prisma.leaveRequest.findMany as any).mockResolvedValue([]);
      (prisma.holiday.findMany as any).mockResolvedValue([]);

      await calendarService.getEvents(
        { start: "2026-11-01", end: "2026-11-30" },
        managerUser
      );

      // Manager sees team leaves (self + reports + department)
      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: LeaveStatus.APPROVED,
            OR: [
              { userId: managerUser.id },
              { user: { managerId: managerUser.id } },
              { user: { departmentId: managerUser.departmentId } },
            ],
          }),
        })
      );
    });

    it("fetches all data without scoping for ADMIN", async () => {
      (prisma.task.findMany as any).mockResolvedValue([]);
      (prisma.workRequest.findMany as any).mockResolvedValue([]);
      (prisma.leaveRequest.findMany as any).mockResolvedValue([]);
      (prisma.holiday.findMany as any).mockResolvedValue([]);

      await calendarService.getEvents(
        { start: "2026-11-01", end: "2026-11-30" },
        adminUser
      );

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            dueDate: {
              gte: new Date("2026-11-01T00:00:00.000Z"),
              lte: new Date("2026-11-30T23:59:59.999Z"),
            },
          },
        })
      );

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: LeaveStatus.APPROVED,
            startDate: { lte: new Date("2026-11-30T23:59:59.999Z") },
            endDate: { gte: new Date("2026-11-01T00:00:00.000Z") },
          },
        })
      );
    });

    it("respects types filter query to include only selected event types", async () => {
      (prisma.holiday.findMany as any).mockResolvedValue([
        { id: "h1", name: "New Year", date: new Date("2026-01-01T00:00:00.000Z") },
      ]);

      const result = await calendarService.getEvents(
        { start: "2026-01-01", end: "2026-01-31", types: "holidays" },
        employeeUser
      );

      expect(prisma.task.findMany).not.toHaveBeenCalled();
      expect(prisma.workRequest.findMany).not.toHaveBeenCalled();
      expect(prisma.leaveRequest.findMany).not.toHaveBeenCalled();
      expect(prisma.holiday.findMany).toHaveBeenCalled();
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe("HOLIDAY");
    });
  });

  describe("Admin Holiday Management (Add, Edit, Delete)", () => {
    it("allows ADMIN to add a new holiday with audit logging", async () => {
      const mockCreated = {
        id: "hol-new",
        name: "Republic Day",
        date: new Date("2026-01-26T00:00:00.000Z"),
      };
      (prisma.holiday.findUnique as any).mockResolvedValue(null);
      (prisma.holiday.create as any).mockResolvedValue(mockCreated);

      const result = await leaveService.addHoliday(
        { name: "Republic Day", date: "2026-01-26" },
        adminUser
      );

      expect(result).toEqual(mockCreated);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "HOLIDAY_CREATED",
          actorId: adminUser.id,
          entityType: "Holiday",
        })
      );
    });

    it("denies non-admin users from adding holidays (403 Forbidden)", async () => {
      await expect(
        leaveService.addHoliday({ name: "Holi", date: "2026-03-25" }, employeeUser)
      ).rejects.toThrow(AppError);
    });

    it("allows ADMIN to update a holiday name and date with audit logging", async () => {
      const existing = {
        id: "hol-1",
        name: "Old Name",
        date: new Date("2026-08-15T00:00:00.000Z"),
      };
      const updated = {
        id: "hol-1",
        name: "Independence Day",
        date: new Date("2026-08-15T00:00:00.000Z"),
      };

      (prisma.holiday.findUnique as any).mockImplementation(({ where }: any) => {
        if (where.id === "hol-1") return Promise.resolve(existing);
        return Promise.resolve(null);
      });
      (prisma.holiday.update as any).mockResolvedValue(updated);

      const result = await leaveService.updateHoliday(
        "hol-1",
        { name: "Independence Day" },
        adminUser
      );

      expect(result.name).toBe("Independence Day");
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "HOLIDAY_UPDATED",
          actorId: adminUser.id,
          entityId: "hol-1",
        })
      );
    });

    it("denies non-admin users from updating holidays (403 Forbidden)", async () => {
      await expect(
        leaveService.updateHoliday("hol-1", { name: "Test" }, managerUser)
      ).rejects.toThrow(AppError);
    });

    it("allows ADMIN to delete a holiday with audit logging", async () => {
      const existing = {
        id: "hol-del",
        name: "Gandhi Jayanti",
        date: new Date("2026-10-02T00:00:00.000Z"),
      };

      (prisma.holiday.findUnique as any).mockResolvedValue(existing);
      (prisma.holiday.delete as any).mockResolvedValue(existing);

      const result = await leaveService.deleteHoliday("hol-del", adminUser);

      expect(result.id).toBe("hol-del");
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "HOLIDAY_DELETED",
          actorId: adminUser.id,
          entityId: "hol-del",
        })
      );
    });

    it("denies non-admin users from deleting holidays (403 Forbidden)", async () => {
      await expect(
        leaveService.deleteHoliday("hol-del", employeeUser)
      ).rejects.toThrow(AppError);
    });
  });
});
