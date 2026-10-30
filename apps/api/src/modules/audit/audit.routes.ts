import { Router } from "express";
import { Role } from "@prisma/client";
import { auditController } from "./audit.controller";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { getAuditLogsQuerySchema } from "./audit.schema";

export const auditRouter = Router();

auditRouter.use(authenticate);
auditRouter.use(authorize(Role.ADMIN));

auditRouter.get(
  "/",
  validate({ query: getAuditLogsQuerySchema }),
  (req, res, next) => auditController.getAuditLogs(req, res, next)
);
