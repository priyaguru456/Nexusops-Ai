import type { Request, Response, NextFunction } from "express";
import { notificationService } from "./notification.service";
import { AppError } from "../../lib/errors";

export class NotificationController {
  async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const unreadOnly = String(req.query.unreadOnly) === "true";
      const limit = req.query.limit ? Number(req.query.limit) : 20;

      const result = await notificationService.getUserNotifications(
        req.user.id,
        unreadOnly,
        limit
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await notificationService.markAsRead(id, req.user.id);
      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      await notificationService.markAllAsRead(req.user.id);
      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
