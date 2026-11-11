import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";

export interface CreateAuditLogData {
  actorId?: string | null;
  organizationId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  ipAddress?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface AuditLogFilters {
  organizationId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  actor?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export class AuditRepository {
  async createLog(data: CreateAuditLogData) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId ?? null,
        organizationId: data.organizationId ?? null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId ?? null,
        summary: data.summary ?? null,
        ipAddress: data.ipAddress ?? null,
        metadata: data.metadata ?? Prisma.JsonNull,
      },
    });
  }

  private buildWhere(filters: Omit<AuditLogFilters, "page" | "limit">): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.organizationId) {
      where.organizationId = filters.organizationId;
    }

    if (filters.action?.trim()) {
      where.action = { contains: filters.action.trim(), mode: "insensitive" };
    }

    if (filters.entityType?.trim()) {
      where.entityType = { contains: filters.entityType.trim(), mode: "insensitive" };
    }

    if (filters.entityId?.trim()) {
      where.entityId = filters.entityId.trim();
    }

    if (filters.actorId?.trim()) {
      where.actorId = filters.actorId.trim();
    }

    if (filters.actor?.trim()) {
      const searchTerm = filters.actor.trim();
      where.OR = [
        { actorId: searchTerm },
        { actor: { name: { contains: searchTerm, mode: "insensitive" } } },
        { actor: { email: { contains: searchTerm, mode: "insensitive" } } },
      ];
    }

    if (filters.startDate || filters.endDate) {
      const dateCondition: Prisma.DateTimeFilter = {};
      if (filters.startDate) dateCondition.gte = filters.startDate;
      if (filters.endDate) dateCondition.lte = filters.endDate;
      where.createdAt = dateCondition;
    }

    return where;
  }

  async findAll(filters: AuditLogFilters) {
    const where = this.buildWhere(filters);

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;
    const take = limit;

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
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findForExport(filters: Omit<AuditLogFilters, "page" | "limit">) {
    const where = this.buildWhere(filters);

    return prisma.auditLog.findMany({
      where,
      take: 5000,
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
    });
  }
}

export const auditRepository = new AuditRepository();
