import { prisma } from "../../lib/prisma";
import { AnnouncementPriority, Prisma } from "@prisma/client";
import type { AnnouncementQueryInput } from "./announcement.schema";

export interface CreateAnnouncementData {
  title: string;
  content: string;
  priority?: AnnouncementPriority;
  targetDepartmentId?: string | null;
  authorId: string;
  isPinned?: boolean;
  expiresAt?: Date | null;
}

export interface UpdateAnnouncementData {
  title?: string;
  content?: string;
  priority?: AnnouncementPriority;
  targetDepartmentId?: string | null;
  isPinned?: boolean;
  expiresAt?: Date | null;
}

export class AnnouncementRepository {
  async findVisibleForUser(
    userId: string,
    userDepartmentId: string | null,
    userRole: string,
    query: AnnouncementQueryInput
  ) {
    const now = new Date();

    const andConditions: Prisma.AnnouncementWhereInput[] = [
      // Active not expired condition
      {
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    ];

    // Department Visibility Rule:
    // Non-admins can ONLY see company-wide announcements (targetDepartmentId == null)
    // OR announcements targeted specifically to their department.
    if (userRole !== "ADMIN") {
      andConditions.push({
        OR: [
          { targetDepartmentId: null },
          ...(userDepartmentId ? [{ targetDepartmentId: userDepartmentId }] : []),
        ],
      });
    }

    if (query.search) {
      andConditions.push({
        OR: [
          { title: { contains: query.search, mode: "insensitive" } },
          { content: { contains: query.search, mode: "insensitive" } },
        ],
      });
    }

    if (query.priority) {
      andConditions.push({ priority: query.priority as AnnouncementPriority });
    }

    if (query.pinnedOnly) {
      andConditions.push({ isPinned: true });
    }

    if (query.unreadOnly) {
      andConditions.push({
        reads: {
          none: {
            userId,
          },
        },
      });
    }

    const where: Prisma.AnnouncementWhereInput = { AND: andConditions };

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [total, items, unreadCount] = await Promise.all([
      prisma.announcement.count({ where }),
      prisma.announcement.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          targetDepartment: {
            select: {
              id: true,
              name: true,
            },
          },
          reads: {
            where: { userId },
            select: {
              id: true,
              readAt: true,
            },
          },
          _count: {
            select: {
              reads: true,
            },
          },
        },
      }),
      // Total unread for this user across visible announcements
      prisma.announcement.count({
        where: {
          AND: [
            {
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            ...(userRole !== "ADMIN"
              ? [
                  {
                    OR: [
                      { targetDepartmentId: null },
                      ...(userDepartmentId ? [{ targetDepartmentId: userDepartmentId }] : []),
                    ],
                  },
                ]
              : []),
            {
              reads: {
                none: {
                  userId,
                },
              },
            },
          ],
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      unreadCount,
    };
  }

  async findById(id: string, currentUserId?: string) {
    return prisma.announcement.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        targetDepartment: {
          select: {
            id: true,
            name: true,
          },
        },
        reads: currentUserId
          ? {
              where: { userId: currentUserId },
              select: {
                id: true,
                readAt: true,
              },
            }
          : false,
        _count: {
          select: {
            reads: true,
          },
        },
      },
    });
  }

  async create(data: CreateAnnouncementData) {
    return prisma.announcement.create({
      data: {
        title: data.title,
        content: data.content,
        priority: data.priority ?? AnnouncementPriority.NORMAL,
        targetDepartmentId: data.targetDepartmentId ?? null,
        authorId: data.authorId,
        isPinned: data.isPinned ?? false,
        expiresAt: data.expiresAt ?? null,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        targetDepartment: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateAnnouncementData) {
    return prisma.announcement.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.targetDepartmentId !== undefined && {
          targetDepartmentId: data.targetDepartmentId,
        }),
        ...(data.isPinned !== undefined && { isPinned: data.isPinned }),
        ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt }),
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        targetDepartment: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    return prisma.announcement.delete({
      where: { id },
    });
  }

  async markAsRead(announcementId: string, userId: string) {
    return prisma.announcementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId,
          userId,
        },
      },
      update: {
        readAt: new Date(),
      },
      create: {
        announcementId,
        userId,
        readAt: new Date(),
      },
    });
  }

  async getReadStats(announcementId: string, targetDepartmentId: string | null) {
    const [readCount, totalTargetUsers, reads] = await Promise.all([
      prisma.announcementRead.count({
        where: { announcementId },
      }),
      prisma.user.count({
        where: {
          isActive: true,
          ...(targetDepartmentId ? { departmentId: targetDepartmentId } : {}),
        },
      }),
      prisma.announcementRead.findMany({
        where: { announcementId },
        orderBy: { readAt: "desc" },
        take: 50,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const percentage =
      totalTargetUsers > 0 ? Math.round((readCount / totalTargetUsers) * 100) : 0;

    return {
      readCount,
      totalTargetUsers,
      percentage,
      readers: reads.map((r) => ({
        id: r.id,
        userId: r.userId,
        name: r.user.name,
        email: r.user.email,
        role: r.user.role,
        departmentName: r.user.department?.name ?? "General",
        readAt: r.readAt,
      })),
    };
  }

  async getUnreadAnnouncements(
    userId: string,
    userDepartmentId: string | null,
    userRole: string,
    limit = 3
  ) {
    const now = new Date();

    const andConditions: Prisma.AnnouncementWhereInput[] = [
      {
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      {
        reads: {
          none: {
            userId,
          },
        },
      },
    ];

    if (userRole !== "ADMIN") {
      andConditions.push({
        OR: [
          { targetDepartmentId: null },
          ...(userDepartmentId ? [{ targetDepartmentId: userDepartmentId }] : []),
        ],
      });
    }

    return prisma.announcement.findMany({
      where: { AND: andConditions },
      take: limit,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        targetDepartment: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async countTargetUsers(targetDepartmentId: string | null): Promise<number> {
    return prisma.user.count({
      where: {
        isActive: true,
        ...(targetDepartmentId ? { departmentId: targetDepartmentId } : {}),
      },
    });
  }

  async getTargetUserIds(targetDepartmentId: string | null): Promise<string[]> {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        ...(targetDepartmentId ? { departmentId: targetDepartmentId } : {}),
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  async getDepartments(): Promise<{ id: string; name: string }[]> {
    return prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }
}

export const announcementRepository = new AnnouncementRepository();
