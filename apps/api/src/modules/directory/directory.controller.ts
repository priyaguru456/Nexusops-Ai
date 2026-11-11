import type { Request, Response, NextFunction } from "express";
import { directoryService } from "./directory.service";
import { tenantWhere } from "../../lib/tenant";

export class DirectoryController {
  async getDirectory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user ? tenantWhere(req.user).organizationId : undefined;
      const result = await directoryService.getDirectory({
        ...(req.query as any),
        organizationId,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getDepartments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user ? tenantWhere(req.user).organizationId : undefined;
      const departments = await directoryService.getDepartments(organizationId);
      res.status(200).json({ departments });
    } catch (error) {
      next(error);
    }
  }

  async getOrgRoots(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentId = typeof req.query.departmentId === "string" ? req.query.departmentId : undefined;
      const organizationId = req.user ? tenantWhere(req.user).organizationId : undefined;
      const roots = await directoryService.getOrgRoots(departmentId, organizationId);
      res.status(200).json({ roots });
    } catch (error) {
      next(error);
    }
  }

  async getDirectReports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const managerId = Array.isArray(req.params.managerId) ? req.params.managerId[0] : req.params.managerId;
      const organizationId = req.user ? tenantWhere(req.user).organizationId : undefined;
      const reports = await directoryService.getDirectReports(managerId, organizationId);
      res.status(200).json({ reports });
    } catch (error) {
      next(error);
    }
  }

  async getUserTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
      const organizationId = req.user ? tenantWhere(req.user).organizationId : undefined;
      const team = await directoryService.getUserTeam(userId, organizationId);
      res.status(200).json(team);
    } catch (error) {
      next(error);
    }
  }
}

export const directoryController = new DirectoryController();
