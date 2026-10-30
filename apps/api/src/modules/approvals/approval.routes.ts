import { Router } from "express";
import { Role } from "@prisma/client";
import { approvalController } from "./approval.controller";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  stepIdParamSchema,
  approveStepSchema,
  rejectStepSchema,
  reassignStepSchema,
} from "./approval.schema";

export const approvalRouter = Router();

approvalRouter.use(authenticate);

approvalRouter.get(
  "/pending",
  (req, res, next) => approvalController.getPendingApprovals(req, res, next)
);

approvalRouter.post(
  "/:stepId/approve",
  validate({ params: stepIdParamSchema, body: approveStepSchema }),
  (req, res, next) => approvalController.approveStep(req, res, next)
);

approvalRouter.post(
  "/:stepId/reject",
  validate({ params: stepIdParamSchema, body: rejectStepSchema }),
  (req, res, next) => approvalController.rejectStep(req, res, next)
);

approvalRouter.post(
  "/:stepId/reassign",
  authorize(Role.ADMIN),
  validate({ params: stepIdParamSchema, body: reassignStepSchema }),
  (req, res, next) => approvalController.reassignStep(req, res, next)
);
