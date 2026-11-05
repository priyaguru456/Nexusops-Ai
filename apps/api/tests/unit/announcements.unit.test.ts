import { describe, it, expect, vi, beforeEach } from "vitest";
import { Role, AnnouncementPriority } from "@prisma/client";
import { announcementRepository } from "../../src/modules/announcements/announcement.repository";
import {
  AnnouncementService,
  announcementService,
} from "../../src/modules/announcements/announcement.service";
import { AnnouncementController } from "../../src/modules/announcements/announcement.controller";
import { auditService } from "../../src/modules/audit/audit.service";
import { notificationService } from "../../src/modules/notifications/notification.service";
import { prisma } from "../../src/lib/prisma";
import { AppError } from "../../src/lib/errors";
import type { AuthenticatedUser } from "../../src/types/express";

vi.mock("../../src/lib/prisma", () => ({
  prisma: {
    announcement: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    announcementRead: {
      upsert: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../../src/modules/audit/audit.service", () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../src/modules/notifications/notification.service", () => ({
  notificationService: {
    notifyMultiple: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("Announcements Module Unit & Authorization Tests", () => {
  const adminUser: AuthenticatedUser = {
    id: "usr-admin-1",
    name: "Admin User",
    email: "admin@nexusops.com",
    role: Role.ADMIN,
    isActive: true,
    departmentId: "dept-it",
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const managerIT: AuthenticatedUser = {
    id: "usr-mgr-it",
    name: "IT Manager",
    email: "manager.it@nexusops.com",
    role: Role.MANAGER,
    isActive: true,
    departmentId: "dept-it",
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const employeeIT: AuthenticatedUser = {
    id: "usr-emp-it",
    name: "IT Employee",
    email: "employee.it@nexusops.com",
    role: Role.EMPLOYEE,
    isActive: true,
    departmentId: "dept-it",
    managerId: "usr-mgr-it",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const employeeHR: AuthenticatedUser = {
    id: "usr-emp-hr",
    name: "HR Employee",
    email: "employee.hr@nexusops.com",
    role: Role.EMPLOYEE,
    isActive: true,
    departmentId: "dept-hr",
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Service Layer: Role & Department Scoping", () => {
    it("Admin can create company-wide announcements (targetDepartmentId == null)", async () => {
      const mockCreated = {
        id: "ann-1",
        title: "Company Town Hall",
        content: "All hands meeting",
        priority: AnnouncementPriority.NORMAL,
        targetDepartmentId: null,
        authorId: adminUser.id,
        isPinned: true,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(announcementRepository, "create").mockResolvedValue(mockCreated as any);
      vi.spyOn(announcementRepository, "countTargetUsers").mockResolvedValue(50);

      const result = await announcementService.create(adminUser, {
        title: "Company Town Hall",
        content: "All hands meeting",
        priority: "NORMAL",
        targetDepartmentId: null,
        isPinned: true,
      });

      expect(announcementRepository.create).toHaveBeenCalledWith({
        title: "Company Town Hall",
        content: "All hands meeting",
        priority: "NORMAL",
        targetDepartmentId: null,
        authorId: adminUser.id,
        isPinned: true,
        expiresAt: null,
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: adminUser.id,
          action: "ANNOUNCEMENT_CREATED",
          entityType: "Announcement",
          entityId: "ann-1",
        })
      );

      // Normal priority should not trigger notifications
      expect(notificationService.notifyMultiple).not.toHaveBeenCalled();
      expect(result.id).toBe("ann-1");
      expect(result.totalTargetUsers).toBe(50);
    });

    it("Admin can target any department", async () => {
      const mockCreated = {
        id: "ann-2",
        title: "HR Special Notice",
        content: "HR instructions",
        priority: AnnouncementPriority.NORMAL,
        targetDepartmentId: "dept-hr",
        authorId: adminUser.id,
        isPinned: false,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(announcementRepository, "create").mockResolvedValue(mockCreated as any);
      vi.spyOn(announcementRepository, "countTargetUsers").mockResolvedValue(10);

      const result = await announcementService.create(adminUser, {
        title: "HR Special Notice",
        content: "HR instructions",
        priority: "NORMAL",
        targetDepartmentId: "dept-hr",
        isPinned: false,
      });

      expect(result.targetDepartmentId).toBe("dept-hr");
    });

    it("Manager can only target their own department", async () => {
      const mockCreated = {
        id: "ann-3",
        title: "IT Internal Notice",
        content: "Server deployment tonight",
        priority: AnnouncementPriority.NORMAL,
        targetDepartmentId: "dept-it",
        authorId: managerIT.id,
        isPinned: false,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(announcementRepository, "create").mockResolvedValue(mockCreated as any);
      vi.spyOn(announcementRepository, "countTargetUsers").mockResolvedValue(8);

      const result = await announcementService.create(managerIT, {
        title: "IT Internal Notice",
        content: "Server deployment tonight",
        priority: "NORMAL",
        targetDepartmentId: "dept-it",
      });

      expect(result.targetDepartmentId).toBe("dept-it");
    });

    it("Manager attempting to target another department is rejected with 403 Forbidden", async () => {
      await expect(
        announcementService.create(managerIT, {
          title: "Intrusion Attempt",
          content: "Trying to target HR",
          priority: "NORMAL",
          targetDepartmentId: "dept-hr",
        })
      ).rejects.toThrow("Managers may only target their own department");
    });

    it("Manager without department cannot create announcements", async () => {
      const managerWithoutDept: AuthenticatedUser = {
        ...managerIT,
        departmentId: null,
      };

      await expect(
        announcementService.create(managerWithoutDept, {
          title: "Notice",
          content: "Some content",
        })
      ).rejects.toThrow("Manager must belong to a department to create announcements");
    });

    it("Employee cannot create announcements (403 Forbidden)", async () => {
      await expect(
        announcementService.create(employeeIT, {
          title: "Employee Broadcast",
          content: "Unauthorized content",
        })
      ).rejects.toThrow("Only Administrators and Managers can post announcements");
    });

    it("URGENT announcement sends notifications to target users and excludes author", async () => {
      const mockCreated = {
        id: "ann-urgent-1",
        title: "Critical Security Patch",
        content: "Please restart workstations immediately",
        priority: AnnouncementPriority.URGENT,
        targetDepartmentId: "dept-it",
        authorId: managerIT.id,
        isPinned: true,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(announcementRepository, "create").mockResolvedValue(mockCreated as any);
      vi.spyOn(announcementRepository, "countTargetUsers").mockResolvedValue(3);
      vi.spyOn(announcementRepository, "getTargetUserIds").mockResolvedValue([
        managerIT.id,
        "usr-emp-it-1",
        "usr-emp-it-2",
      ]);

      await announcementService.create(managerIT, {
        title: "Critical Security Patch",
        content: "Please restart workstations immediately",
        priority: "URGENT",
        targetDepartmentId: "dept-it",
        isPinned: true,
      });

      // Notification sent to users except author (managerIT.id)
      expect(notificationService.notifyMultiple).toHaveBeenCalledWith(
        ["usr-emp-it-1", "usr-emp-it-2"],
        "ANNOUNCEMENT",
        "Urgent Announcement: Critical Security Patch",
        "Urgent operational announcement: Critical Security Patch",
        "/announcements",
        "Announcement",
        "ann-urgent-1"
      );
    });

    it("Manager cannot update an announcement belonging to another department", async () => {
      vi.spyOn(announcementRepository, "findById").mockResolvedValue({
        id: "ann-hr",
        title: "HR Policy",
        targetDepartmentId: "dept-hr",
        authorId: "usr-hr-mgr",
      } as any);

      await expect(
        announcementService.update("ann-hr", managerIT, {
          title: "Updated by IT",
        })
      ).rejects.toThrow("Managers can only manage announcements in their own department");
    });

    it("Manager cannot delete an announcement belonging to another department", async () => {
      vi.spyOn(announcementRepository, "findById").mockResolvedValue({
        id: "ann-hr",
        title: "HR Policy",
        targetDepartmentId: "dept-hr",
        authorId: "usr-hr-mgr",
      } as any);

      await expect(announcementService.delete("ann-hr", managerIT)).rejects.toThrow(
        "Managers can only delete announcements in their own department"
      );
    });

    it("Admin can update and delete any announcement", async () => {
      vi.spyOn(announcementRepository, "findById").mockResolvedValue({
        id: "ann-hr",
        title: "HR Policy",
        targetDepartmentId: "dept-hr",
        authorId: "usr-hr-mgr",
      } as any);

      vi.spyOn(announcementRepository, "update").mockResolvedValue({
        id: "ann-hr",
        title: "Updated HR Policy",
      } as any);

      vi.spyOn(announcementRepository, "delete").mockResolvedValue({ id: "ann-hr" } as any);

      const updated = await announcementService.update("ann-hr", adminUser, {
        title: "Updated HR Policy",
      });
      expect(updated.title).toBe("Updated HR Policy");

      const del = await announcementService.delete("ann-hr", adminUser);
      expect(del.success).toBe(true);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ANNOUNCEMENT_DELETED",
          entityId: "ann-hr",
        })
      );
    });
  });

  describe("Visibility & Mark As Read Logic", () => {
    it("list filters announcements by department or company-wide and computes isRead", async () => {
      const mockItems = [
        {
          id: "ann-pinned",
          title: "Pinned Announcement",
          content: "Important info",
          priority: AnnouncementPriority.NORMAL,
          targetDepartmentId: null,
          authorId: adminUser.id,
          isPinned: true,
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          reads: [{ id: "read-1", readAt: new Date() }],
          _count: { reads: 12 },
          author: { id: adminUser.id, name: "Admin", email: "admin@test.com", role: Role.ADMIN },
          targetDepartment: null,
        },
      ];

      vi.spyOn(announcementRepository, "findVisibleForUser").mockResolvedValue({
        items: mockItems as any,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        unreadCount: 0,
      });

      const result = await announcementService.list(employeeIT, { page: 1, limit: 20 });

      expect(announcementRepository.findVisibleForUser).toHaveBeenCalledWith(
        employeeIT.id,
        "dept-it",
        Role.EMPLOYEE,
        { page: 1, limit: 20 }
      );

      expect(result.items[0].isRead).toBe(true);
      expect(result.items[0].readCount).toBe(12);
    });

    it("getById returns 404 when announcement targets another department", async () => {
      vi.spyOn(announcementRepository, "findById").mockResolvedValue({
        id: "ann-finance",
        title: "Finance Secret",
        targetDepartmentId: "dept-finance",
        reads: [],
        _count: { reads: 0 },
      } as any);

      // employeeIT is in dept-it
      await expect(announcementService.getById("ann-finance", employeeIT)).rejects.toThrow(
        "Announcement not found"
      );
    });

    it("markAsRead records read timestamp and returns success", async () => {
      const readTimestamp = new Date();
      vi.spyOn(announcementRepository, "findById").mockResolvedValue({
        id: "ann-visible",
        targetDepartmentId: null,
      } as any);

      vi.spyOn(announcementRepository, "markAsRead").mockResolvedValue({
        id: "read-rec-1",
        announcementId: "ann-visible",
        userId: employeeIT.id,
        readAt: readTimestamp,
      });

      const result = await announcementService.markAsRead("ann-visible", employeeIT);
      expect(result.success).toBe(true);
      expect(result.readAt).toEqual(readTimestamp);
    });

    it("markAsRead rejects if announcement is in another department", async () => {
      vi.spyOn(announcementRepository, "findById").mockResolvedValue({
        id: "ann-hidden",
        targetDepartmentId: "dept-finance",
      } as any);

      await expect(announcementService.markAsRead("ann-hidden", employeeIT)).rejects.toThrow(
        "Announcement not found"
      );
    });

    it("getReadStats returns read counts for author", async () => {
      vi.spyOn(announcementRepository, "findById").mockResolvedValue({
        id: "ann-mine",
        authorId: managerIT.id,
        targetDepartmentId: "dept-it",
      } as any);

      vi.spyOn(announcementRepository, "getReadStats").mockResolvedValue({
        readCount: 5,
        totalTargetUsers: 10,
        percentage: 50,
        readers: [],
      });

      const stats = await announcementService.getReadStats("ann-mine", managerIT);
      expect(stats.readCount).toBe(5);
      expect(stats.totalTargetUsers).toBe(10);
      expect(stats.percentage).toBe(50);
    });

    it("getReadStats forbids non-author employee from viewing stats", async () => {
      vi.spyOn(announcementRepository, "findById").mockResolvedValue({
        id: "ann-others",
        authorId: managerIT.id,
        targetDepartmentId: "dept-it",
      } as any);

      await expect(announcementService.getReadStats("ann-others", employeeIT)).rejects.toThrow(
        "Only the author or an Administrator can view read metrics"
      );
    });
  });

  describe("Controller Layer: HTTP Status & Error Handling", () => {
    const controller = new AnnouncementController();

    it("rejects unauthenticated requests on list with 401 Unauthorized", async () => {
      const req: any = { user: null, query: {} };
      const res: any = {};
      const next = vi.fn();

      await controller.list(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("returns 201 Created on create", async () => {
      const req: any = {
        user: adminUser,
        body: {
          title: "New Policy",
          content: "Content",
          priority: "NORMAL",
        },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      vi.spyOn(announcementService, "create").mockResolvedValue({ id: "ann-new" } as any);

      await controller.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: "ann-new" });
    });

    it("returns 200 OK on markAsRead", async () => {
      const req: any = {
        user: employeeIT,
        params: { id: "ann-123" },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      vi.spyOn(announcementService, "markAsRead").mockResolvedValue({
        success: true,
        readAt: new Date(),
      });

      await controller.markAsRead(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
