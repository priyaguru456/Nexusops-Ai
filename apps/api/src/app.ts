import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { AppError } from "./lib/errors";
import { notFound, errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { userRouter } from "./modules/users/user.routes";
import { requestRouter } from "./modules/requests/request.routes";
import { taskRouter } from "./modules/tasks/task.routes";
import { commentRouter } from "./modules/comments/comment.routes";
import { approvalRouter, approvalFlowRouter } from "./modules/approvals/approval.routes";
import { notificationRouter } from "./modules/notifications/notification.routes";
import { auditRouter } from "./modules/audit/audit.routes";
import { documentRouter } from "./modules/documents/document.routes";
import { aiRouter } from "./modules/ai/ai.routes";
import { analyticsRouter } from "./modules/analytics/analytics.routes";
import { searchRouter } from "./modules/search/search.routes";
import { announcementRouter } from "./modules/announcements/announcement.routes";
import { directoryRouter } from "./modules/directory/directory.routes";
import { assetRouter } from "./modules/assets/asset.routes";
import { policyRouter } from "./modules/policies/policy.routes";
import { leaveRouter } from "./modules/leaves/leave.routes";
import { calendarRouter } from "./modules/calendar/calendar.routes";
import { expenseRouter } from "./modules/expenses/expense.routes";
import { surveyRouter } from "./modules/surveys/survey.routes";

export const app = express();

app.use(helmet());

const allowedOrigins = new Set(env.CORS_WHITELIST);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(AppError.forbidden(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === "/api/health",
    },
  })
);

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "ok",
      service: "nexusops-api",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database connection failed";
    logger.error(err, "Health check failed: database unreachable");
    res.status(503).json({
      status: "error",
      service: "nexusops-api",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: message,
    });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/requests", requestRouter);
app.use("/api/tasks", taskRouter);
app.use("/api/comments", commentRouter);
app.use("/api/approvals", approvalRouter);
app.use("/api/approval-flows", approvalFlowRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/audit-logs", auditRouter);
app.use("/api/documents", documentRouter);
app.use("/api/ai", aiRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/search", searchRouter);
app.use("/api/announcements", announcementRouter);
app.use("/api/directory", directoryRouter);
app.use("/api/assets", assetRouter);
app.use("/api/policies", policyRouter);
app.use("/api/leaves", leaveRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/expenses", expenseRouter);
app.use("/api/surveys", surveyRouter);

app.use(notFound);
app.use(errorHandler);
