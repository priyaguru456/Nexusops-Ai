import { Router } from "express";
import { Role } from "@prisma/client";
import { requestController } from "./request.controller";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { upload } from "../../middleware/upload";
import {
  requestIdParamSchema,
  createRequestSchema,
  updateRequestSchema,
  updateRequestStatusSchema,
  getRequestsQuerySchema,
} from "./request.schema";

export const requestRouter = Router();

requestRouter.use(authenticate);

requestRouter.post(
  "/",
  upload.array("attachments", 5),
  validate({ body: createRequestSchema }),
  (req, res, next) => requestController.createRequest(req, res, next)
);

requestRouter.get(
  "/",
  validate({ query: getRequestsQuerySchema }),
  (req, res, next) => requestController.getRequests(req, res, next)
);

requestRouter.get(
  "/:id",
  validate({ params: requestIdParamSchema }),
  (req, res, next) => requestController.getRequestById(req, res, next)
);

requestRouter.get(
  "/:id/activity",
  validate({ params: requestIdParamSchema }),
  (req, res, next) => requestController.getActivityHistory(req, res, next)
);

requestRouter.patch(
  "/:id",
  validate({ params: requestIdParamSchema, body: updateRequestSchema }),
  (req, res, next) => requestController.updateRequest(req, res, next)
);

requestRouter.post(
  "/:id/submit",
  validate({ params: requestIdParamSchema }),
  (req, res, next) => requestController.submitRequest(req, res, next)
);

requestRouter.post(
  "/:id/cancel",
  validate({ params: requestIdParamSchema }),
  (req, res, next) => requestController.cancelRequest(req, res, next)
);

requestRouter.patch(
  "/:id/status",
  authorize(Role.MANAGER, Role.ADMIN),
  validate({ params: requestIdParamSchema, body: updateRequestStatusSchema }),
  (req, res, next) => requestController.transitionStatus(req, res, next)
);

requestRouter.post(
  "/:id/attachments",
  validate({ params: requestIdParamSchema }),
  upload.single("file"),
  (req, res, next) => requestController.uploadAttachments(req, res, next)
);
