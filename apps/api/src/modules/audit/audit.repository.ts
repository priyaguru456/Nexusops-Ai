import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";

export interface CreateAuditLogData {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
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
}

export const auditRepository = new AuditRepository();
