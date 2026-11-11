import { prisma } from "../../lib/prisma";

export const commentUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

export interface CreateCommentData {
  entityType: string;
  entityId: string;
  body: string;
  userId: string;
  organizationId: string;
}

export class CommentRepository {
  async create(data: CreateCommentData) {
    return prisma.comment.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        body: data.body,
        userId: data.userId,
        organizationId: data.organizationId,
      },
      include: {
        user: {
          select: commentUserSelect,
        },
      },
    });
  }

  async findByEntity(entityType: string, entityId: string, organizationId?: string) {
    const alternativeType =
      entityType === "request" ? "WorkRequest" : entityType === "task" ? "Task" : entityType;

    return prisma.comment.findMany({
      where: {
        entityId,
        entityType: {
          in: [entityType, alternativeType],
        },
        ...(organizationId ? { organizationId } : {}),
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        user: {
          select: commentUserSelect,
        },
      },
    });
  }
}

export const commentRepository = new CommentRepository();
