import { prisma } from "../../lib/prisma";

export interface CreateNotificationData {
  userId: string;
  type: string;
  message: string;
  link?: string | null;
}

export class NotificationRepository {
  async create(data: CreateNotificationData) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        message: data.message,
        link: data.link ?? null,
      },
    });
  }

  async createMany(items: CreateNotificationData[]) {
    if (items.length === 0) return { count: 0 };
    return prisma.notification.createMany({
      data: items.map((item) => ({
        userId: item.userId,
        type: item.type,
        message: item.message,
        link: item.link ?? null,
      })),
    });
  }

  async findByUser(userId: string, unreadOnly = false, limit = 20) {
    return prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });
  }

  async countUnread(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  async markAsRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: {
        id,
        userId,
      },
      data: {
        isRead: true,
      },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
  }
}

export const notificationRepository = new NotificationRepository();
