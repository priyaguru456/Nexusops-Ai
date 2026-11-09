import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/errors";
import { analyticsService } from "./analytics.service";
import { digestService } from "./digest.service";
import {
  dateRangeQuerySchema,
  exportQuerySchema,
  saveDigestScheduleSchema,
  sendTestDigestSchema,
  digestDeliveriesQuerySchema,
} from "./analytics.schema";

export const analyticsController = {
  /**
   * GET /api/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
   */
  async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();

      const { fromDate, toDate } = dateRangeQuerySchema.parse(req.query);
      const overview = await analyticsService.getOverview(req.user, fromDate, toDate);

      res.status(200).json({
        status: "success",
        data: overview,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/analytics/requests?from=YYYY-MM-DD&to=YYYY-MM-DD
   */
  async getRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();

      const { fromDate, toDate } = dateRangeQuerySchema.parse(req.query);
      const requestsData = await analyticsService.getRequestsAnalytics(req.user, fromDate, toDate);

      res.status(200).json({
        status: "success",
        data: requestsData,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/analytics/tasks?from=YYYY-MM-DD&to=YYYY-MM-DD
   */
  async getTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();

      const { fromDate, toDate } = dateRangeQuerySchema.parse(req.query);
      const tasksData = await analyticsService.getTasksAnalytics(req.user, fromDate, toDate);

      res.status(200).json({
        status: "success",
        data: tasksData,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/analytics/ai-usage?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Admin only: returns 403 for Employee and Manager.
   */
  async getAiUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();

      const { fromDate, toDate } = dateRangeQuerySchema.parse(req.query);
      const aiData = await analyticsService.getAIUsageAnalytics(req.user, fromDate, toDate);

      res.status(200).json({
        status: "success",
        data: aiData,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/analytics/export?type=requests|tasks|approvals|ai-usage&from=...&to=...
   * Authenticated CSV export with formula injection prevention.
   */
  async exportCSV(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();

      const { type, fromDate, toDate } = exportQuerySchema.parse(req.query);
      const csvContent = await analyticsService.exportCSV(req.user, type, fromDate, toDate);

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `nexusops-analytics-${type}-${timestamp}.csv`;

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.status(200).send(csvContent);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/analytics/digest/schedule
   * Admin-only: Retrieves current weekly analytics digest schedule.
   */
  async getDigestSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const schedule = await digestService.getSchedule();
      res.status(200).json({
        status: "success",
        data: schedule,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/analytics/digest/schedule
   * Admin-only: Configures or updates weekly analytics digest schedule.
   */
  async saveDigestSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const input = saveDigestScheduleSchema.parse(req.body);
      const schedule = await digestService.saveSchedule(req.user.id, input);
      res.status(200).json({
        status: "success",
        data: schedule,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/analytics/digest/send-test
   * Admin-only: Immediately sends test digest email.
   */
  async sendTestDigest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const input = sendTestDigestSchema.parse(req.body);

      let recipients = input.recipients;
      let scheduleId: string | undefined;
      let timezone = input.timezone;

      const schedule = await digestService.getSchedule();
      if (schedule) {
        scheduleId = schedule.id;
        if (!timezone) timezone = schedule.timezone;
        if (!recipients || recipients.length === 0) {
          recipients = schedule.recipients;
        }
      }

      if (!recipients || recipients.length === 0) {
        recipients = [req.user.email];
      }

      const result = await digestService.sendDigest({
        scheduleId,
        recipients,
        timezone,
        isTest: true,
      });

      if (!result.success) {
        res.status(502).json({
          status: "error",
          message: result.error || "Failed to send test digest email",
          data: result,
        });
        return;
      }

      res.status(200).json({
        status: "success",
        message: "Test digest email dispatched successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/analytics/digest/deliveries?page=1&limit=20
   * Admin-only: Retrieves delivery history.
   */
  async getDigestDeliveries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized();
      const { page, limit } = digestDeliveriesQuerySchema.parse(req.query);
      const result = await digestService.getDeliveries(page, limit);
      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
};
