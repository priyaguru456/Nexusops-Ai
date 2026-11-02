import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth";
import { analyticsController } from "./analytics.controller";

export const analyticsRouter = Router();

/**
 * GET /api/analytics/overview
 * Overview stat cards, time series, and breakdown scoped by user role.
 */
analyticsRouter.get("/overview", authenticate, analyticsController.getOverview);

/**
 * GET /api/analytics/requests
 * In-depth requests breakdown, categories, priorities, top approvers, bottleneck steps.
 */
analyticsRouter.get("/requests", authenticate, analyticsController.getRequests);

/**
 * GET /api/analytics/tasks
 * Task metrics, statuses, assignees, and overdue task details.
 */
analyticsRouter.get("/tasks", authenticate, analyticsController.getTasks);

/**
 * GET /api/analytics/ai-usage
 * Company-wide RAG and LLM usage statistics (Admin only; 403 for Employee/Manager).
 */
analyticsRouter.get(
  "/ai-usage",
  authenticate,
  authorize(Role.ADMIN),
  analyticsController.getAiUsage
);

/**
 * GET /api/analytics/export
 * Export scoped data as CSV with formula injection sanitization.
 */
analyticsRouter.get("/export", authenticate, analyticsController.exportCSV);
