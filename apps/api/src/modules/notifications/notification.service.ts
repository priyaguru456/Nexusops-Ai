import {
  notificationRepository,
  type CreateNotificationData,
} from "./notification.repository";
import { logger } from "../../lib/logger";

export class NotificationService {
  async notify(data: CreateNotificationData): Promise<void> {
    try {
      await notificationRepository.create(data);
    } catch (err) {
      logger.error(err, `Failed to deliver notification to user ${data.userId}`);
    }
  }

  async notifyMultiple(
    userIds: string[],
    type: string,
    message: string,
    link?: string | null
  ): Promise<void> {
    try {
      const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);
      await notificationRepository.createMany(
        uniqueIds.map((userId) => ({ userId, type, message, link }))
      );
    } catch (err) {
      logger.error(err, "Failed to deliver notifications to multiple users");
    }
  }

  async getUserNotifications(userId: string, unreadOnly = false, limit = 20) {
    const [notifications, unreadCount] = await Promise.all([
      notificationRepository.findByUser(userId, unreadOnly, limit),
      notificationRepository.countUnread(userId),
    ]);

    return {
      notifications,
      unreadCount,
    };
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await notificationRepository.markAsRead(id, userId);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await notificationRepository.markAllAsRead(userId);
  }
}

export const notificationService = new NotificationService();
