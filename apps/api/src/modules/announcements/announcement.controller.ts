import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/errors";
import { announcementService } from "./announcement.service";
import type { AnnouncementQueryInput } from "./announcement.schema";

export class AnnouncementController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const query = req.query as unknown as AnnouncementQueryInput;
      const result = await announcementService.list(req.user, query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const item = await announcementService.getById(id, req.user);
      res.status(200).json(item);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const created = await announcementService.create(req.user, req.body);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await announcementService.update(id, req.user, req.body);
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await announcementService.delete(id, req.user);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await announcementService.markAsRead(id, req.user);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getReadStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const stats = await announcementService.getReadStats(id, req.user);
      res.status(200).json(stats);
    } catch (error) {
      next(error);
    }
  }

  async getUnreadDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const limit = req.query.limit ? Math.min(10, Math.max(1, Number(req.query.limit))) : 3;
      const items = await announcementService.getUnreadForDashboard(req.user, limit);
      res.status(200).json({ items });
    } catch (error) {
      next(error);
    }
  }

  async getDepartments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const departments = await announcementService.getDepartments();
      res.status(200).json({ departments });
    } catch (error) {
      next(error);
    }
  }
}

export const announcementController = new AnnouncementController();
