import { describe, it, expect, vi, beforeEach } from "vitest";
import { notificationRepository } from "../../src/modules/notifications/notification.repository";
import {
  NotificationService,
  notificationService,
  notify,
} from "../../src/modules/notifications/notification.service";
import { NotificationController } from "../../src/modules/notifications/notification.controller";
import { prisma } from "../../src/lib/prisma";
import { AppError } from "../../src/lib/errors";

vi.mock("../../src/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        organizationId: "00000000-0000-4000-8000-000000000001",
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    notification: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

describe("Notification Center: Unit Tests & User Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Repository Layer & User Isolation", () => {
    it("creates notification with title, type, link, entityType, and entityId", async () => {
      const mockNotif = {
        id: "notif-1",
        userId: "user-1",
        type: "TASK_ASSIGNED",
        title: "Task Assigned",
        message: "You have been assigned to task 'Fix bug'",
        link: "/tasks",
        entityType: "Task",
        entityId: "task-100",
        isRead: false,
        readAt: null,
        createdAt: new Date(),
      };

      vi.mocked(prisma.notification.create).mockResolvedValue(mockNotif as any);

      const result = await notificationRepository.create({
        userId: "user-1",
        type: "TASK_ASSIGNED",
        title: "Task Assigned",
        message: "You have been assigned to task 'Fix bug'",
        link: "/tasks",
        entityType: "Task",
        entityId: "task-100",
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          organizationId: "00000000-0000-4000-8000-000000000001",
          type: "TASK_ASSIGNED",
          title: "Task Assigned",
          message: "You have been assigned to task 'Fix bug'",
          link: "/tasks",
          entityType: "Task",
          entityId: "task-100",
          isRead: false,
        },
      });
      expect(result).toEqual(mockNotif);
    });

    it("STRICT ISOLATION: findByUser strictly scopes query to requesting user", async () => {
      const userANotifs = [
        {
          id: "notif-a1",
          userId: "user-a",
          title: "Alert for User A",
          message: "User A private info",
          isRead: false,
          createdAt: new Date(),
        },
      ];

      vi.mocked(prisma.notification.findMany).mockResolvedValue(userANotifs as any);
      vi.mocked(prisma.notification.count).mockResolvedValue(1);

      const result = await notificationRepository.findByUser("user-a", 1, 10, false);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: "user-a" },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      });
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: "user-a" },
      });
      expect(result.items).toEqual(userANotifs);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it("STRICT ISOLATION: User A cannot see or mark User B's notification as read", async () => {
      // User A attempts to mark notif-b (belonging to user-b) as read
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 0 });

      const result = await notificationRepository.markAsRead("notif-b", "user-a");

      // Verify update query strictly enforced { id: "notif-b", userId: "user-a" }
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          id: "notif-b",
          userId: "user-a",
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });

      // Because count is 0, repository returns null
      expect(result).toBeNull();
    });

    it("markAsRead updates isRead and readAt for own notification", async () => {
      const now = new Date();
      const updatedNotif = {
        id: "notif-a1",
        userId: "user-a",
        title: "Test",
        message: "Message",
        isRead: true,
        readAt: now,
      };

      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.notification.findFirst).mockResolvedValue(updatedNotif as any);

      const result = await notificationRepository.markAsRead("notif-a1", "user-a");

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          id: "notif-a1",
          userId: "user-a",
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
      expect(result).toEqual(updatedNotif);
    });

    it("markAllAsRead updates all unread notifications scoped to the user", async () => {
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 3 });

      const result = await notificationRepository.markAllAsRead("user-a");

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: "user-a",
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
      expect(result.count).toBe(3);
    });
  });

  describe("Service Layer & notify Helper", () => {
    it("calls notify with positional arguments: notify(userId, type, title, message, link)", async () => {
      const createSpy = vi.spyOn(notificationRepository, "create").mockResolvedValue({} as any);

      await notify("usr-1", "TASK_ASSIGNED", "Task Assigned", "You were assigned a task", "/tasks");

      expect(createSpy).toHaveBeenCalledWith({
        userId: "usr-1",
        type: "TASK_ASSIGNED",
        title: "Task Assigned",
        message: "You were assigned a task",
        link: "/tasks",
        entityType: null,
        entityId: null,
      });
    });

    it("calls notify with object argument and defaults title if missing", async () => {
      const createSpy = vi.spyOn(notificationRepository, "create").mockResolvedValue({} as any);

      await notificationService.notify({
        userId: "usr-2",
        type: "APPROVAL_REQUESTED",
        message: "Approval needed for request #123",
        link: "/requests/123",
      });

      expect(createSpy).toHaveBeenCalledWith({
        userId: "usr-2",
        type: "APPROVAL_REQUESTED",
        title: "Approval Requested",
        message: "Approval needed for request #123",
        link: "/requests/123",
      });
    });

    it("notifyMultiple deduplicates user IDs and handles legacy and new argument shapes", async () => {
      const createManySpy = vi
        .spyOn(notificationRepository, "createMany")
        .mockResolvedValue({ count: 2 });

      await notificationService.notifyMultiple(
        ["u1", "u2", "u1"],
        "APPROVAL_REQUESTED",
        "Approval Required",
        "Please review request",
        "/requests/456",
        "WorkRequest",
        "req-456"
      );

      expect(createManySpy).toHaveBeenCalledWith([
        {
          userId: "u1",
          type: "APPROVAL_REQUESTED",
          title: "Approval Required",
          message: "Please review request",
          link: "/requests/456",
          entityType: "WorkRequest",
          entityId: "req-456",
        },
        {
          userId: "u2",
          type: "APPROVAL_REQUESTED",
          title: "Approval Required",
          message: "Please review request",
          link: "/requests/456",
          entityType: "WorkRequest",
          entityId: "req-456",
        },
      ]);
    });

    it("getUserNotifications returns paginated results and unreadCount", async () => {
      vi.spyOn(notificationRepository, "findByUser").mockResolvedValue({
        items: [{ id: "n1" } as any],
        total: 15,
        page: 2,
        limit: 10,
        totalPages: 2,
      });
      vi.spyOn(notificationRepository, "countUnread").mockResolvedValue(4);

      const result = await notificationService.getUserNotifications("usr-1", 2, 10, false);

      expect(result).toEqual({
        notifications: [{ id: "n1" }],
        total: 15,
        page: 2,
        limit: 10,
        totalPages: 2,
        unreadCount: 4,
      });
    });
  });

  describe("Controller Layer & Authorization", () => {
    const controller = new NotificationController();

    it("rejects unauthenticated requests on getNotifications with 401 Unauthorized", async () => {
      const req: any = { user: null };
      const res: any = {};
      const next = vi.fn();

      await controller.getNotifications(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(401);
    });

    it("returns paginated list for authenticated user", async () => {
      const req: any = {
        user: { id: "usr-auth-1" },
        query: { page: "1", limit: "15", unreadOnly: "false" },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      vi.spyOn(notificationService, "getUserNotifications").mockResolvedValue({
        notifications: [],
        total: 0,
        page: 1,
        limit: 15,
        totalPages: 1,
        unreadCount: 0,
      });

      await controller.getNotifications(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        notifications: [],
        total: 0,
        page: 1,
        limit: 15,
        totalPages: 1,
        unreadCount: 0,
      });
    });

    it("markAsRead throws 404 when notification not found or belongs to another user", async () => {
      const req: any = {
        user: { id: "usr-attacker" },
        params: { id: "notif-victim" },
      };
      const res: any = {};
      const next = vi.fn();

      vi.spyOn(notificationService, "markAsRead").mockResolvedValue(null);

      await controller.markAsRead(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Notification not found");
    });

    it("markAllAsRead marks all notifications read for the user", async () => {
      const req: any = {
        user: { id: "usr-1" },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      vi.spyOn(notificationService, "markAllAsRead").mockResolvedValue({ count: 5 });

      await controller.markAllAsRead(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, count: 5 });
    });
  });
});
