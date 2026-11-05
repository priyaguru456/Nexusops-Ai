import { Router } from "express";
import { Role } from "@prisma/client";
import { approvalController } from "./approval.controller";
import { approvalFlowController } from "./approval-flow.controller";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  stepIdParamSchema,
  approveStepSchema,
  rejectStepSchema,
  reassignStepSchema,
  bulkApproveSchema,
} from "./approval.schema";
import {
  flowIdParamSchema,
  createApprovalFlowSchema,
  updateApprovalFlowSchema,
  flowQuerySchema,
} from "./approval-flow.schema";

export const approvalFlowRouter = Router();

// Flow CRUD endpoints - Admin Only
approvalFlowRouter.use(authenticate, authorize(Role.ADMIN));

approvalFlowRouter.get(
  "/",
  validate({ query: flowQuerySchema }),
  (req, res, next) => approvalFlowController.listFlows(req, res, next)
);

approvalFlowRouter.get(
  "/:id",
  validate({ params: flowIdParamSchema }),
  (req, res, next) => approvalFlowController.getFlowById(req, res, next)
);

approvalFlowRouter.post(
  "/",
  validate({ body: createApprovalFlowSchema }),
  (req, res, next) => approvalFlowController.createFlow(req, res, next)
);

approvalFlowRouter.patch(
  "/:id",
  validate({ params: flowIdParamSchema, body: updateApprovalFlowSchema }),
  (req, res, next) => approvalFlowController.updateFlow(req, res, next)
);

approvalFlowRouter.delete(
  "/:id",
  validate({ params: flowIdParamSchema }),
  (req, res, next) => approvalFlowController.deleteFlow(req, res, next)
);

export const approvalRouter = Router();

approvalRouter.use(authenticate);

// Mount flow routes at /api/approvals/flows
approvalRouter.use("/flows", approvalFlowRouter);

approvalRouter.get(
  "/pending",
  authorize(Role.MANAGER, Role.ADMIN),
  (req, res, next) => approvalController.getPendingApprovals(req, res, next)
);

approvalRouter.post(
  "/bulk-approve",
  authorize(Role.MANAGER, Role.ADMIN),
  validate({ body: bulkApproveSchema }),
  (req, res, next) => approvalController.bulkApprove(req, res, next)
);

approvalRouter.post(
  "/:stepId/approve",
  authorize(Role.MANAGER, Role.ADMIN),
  validate({ params: stepIdParamSchema, body: approveStepSchema }),
  (req, res, next) => approvalController.approveStep(req, res, next)
);

approvalRouter.post(
  "/:stepId/reject",
  authorize(Role.MANAGER, Role.ADMIN),
  validate({ params: stepIdParamSchema, body: rejectStepSchema }),
  (req, res, next) => approvalController.rejectStep(req, res, next)
);

approvalRouter.post(
  "/:stepId/reassign",
  authorize(Role.ADMIN),
  validate({ params: stepIdParamSchema, body: reassignStepSchema }),
  (req, res, next) => approvalController.reassignStep(req, res, next)
);
