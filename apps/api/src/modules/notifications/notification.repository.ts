import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export interface CreateNotificationData {
  userId: string;
  type: string;
  title?: string;
  message: string;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

export class NotificationRepository {
  async create(data: CreateNotificationData) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title ?? "",
        message: data.message,
        link: data.link ?? null,
        entityType: data.entityType ?? null,
        entityId: data.entityId ?? null,
        isRead: false,
      },
    });
  }

  async createMany(items: CreateNotificationData[]) {
    if (items.length === 0) return { count: 0 };
    return prisma.notification.createMany({
      data: items.map((item) => ({
        userId: item.userId,
        type: item.type,
        title: item.title ?? "",
        message: item.message,
        link: item.link ?? null,
        entityType: item.entityType ?? null,
        entityId: item.entityId ?? null,
        isRead: false,
      })),
    });
  }

  async findByUser(
    userId: string,
    page = 1,
    limit = 20,
    unreadOnly = false
  ) {
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(Math.max(1, limit), 50);
    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limitNum,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };
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
    const now = new Date();
    const result = await prisma.notification.updateMany({
      where: {
        id,
        userId,
      },
      data: {
        isRead: true,
        readAt: now,
      },
    });

    if (result.count > 0) {
      return prisma.notification.findFirst({
        where: { id, userId },
      });
    }
    return null;
  }

  async markAllAsRead(userId: string) {
    const now = new Date();
    return prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: now,
      },
    });
  }
}

export const notificationRepository = new NotificationRepository();
