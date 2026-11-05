import type { Request, Response, NextFunction } from "express";
import { auditService } from "./audit.service";
import { AppError } from "../../lib/errors";
import type { GetAuditLogsQuery, ExportAuditLogsQuery } from "./audit.schema";

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str = typeof val === "object" ? JSON.stringify(val) : String(val);

  // Prevent CSV formula injection: prefix leading formula characters with a single quote
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }

  // Quote cell if it contains delimiter, quotes, or newlines
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatToKolkataString(date: Date): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

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
        actor: query.actor,
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

  async exportAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const query = req.query as unknown as ExportAuditLogsQuery;

      const logs = await auditService.getLogsForExport({
        action: query.action,
        entityType: query.entityType,
        entityId: query.entityId,
        actorId: query.actorId,
        actor: query.actor,
        startDate: query.startDate,
        endDate: query.endDate,
      });

      const header =
        "ID,Timestamp (UTC),Timestamp (Asia/Kolkata),Actor Name,Actor Email,Actor Role,Action,Entity Type,Entity ID,Summary,IP Address,Metadata";

      const csvRows = logs.map((log) =>
        [
          escapeCsvCell(log.id),
          escapeCsvCell(new Date(log.createdAt).toISOString()),
          escapeCsvCell(formatToKolkataString(new Date(log.createdAt))),
          escapeCsvCell(log.actor?.name || "System"),
          escapeCsvCell(log.actor?.email || ""),
          escapeCsvCell(log.actor?.role || ""),
          escapeCsvCell(log.action),
          escapeCsvCell(log.entityType),
          escapeCsvCell(log.entityId || ""),
          escapeCsvCell(log.summary || ""),
          escapeCsvCell(log.ipAddress || ""),
          escapeCsvCell(log.metadata ? JSON.stringify(log.metadata) : ""),
        ].join(",")
      );

      const csvContent = [header, ...csvRows].join("\r\n");
      const filename = `audit-logs-export-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.status(200).send(csvContent);
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();
