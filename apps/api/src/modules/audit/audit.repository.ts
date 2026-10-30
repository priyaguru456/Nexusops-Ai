import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";

export interface CreateAuditLogData {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface AuditLogFilters {
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  startDate?: Date;
  endDate?: Date;
  page: number;
  limit: number;
}

export class AuditRepository {
  async createLog(data: CreateAuditLogData) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId ?? null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId ?? null,
        metadata: data.metadata ?? Prisma.JsonNull,
      },
    });
  }

  async findAll(filters: AuditLogFilters) {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.action) {
      where.action = { contains: filters.action, mode: "insensitive" };
    }

    if (filters.entityType) {
      where.entityType = { contains: filters.entityType, mode: "insensitive" };
    }

    if (filters.entityId) {
      where.entityId = filters.entityId;
    }

    if (filters.actorId) {
      where.actorId = filters.actorId;
    }

    if (filters.startDate || filters.endDate) {
      const dateCondition: Prisma.DateTimeFilter = {};
      if (filters.startDate) dateCondition.gte = filters.startDate;
      if (filters.endDate) dateCondition.lte = filters.endDate;
      where.createdAt = dateCondition;
    }

    const skip = (filters.page - 1) * filters.limit;
    const take = filters.limit;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      logs,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit) || 1,
    };
  }
}

export const auditRepository = new AuditRepository();
