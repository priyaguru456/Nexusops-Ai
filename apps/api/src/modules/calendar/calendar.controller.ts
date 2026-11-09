import type { Request, Response, NextFunction } from "express";
import { calendarService } from "./calendar.service";
import { AppError } from "../../lib/errors";

export class CalendarController {
  async getEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const result = await calendarService.getEvents(req.query as any, req.user);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const calendarController = new CalendarController();
