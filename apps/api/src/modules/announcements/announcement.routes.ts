import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { announcementController } from "./announcement.controller";
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  announcementQuerySchema,
  announcementIdParamSchema,
} from "./announcement.schema";

export const announcementRouter = Router();

announcementRouter.use(authenticate);

// List announcements visible to current user
announcementRouter.get(
  "/",
  validate({ query: announcementQuerySchema }),
  announcementController.list
);

// Get unread announcements for dashboard widget
announcementRouter.get("/unread", announcementController.getUnreadDashboard);

// Get available departments for announcement targeting
announcementRouter.get("/departments", announcementController.getDepartments);

// Create new announcement (Admin and Manager only)
announcementRouter.post(
  "/",
  authorize(Role.ADMIN, Role.MANAGER),
  validate({ body: createAnnouncementSchema }),
  announcementController.create
);

// Get single announcement details
announcementRouter.get(
  "/:id",
  validate({ params: announcementIdParamSchema }),
  announcementController.getById
);

// Update announcement (Admin and Manager only)
announcementRouter.patch(
  "/:id",
  authorize(Role.ADMIN, Role.MANAGER),
  validate({ params: announcementIdParamSchema, body: updateAnnouncementSchema }),
  announcementController.update
);

// Delete announcement (Admin and Manager only)
announcementRouter.delete(
  "/:id",
  authorize(Role.ADMIN, Role.MANAGER),
  validate({ params: announcementIdParamSchema }),
  announcementController.delete
);

// Mark announcement as read
announcementRouter.post(
  "/:id/read",
  validate({ params: announcementIdParamSchema }),
  announcementController.markAsRead
);

// Read statistics / count for authors and admins
announcementRouter.get(
  "/:id/read-stats",
  validate({ params: announcementIdParamSchema }),
  announcementController.getReadStats
);
