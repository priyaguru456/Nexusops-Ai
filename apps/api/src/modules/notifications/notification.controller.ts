import type { Request, Response, NextFunction } from "express";
import { notificationService } from "./notification.service";
import { AppError } from "../../lib/errors";

export class NotificationController {
  async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const unreadOnly = String(req.query.unreadOnly) === "true";

      const result = await notificationService.getUserNotifications(
        req.user.id,
        page,
        limit,
        unreadOnly
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const unreadCount = await notificationService.getUnreadCount(req.user.id);
      res.status(200).json({ unreadCount });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await notificationService.markAsRead(id, req.user.id);
      if (!updated) {
        throw AppError.notFound("Notification not found");
      }
      res.status(200).json({ success: true, notification: updated });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const result = await notificationService.markAllAsRead(req.user.id);
      res.status(200).json({ success: true, count: result.count });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
