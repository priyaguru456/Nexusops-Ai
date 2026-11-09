import type { Request, Response, NextFunction } from "express";
import { leaveService } from "./leave.service";
import { AppError } from "../../lib/errors";

export class LeaveController {
  async apply(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const leave = await leaveService.applyLeave(req.body, req.user);
      res.status(201).json({ leave });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const result = await leaveService.listLeaves(req.query as any, req.user);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const leaveId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const leave = await leaveService.getLeaveById(leaveId, req.user);
      res.status(200).json({ leave });
    } catch (error) {
      next(error);
    }
  }

  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
      const year = req.query.year ? Number(req.query.year) : undefined;
      const balance = await leaveService.getBalance(userId, year, req.user);
      res.status(200).json({ balance });
    } catch (error) {
      next(error);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const leaveId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const leave = await leaveService.approveLeave(leaveId, req.user, req.body?.comment);
      res.status(200).json({ leave });
    } catch (error) {
      next(error);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const leaveId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const leave = await leaveService.rejectLeave(leaveId, req.user, req.body?.comment);
      res.status(200).json({ leave });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const leaveId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const leave = await leaveService.cancelLeave(leaveId, req.user, req.body?.reason);
      res.status(200).json({ leave });
    } catch (error) {
      next(error);
    }
  }

  async listHolidays(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const year = req.query.year ? Number(req.query.year) : undefined;
      const holidays = await leaveService.listHolidays(year);
      res.status(200).json({ holidays });
    } catch (error) {
      next(error);
    }
  }

  async addHoliday(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const holiday = await leaveService.addHoliday(req.body, req.user);
      res.status(201).json({ holiday });
    } catch (error) {
      next(error);
    }
  }

  async updateHoliday(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const holidayId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const holiday = await leaveService.updateHoliday(holidayId, req.body, req.user);
      res.status(200).json({ holiday });
    } catch (error) {
      next(error);
    }
  }

  async deleteHoliday(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const holidayId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const holiday = await leaveService.deleteHoliday(holidayId, req.user);
      res.status(200).json({ message: "Holiday deleted successfully", holiday });
    } catch (error) {
      next(error);
    }
  }
}

export const leaveController = new LeaveController();
