import {
  notificationRepository,
  type CreateNotificationData,
} from "./notification.repository";
import { logger } from "../../lib/logger";

export class NotificationService {
  /**
   * Primary notify helper supporting both positional arguments:
   *   notify(userId, type, title, message, link, entityType, entityId)
   * and object argument:
   *   notify({ userId, type, title, message, link, entityType, entityId })
   */
  async notify(
    userIdOrData: string | CreateNotificationData,
    type?: string,
    title?: string,
    message?: string,
    link?: string | null,
    entityType?: string | null,
    entityId?: string | null
  ): Promise<void> {
    try {
      let data: CreateNotificationData;
      if (typeof userIdOrData === "string") {
        data = {
          userId: userIdOrData,
          type: type || "SYSTEM",
          title: title || this.formatDefaultTitle(type),
          message: message || "",
          link: link ?? null,
          entityType: entityType ?? null,
          entityId: entityId ?? null,
        };
      } else {
        data = {
          ...userIdOrData,
          title: userIdOrData.title || this.formatDefaultTitle(userIdOrData.type),
        };
      }

      await notificationRepository.create(data);
    } catch (err) {
      const targetUser = typeof userIdOrData === "string" ? userIdOrData : userIdOrData.userId;
      logger.error(err, `Failed to deliver notification to user ${targetUser}`);
    }
  }

  async notifyMultiple(
    userIds: string[],
    type: string,
    titleOrMessage: string,
    messageOrLink?: string | null,
    link?: string | null,
    entityType?: string | null,
    entityId?: string | null
  ): Promise<void> {
    try {
      const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);
      if (uniqueIds.length === 0) return;

      let finalTitle: string;
      let finalMessage: string;
      let finalLink: string | null | undefined;
      let finalEntityType: string | null | undefined = entityType;
      let finalEntityId: string | null | undefined = entityId;

      if (link !== undefined || entityType !== undefined) {
        // Called with (userIds, type, title, message, link, entityType, entityId)
        finalTitle = titleOrMessage;
        finalMessage = messageOrLink || "";
        finalLink = link;
      } else {
        // Called with (userIds, type, message, link) legacy
        finalTitle = this.formatDefaultTitle(type);
        finalMessage = titleOrMessage;
        finalLink = messageOrLink;
      }

      await notificationRepository.createMany(
        uniqueIds.map((userId) => ({
          userId,
          type,
          title: finalTitle,
          message: finalMessage,
          link: finalLink ?? null,
          entityType: finalEntityType ?? null,
          entityId: finalEntityId ?? null,
        }))
      );
    } catch (err) {
      logger.error(err, "Failed to deliver notifications to multiple users");
    }
  }

  private formatDefaultTitle(type?: string): string {
    switch (type) {
      case "APPROVAL_REQUESTED":
        return "Approval Requested";
      case "APPROVAL_DECISION":
        return "Approval Decision";
      case "TASK_ASSIGNED":
        return "Task Assigned";
      case "REQUEST_STATUS_CHANGED":
        return "Request Update";
      default:
        return "System Notification";
    }
  }

  async getUserNotifications(
    userId: string,
    page = 1,
    limit = 20,
    unreadOnly = false
  ) {
    const [pagedResult, unreadCount] = await Promise.all([
      notificationRepository.findByUser(userId, page, limit, unreadOnly),
      notificationRepository.countUnread(userId),
    ]);

    return {
      notifications: pagedResult.items,
      total: pagedResult.total,
      page: pagedResult.page,
      limit: pagedResult.limit,
      totalPages: pagedResult.totalPages,
      unreadCount,
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return notificationRepository.countUnread(userId);
  }

  async markAsRead(id: string, userId: string) {
    return notificationRepository.markAsRead(id, userId);
  }

  async markAllAsRead(userId: string) {
    return notificationRepository.markAllAsRead(userId);
  }
}

export const notificationService = new NotificationService();

/**
 * Reusable helper notify(userId, type, title, message, link, entityType, entityId)
 * that other modules can call directly.
 */
export async function notify(
  userId: string,
  type: string,
  title: string,
  message: string,
  link?: string | null,
  entityType?: string | null,
  entityId?: string | null
): Promise<void> {
  return notificationService.notify(userId, type, title, message, link, entityType, entityId);
}
