import type { Request, Response, NextFunction } from "express";
import { directoryService } from "./directory.service";

export class DirectoryController {
  async getDirectory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await directoryService.getDirectory(req.query as any);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getDepartments(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const departments = await directoryService.getDepartments();
      res.status(200).json({ departments });
    } catch (error) {
      next(error);
    }
  }

  async getOrgRoots(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentId = typeof req.query.departmentId === "string" ? req.query.departmentId : undefined;
      const roots = await directoryService.getOrgRoots(departmentId);
      res.status(200).json({ roots });
    } catch (error) {
      next(error);
    }
  }

  async getDirectReports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const managerId = Array.isArray(req.params.managerId) ? req.params.managerId[0] : req.params.managerId;
      const reports = await directoryService.getDirectReports(managerId);
      res.status(200).json({ reports });
    } catch (error) {
      next(error);
    }
  }

  async getUserTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
      const team = await directoryService.getUserTeam(userId);
      res.status(200).json(team);
    } catch (error) {
      next(error);
    }
  }
}

export const directoryController = new DirectoryController();
