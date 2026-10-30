import { Router } from "express";
import { notificationController } from "./notification.controller";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  notificationIdParamSchema,
  getNotificationsQuerySchema,
} from "./notification.schema";

export const notificationRouter = Router();

notificationRouter.use(authenticate);

notificationRouter.get(
  "/",
  validate({ query: getNotificationsQuerySchema }),
  (req, res, next) => notificationController.getNotifications(req, res, next)
);

notificationRouter.patch("/read-all", (req, res, next) =>
  notificationController.markAllAsRead(req, res, next)
);

notificationRouter.patch(
  "/:id/read",
  validate({ params: notificationIdParamSchema }),
  (req, res, next) => notificationController.markAsRead(req, res, next)
);
