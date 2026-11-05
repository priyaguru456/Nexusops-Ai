import { Router } from "express";
import { Role } from "@prisma/client";
import { auditController } from "./audit.controller";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  getAuditLogsQuerySchema,
  exportAuditLogsQuerySchema,
} from "./audit.schema";

export const auditRouter = Router();

// Strict security: Authenticated administrators only
auditRouter.use(authenticate);
auditRouter.use(authorize(Role.ADMIN));

/**
 * GET /api/audit-logs
 * List audit logs with pagination and filters
 */
auditRouter.get(
  "/",
  validate({ query: getAuditLogsQuerySchema }),
  (req, res, next) => auditController.getAuditLogs(req, res, next)
);

/**
 * GET /api/audit-logs/export
 * Export audit logs to CSV with filters
 */
auditRouter.get(
  "/export",
  validate({ query: exportAuditLogsQuerySchema }),
  (req, res, next) => auditController.exportAuditLogs(req, res, next)
);
