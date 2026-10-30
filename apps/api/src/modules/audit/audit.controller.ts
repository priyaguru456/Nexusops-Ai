import type { Request, Response, NextFunction } from "express";
import { auditService } from "./audit.service";
import { AppError } from "../../lib/errors";
import type { GetAuditLogsQuery } from "./audit.schema";

export class AuditController {
  async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const query = req.query as unknown as GetAuditLogsQuery;

      const result = await auditService.getLogs({
        action: query.action,
        entityType: query.entityType,
        entityId: query.entityId,
        actorId: query.actorId,
        startDate: query.startDate,
        endDate: query.endDate,
        page: query.page,
        limit: query.limit,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();
