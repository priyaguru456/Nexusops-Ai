import type { Request, Response, NextFunction } from "express";
import { taskService } from "./task.service";
import { AppError } from "../../lib/errors";
import type { GetTasksQuery } from "./task.schema";

export class TaskController {
  async createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const task = await taskService.createTask(req.user, req.body);
      res.status(201).json({ task });
    } catch (error) {
      next(error);
    }
  }

  async getTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const query = req.query as unknown as GetTasksQuery;
      const result = await taskService.getTasks(req.user, {
        status: query.status,
        priority: query.priority,
        assigneeId: query.assigneeId,
        requestId: query.requestId,
        search: query.search,
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getTaskById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const task = await taskService.getTaskById(id, req.user);
      res.status(200).json({ task });
    } catch (error) {
      next(error);
    }
  }

  async updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await taskService.updateTask(id, req.user, req.body);
      res.status(200).json({ task: updated });
    } catch (error) {
      next(error);
    }
  }

  async assignTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await taskService.assignTask(id, req.user, req.body.assigneeId);
      res.status(200).json({ task: updated });
    } catch (error) {
      next(error);
    }
  }
}

export const taskController = new TaskController();
