import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { env } from "../../config/env";
import { isAdminRole } from "../../lib/tenant";
import { analyticsScope } from "./analytics.scope";
import { AuthenticatedUser } from "../../types/express";

export interface AnalyticsOverview {
  dateRange: { from: string; to: string };
  totals: {
    totalRequests: number;
    open: number;
    approved: number;
    rejected: number;
    completed: number;
    draft: number;
    cancelled: number;
  };
  performance: {
    avgApprovalTimeHours: number | null;
    avgCompletionTimeHours: number | null;
  };
  tasks: {
    total: number;
    todo: number;
    inProgress: number;
    blocked: number;
    done: number;
    overdue: number;
  };
  requestsByCategory: Array<{ category: string; count: number }>;
  requestsOverTime: Array<{ date: string; count: number }>;
  aiSummary: {
    totalQuestions: number;
    notFoundRatePercent: number | null;
    avgLatencyMs: number | null;
    positiveFeedbackCount: number;
    negativeFeedbackCount: number;
    estimatedCostUsd: number;
  } | null;
}

export const analyticsService = {
  /**
   * Main overview dashboard metrics.
   * Aggregates totals, performance indicators, categories, and time series in pure SQL.
   */
  async getOverview(
    user: AuthenticatedUser,
    fromDate: Date,
    toDate: Date
  ): Promise<AnalyticsOverview> {
    const wrScope = analyticsScope.forRequests(user, "wr");
    const tScope = analyticsScope.forTasks(user, "t");

    // 1. Request status totals & performance times
    const [requestStats]: any[] = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS "totalRequests",
        COUNT(*) FILTER (WHERE wr.status IN ('SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS'))::int AS "open",
        COUNT(*) FILTER (WHERE wr.status = 'APPROVED')::int AS "approved",
        COUNT(*) FILTER (WHERE wr.status = 'REJECTED')::int AS "rejected",
        COUNT(*) FILTER (WHERE wr.status = 'COMPLETED')::int AS "completed",
        COUNT(*) FILTER (WHERE wr.status = 'DRAFT')::int AS "draft",
        COUNT(*) FILTER (WHERE wr.status = 'CANCELLED')::int AS "cancelled",
        AVG(
          CASE 
            WHEN wr."submittedAt" IS NOT NULL AND wr."completedAt" IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (wr."completedAt" - wr."submittedAt")) / 3600.0
            ELSE NULL 
          END
        )::float AS "avgCompletionHours"
      FROM "WorkRequest" wr
      WHERE wr."createdAt" >= ${fromDate}
        AND wr."createdAt" <= ${toDate}
        AND ${wrScope};
    `;

    // 2. Average approval time from submitted to final approval step decidedAt
    const [approvalTimeStat]: any[] = await prisma.$queryRaw`
      SELECT
        AVG(EXTRACT(EPOCH FROM (ast."decidedAt" - wr."submittedAt")) / 3600.0)::float AS "avgApprovalHours"
      FROM "ApprovalStep" ast
      JOIN "WorkRequest" wr ON wr.id = ast."requestId"
      WHERE ast."decidedAt" IS NOT NULL
        AND wr."submittedAt" IS NOT NULL
        AND ast."decidedAt" >= wr."submittedAt"
        AND wr."createdAt" >= ${fromDate}
        AND wr."createdAt" <= ${toDate}
        AND ${wrScope};
    `;

    // 3. Task totals & overdue count
    const [taskStats]: any[] = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS "total",
        COUNT(*) FILTER (WHERE t.status = 'TODO')::int AS "todo",
        COUNT(*) FILTER (WHERE t.status = 'IN_PROGRESS')::int AS "inProgress",
        COUNT(*) FILTER (WHERE t.status = 'BLOCKED')::int AS "blocked",
        COUNT(*) FILTER (WHERE t.status = 'DONE')::int AS "done",
        COUNT(*) FILTER (
          WHERE t."dueDate" < NOW() 
            AND t.status != 'DONE'
        )::int AS "overdue"
      FROM "Task" t
      WHERE t."createdAt" >= ${fromDate}
        AND t."createdAt" <= ${toDate}
        AND ${tScope};
    `;

    // 4. Requests by category
    const categoryStats: any[] = await prisma.$queryRaw`
      SELECT
        wr.category::text AS "category",
        COUNT(*)::int AS "count"
      FROM "WorkRequest" wr
      WHERE wr."createdAt" >= ${fromDate}
        AND wr."createdAt" <= ${toDate}
        AND ${wrScope}
      GROUP BY wr.category
      ORDER BY "count" DESC;
    `;

    // 5. Requests over time using generate_series (guarantees zero-activity days appear)
    const timeSeriesStats: any[] = await prisma.$queryRaw`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', ${fromDate}::timestamptz),
          date_trunc('day', ${toDate}::timestamptz),
          '1 day'::interval
        )::date AS day
      )
      SELECT
        to_char(days.day, 'YYYY-MM-DD') AS "date",
        COALESCE(COUNT(wr.id), 0)::int AS "count"
      FROM days
      LEFT JOIN "WorkRequest" wr 
        ON date_trunc('day', wr."createdAt") = days.day
        AND ${wrScope}
      GROUP BY days.day
      ORDER BY days.day ASC;
    `;

    // 6. AI Summary: Admin sees full overview; Employee sees own question count/feedback; Manager gets null
    let aiSummary = null;
    if (isAdminRole(user) || user.role === Role.EMPLOYEE) {
      const csScope = analyticsScope.forChatSessions(user, "cs");
      const [aiRow]: any[] = await prisma.$queryRaw`
        SELECT
          COUNT(DISTINCT cm.id) FILTER (WHERE cm.role = 'USER')::int AS "totalQuestions",
          COUNT(*) FILTER (WHERE cm.role = 'ASSISTANT' AND cm."notFound" = true)::int AS "notFoundCount",
          COUNT(*) FILTER (WHERE cm.role = 'ASSISTANT')::int AS "totalAnswers",
          AVG(cm."latencyMs") FILTER (WHERE cm.role = 'ASSISTANT')::float AS "avgLatencyMs",
          COUNT(*) FILTER (WHERE cm.feedback = 1)::int AS "positiveFeedback",
          COUNT(*) FILTER (WHERE cm.feedback = -1)::int AS "negativeFeedback",
          COALESCE(SUM(cm."inputTokens"), 0)::bigint AS "totalInputTokens",
          COALESCE(SUM(cm."outputTokens"), 0)::bigint AS "totalOutputTokens"
        FROM "ChatMessage" cm
        JOIN "ChatSession" cs ON cs.id = cm."sessionId"
        WHERE cm."createdAt" >= ${fromDate}
          AND cm."createdAt" <= ${toDate}
          AND ${csScope};
      `;

      if (aiRow) {
        const totalAnswers = Number(aiRow.totalAnswers || 0);
        const notFoundCount = Number(aiRow.notFoundCount || 0);
        const notFoundRate = totalAnswers > 0 ? Number(((notFoundCount / totalAnswers) * 100).toFixed(1)) : null;

        const inputTokens = Number(aiRow.totalInputTokens || 0);
        const outputTokens = Number(aiRow.totalOutputTokens || 0);
        const inCost = (inputTokens / 1_000_000) * (env.LLM_INPUT_PRICE_PER_MTOK || 3.0);
        const outCost = (outputTokens / 1_000_000) * (env.LLM_OUTPUT_PRICE_PER_MTOK || 15.0);

        aiSummary = {
          totalQuestions: Number(aiRow.totalQuestions || 0),
          notFoundRatePercent: notFoundRate,
          avgLatencyMs: aiRow.avgLatencyMs ? Math.round(Number(aiRow.avgLatencyMs)) : null,
          positiveFeedbackCount: Number(aiRow.positiveFeedback || 0),
          negativeFeedbackCount: Number(aiRow.negativeFeedback || 0),
          estimatedCostUsd: Number((inCost + outCost).toFixed(4)),
        };
      }
    }

    return {
      dateRange: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      totals: {
        totalRequests: Number(requestStats?.totalRequests || 0),
        open: Number(requestStats?.open || 0),
        approved: Number(requestStats?.approved || 0),
        rejected: Number(requestStats?.rejected || 0),
        completed: Number(requestStats?.completed || 0),
        draft: Number(requestStats?.draft || 0),
        cancelled: Number(requestStats?.cancelled || 0),
      },
      performance: {
        avgApprovalTimeHours:
          approvalTimeStat?.avgApprovalHours !== null && approvalTimeStat?.avgApprovalHours !== undefined
            ? Number(Number(approvalTimeStat.avgApprovalHours).toFixed(1))
            : null,
        avgCompletionTimeHours:
          requestStats?.avgCompletionHours !== null && requestStats?.avgCompletionHours !== undefined
            ? Number(Number(requestStats.avgCompletionHours).toFixed(1))
            : null,
      },
      tasks: {
        total: Number(taskStats?.total || 0),
        todo: Number(taskStats?.todo || 0),
        inProgress: Number(taskStats?.inProgress || 0),
        blocked: Number(taskStats?.blocked || 0),
        done: Number(taskStats?.done || 0),
        overdue: Number(taskStats?.overdue || 0),
      },
      requestsByCategory: categoryStats.map((r) => ({
        category: r.category,
        count: Number(r.count),
      })),
      requestsOverTime: timeSeriesStats.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
      aiSummary,
    };
  },

  /**
   * Detailed requests analytics with categories, priorities, time series,
   * top approvers, and bottleneck approval steps.
   */
  async getRequestsAnalytics(user: AuthenticatedUser, fromDate: Date, toDate: Date) {
    const wrScope = analyticsScope.forRequests(user, "wr");
    const astScope = analyticsScope.forApprovals(user, "ast");

    // 1. Time series over time (daily via generate_series)
    const overTime: any[] = await prisma.$queryRaw`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', ${fromDate}::timestamptz),
          date_trunc('day', ${toDate}::timestamptz),
          '1 day'::interval
        )::date AS day
      )
      SELECT
        to_char(days.day, 'YYYY-MM-DD') AS "date",
        COALESCE(COUNT(wr.id), 0)::int AS "count"
      FROM days
      LEFT JOIN "WorkRequest" wr 
        ON date_trunc('day', wr."createdAt") = days.day
        AND ${wrScope}
      GROUP BY days.day
      ORDER BY days.day ASC;
    `;

    // 2. Requests by Category
    const byCategory: any[] = await prisma.$queryRaw`
      SELECT
        wr.category::text AS "category",
        COUNT(*)::int AS "count"
      FROM "WorkRequest" wr
      WHERE wr."createdAt" >= ${fromDate}
        AND wr."createdAt" <= ${toDate}
        AND ${wrScope}
      GROUP BY wr.category
      ORDER BY "count" DESC;
    `;

    // 3. Requests by Priority
    const byPriority: any[] = await prisma.$queryRaw`
      SELECT
        wr.priority::text AS "priority",
        COUNT(*)::int AS "count"
      FROM "WorkRequest" wr
      WHERE wr."createdAt" >= ${fromDate}
        AND wr."createdAt" <= ${toDate}
        AND ${wrScope}
      GROUP BY wr.priority;
    `;

    // 4. Requests by Status
    const byStatus: any[] = await prisma.$queryRaw`
      SELECT
        wr.status::text AS "status",
        COUNT(*)::int AS "count"
      FROM "WorkRequest" wr
      WHERE wr."createdAt" >= ${fromDate}
        AND wr."createdAt" <= ${toDate}
        AND ${wrScope}
      GROUP BY wr.status;
    `;

    // 5. Top Approvers (users who decided approval steps - turnaround measured from activatedAt)
    const topApprovers: any[] = await prisma.$queryRaw`
      SELECT
        u.id AS "approverId",
        u.name AS "approverName",
        u.role::text AS "role",
        COUNT(*)::int AS "decidedStepsCount",
        AVG(
          CASE 
            WHEN ast."decidedAt" >= COALESCE(ast."activatedAt", ast."createdAt")
            THEN EXTRACT(EPOCH FROM (ast."decidedAt" - COALESCE(ast."activatedAt", ast."createdAt"))) / 3600.0
            ELSE NULL 
          END
        )::float AS "avgDecisionHours"
      FROM "ApprovalStep" ast
      JOIN "User" u ON u.id = ast."approverId"
      WHERE ast."decidedAt" IS NOT NULL
        AND ast."decidedAt" >= ${fromDate}
        AND ast."decidedAt" <= ${toDate}
        AND ${astScope}
      GROUP BY u.id, u.name, u.role
      ORDER BY "decidedStepsCount" DESC
      LIMIT 10;
    `;

    // 6. Bottleneck Steps (grouped by stepOrder and role - measured from activatedAt)
    const bottleneckSteps: any[] = await prisma.$queryRaw`
      SELECT
        ast."stepOrder",
        ast."approverRole"::text AS "approverRole",
        COUNT(*) FILTER (WHERE ast.status = 'PENDING')::int AS "pendingCount",
        COUNT(*) FILTER (WHERE ast.status = 'APPROVED')::int AS "approvedCount",
        COUNT(*) FILTER (WHERE ast.status = 'REJECTED')::int AS "rejectedCount",
        AVG(
          CASE 
            WHEN ast."decidedAt" IS NOT NULL AND ast."decidedAt" >= COALESCE(ast."activatedAt", ast."createdAt")
            THEN EXTRACT(EPOCH FROM (ast."decidedAt" - COALESCE(ast."activatedAt", ast."createdAt"))) / 3600.0
            ELSE NULL 
          END
        )::float AS "avgHoursToDecide"
      FROM "ApprovalStep" ast
      WHERE ast."createdAt" >= ${fromDate}
        AND ast."createdAt" <= ${toDate}
        AND ${astScope}
      GROUP BY ast."stepOrder", ast."approverRole"
      ORDER BY ast."stepOrder" ASC;
    `;

    return {
      requestsOverTime: overTime.map((r) => ({ date: r.date, count: Number(r.count) })),
      byCategory: byCategory.map((r) => ({ category: r.category, count: Number(r.count) })),
      byPriority: byPriority.map((r) => ({ priority: r.priority, count: Number(r.count) })),
      byStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
      topApprovers: topApprovers.map((r) => ({
        approverId: r.approverId,
        approverName: r.approverName,
        role: r.role,
        decidedStepsCount: Number(r.decidedStepsCount),
        avgDecisionHours:
          r.avgDecisionHours !== null && r.avgDecisionHours !== undefined
            ? Number(Number(r.avgDecisionHours).toFixed(1))
            : null,
      })),
      bottleneckSteps: bottleneckSteps.map((r) => ({
        stepOrder: Number(r.stepOrder),
        approverRole: r.approverRole,
        pendingCount: Number(r.pendingCount),
        approvedCount: Number(r.approvedCount),
        rejectedCount: Number(r.rejectedCount),
        avgHoursToDecide:
          r.avgHoursToDecide !== null && r.avgHoursToDecide !== undefined
            ? Number(Number(r.avgHoursToDecide).toFixed(1))
            : null,
      })),
    };
  },

  /**
   * Detailed tasks analytics with status breakdown, assignees, and overdue tasks.
   */
  async getTasksAnalytics(user: AuthenticatedUser, fromDate: Date, toDate: Date) {
    const tScope = analyticsScope.forTasks(user, "t");

    // 1. Tasks by Status
    const byStatus: any[] = await prisma.$queryRaw`
      SELECT
        t.status::text AS "status",
        COUNT(*)::int AS "count"
      FROM "Task" t
      WHERE t."createdAt" >= ${fromDate}
        AND t."createdAt" <= ${toDate}
        AND ${tScope}
      GROUP BY t.status;
    `;

    // 2. Tasks by Priority
    const byPriority: any[] = await prisma.$queryRaw`
      SELECT
        t.priority::text AS "priority",
        COUNT(*)::int AS "count"
      FROM "Task" t
      WHERE t."createdAt" >= ${fromDate}
        AND t."createdAt" <= ${toDate}
        AND ${tScope}
      GROUP BY t.priority;
    `;

    // 3. Tasks by Assignee
    const byAssignee: any[] = await prisma.$queryRaw`
      SELECT
        COALESCE(u.id, 'unassigned') AS "assigneeId",
        COALESCE(u.name, 'Unassigned') AS "assigneeName",
        COUNT(*)::int AS "totalTasks",
        COUNT(*) FILTER (WHERE t.status = 'DONE')::int AS "completedTasks",
        COUNT(*) FILTER (WHERE t."dueDate" < NOW() AND t.status != 'DONE')::int AS "overdueTasks"
      FROM "Task" t
      LEFT JOIN "User" u ON u.id = t."assigneeId"
      WHERE t."createdAt" >= ${fromDate}
        AND t."createdAt" <= ${toDate}
        AND ${tScope}
      GROUP BY u.id, u.name
      ORDER BY "totalTasks" DESC
      LIMIT 15;
    `;

    // 4. Overdue tasks list
    const overdueTasks: any[] = await prisma.$queryRaw`
      SELECT
        t.id,
        t.title,
        t.status::text AS "status",
        t.priority::text AS "priority",
        to_char(t."dueDate", 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "dueDate",
        u.name AS "assigneeName"
      FROM "Task" t
      LEFT JOIN "User" u ON u.id = t."assigneeId"
      WHERE t."dueDate" < NOW()
        AND t.status != 'DONE'
        AND ${tScope}
      ORDER BY t."dueDate" ASC
      LIMIT 20;
    `;

    return {
      byStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
      byPriority: byPriority.map((r) => ({ priority: r.priority, count: Number(r.count) })),
      byAssignee: byAssignee.map((r) => ({
        assigneeId: r.assigneeId,
        assigneeName: r.assigneeName,
        totalTasks: Number(r.totalTasks),
        completedTasks: Number(r.completedTasks),
        overdueTasks: Number(r.overdueTasks),
      })),
      overdueTasksCount: overdueTasks.length,
      overdueTasks: overdueTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        assigneeName: t.assigneeName || "Unassigned",
      })),
    };
  },

  /**
   * AI Usage Analytics.
   * Access rule:
   * - Admin sees company-wide AI usage
   * - Manager and Employee receive 403 Forbidden
   */
  async getAIUsageAnalytics(user: AuthenticatedUser, fromDate: Date, toDate: Date) {
    if (!isAdminRole(user)) {
      throw AppError.forbidden("Admin access required for AI usage analytics");
    }

    const csScope = analyticsScope.forChatSessions(user, "cs");

    // 1. Questions per day using generate_series
    const questionsPerDay: any[] = await prisma.$queryRaw`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', ${fromDate}::timestamptz),
          date_trunc('day', ${toDate}::timestamptz),
          '1 day'::interval
        )::date AS day
      )
      SELECT
        to_char(days.day, 'YYYY-MM-DD') AS "date",
        COALESCE(COUNT(cm.id), 0)::int AS "count"
      FROM days
      LEFT JOIN "ChatMessage" cm 
        ON date_trunc('day', cm."createdAt") = days.day
        AND cm.role = 'USER'
        AND EXISTS (
          SELECT 1 FROM "ChatSession" cs
          WHERE cs.id = cm."sessionId"
            AND ${csScope}
        )
      GROUP BY days.day
      ORDER BY days.day ASC;
    `;

    // 2. Aggregated metrics: totals, not-found count, latency, tokens, feedback
    const [overall]: any[] = await prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE cm.role = 'USER')::int AS "totalQuestions",
        COUNT(*) FILTER (WHERE cm.role = 'ASSISTANT')::int AS "totalAnswers",
        COUNT(*) FILTER (WHERE cm.role = 'ASSISTANT' AND cm."notFound" = true)::int AS "notFoundCount",
        AVG(cm."latencyMs") FILTER (WHERE cm.role = 'ASSISTANT')::float AS "avgLatencyMs",
        COUNT(*) FILTER (WHERE cm.feedback = 1)::int AS "positiveFeedback",
        COUNT(*) FILTER (WHERE cm.feedback = -1)::int AS "negativeFeedback",
        COALESCE(SUM(cm."inputTokens"), 0)::bigint AS "totalInputTokens",
        COALESCE(SUM(cm."outputTokens"), 0)::bigint AS "totalOutputTokens",
        COALESCE(SUM(cm."tokensUsed"), 0)::bigint AS "totalTokensUsed"
      FROM "ChatMessage" cm
      JOIN "ChatSession" cs ON cs.id = cm."sessionId"
      WHERE cm."createdAt" >= ${fromDate}
        AND cm."createdAt" <= ${toDate}
        AND ${csScope};
    `;

    // 3. Most-used documents: aggregate from citations JSONB using jsonb_array_elements
    const topDocuments: any[] = await prisma.$queryRaw`
      SELECT
        elem->>'documentId' AS "documentId",
        COALESCE(d.title, elem->>'documentTitle', 'Untitled Document') AS "title",
        COUNT(*)::int AS "citationCount"
      FROM "ChatMessage" cm
      JOIN "ChatSession" cs ON cs.id = cm."sessionId",
      LATERAL jsonb_array_elements(
        CASE 
          WHEN cm.citations IS NOT NULL AND jsonb_typeof(cm.citations::jsonb) = 'array'
          THEN cm.citations::jsonb 
          ELSE '[]'::jsonb 
        END
      ) AS elem
      LEFT JOIN "Document" d ON d.id::text = elem->>'documentId'
      WHERE cm.role = 'ASSISTANT'
        AND cm."createdAt" >= ${fromDate}
        AND cm."createdAt" <= ${toDate}
        AND ${csScope}
      GROUP BY elem->>'documentId', d.title, elem->>'documentTitle'
      ORDER BY "citationCount" DESC
      LIMIT 10;
    `;

    const totalQuestions = Number(overall?.totalQuestions || 0);
    const totalAnswers = Number(overall?.totalAnswers || 0);
    const notFoundCount = Number(overall?.notFoundCount || 0);
    const notFoundRate = totalAnswers > 0 ? Number(((notFoundCount / totalAnswers) * 100).toFixed(1)) : 0;

    const positive = Number(overall?.positiveFeedback || 0);
    const negative = Number(overall?.negativeFeedback || 0);
    const totalFeedback = positive + negative;
    const satisfactionRate = totalFeedback > 0 ? Number(((positive / totalFeedback) * 100).toFixed(1)) : null;

    const inputTokens = Number(overall?.totalInputTokens || 0);
    const outputTokens = Number(overall?.totalOutputTokens || 0);
    const inPrice = env.LLM_INPUT_PRICE_PER_MTOK || 3.0;
    const outPrice = env.LLM_OUTPUT_PRICE_PER_MTOK || 15.0;
    const inCost = (inputTokens / 1_000_000) * inPrice;
    const outCost = (outputTokens / 1_000_000) * outPrice;
    const totalCost = inCost + outCost;

    return {
      questionsPerDay: questionsPerDay.map((r) => ({ date: r.date, count: Number(r.count) })),
      metrics: {
        totalQuestions,
        totalAnswers,
        notFoundCount,
        notFoundRatePercent: notFoundRate,
        avgLatencyMs: overall?.avgLatencyMs ? Math.round(Number(overall.avgLatencyMs)) : null,
        feedback: {
          positive,
          negative,
          total: totalFeedback,
          satisfactionRatePercent: satisfactionRate,
        },
        tokens: {
          inputTokens,
          outputTokens,
          totalTokens: Number(overall?.totalTokensUsed || inputTokens + outputTokens),
          estimatedCostUsd: Number(totalCost.toFixed(4)),
          inputPricePerMTok: inPrice,
          outputPricePerMTok: outPrice,
        },
      },
      mostUsedDocuments: topDocuments.map((d) => ({
        documentId: d.documentId,
        title: d.title,
        citationCount: Number(d.citationCount),
      })),
    };
  },

  /**
   * Generates sanitized CSV export for requests, tasks, approvals, or AI usage.
   * Protects against spreadsheet formula injection by prefixing '=', '+', '-', '@' with a single quote.
   */
  async exportCSV(
    user: AuthenticatedUser,
    type: "requests" | "tasks" | "approvals" | "ai-usage",
    fromDate: Date,
    toDate: Date
  ): Promise<string> {
    const sanitize = (val: unknown): string => {
      if (val === null || val === undefined) return "";
      let str = String(val).trim();
      // Prefix formula characters to prevent injection
      if (/^[=+\-@]/.test(str)) {
        str = `'${str}`;
      }
      // Enclose in quotes if contains comma, quote, or newline
      if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const toRow = (fields: unknown[]): string => fields.map(sanitize).join(",");

    switch (type) {
      case "requests": {
        const wrScope = analyticsScope.forRequests(user, "wr");
        const rows: any[] = await prisma.$queryRaw`
          SELECT
            wr.id,
            wr.title,
            wr.category::text AS category,
            wr.priority::text AS priority,
            wr.status::text AS status,
            wr.amount,
            u.name AS "requesterName",
            to_char(wr."createdAt", 'YYYY-MM-DD HH24:MI:SS') AS "createdAt",
            to_char(wr."submittedAt", 'YYYY-MM-DD HH24:MI:SS') AS "submittedAt",
            to_char(wr."completedAt", 'YYYY-MM-DD HH24:MI:SS') AS "completedAt"
          FROM "WorkRequest" wr
          JOIN "User" u ON u.id = wr."requesterId"
          WHERE wr."createdAt" >= ${fromDate}
            AND wr."createdAt" <= ${toDate}
            AND ${wrScope}
          ORDER BY wr."createdAt" DESC;
        `;

        const header = toRow([
          "Request ID",
          "Title",
          "Category",
          "Priority",
          "Status",
          "Amount",
          "Requester",
          "Created At (UTC)",
          "Submitted At (UTC)",
          "Completed At (UTC)",
        ]);

        const body = rows.map((r) =>
          toRow([
            r.id,
            r.title,
            r.category,
            r.priority,
            r.status,
            r.amount ? Number(r.amount).toFixed(2) : "",
            r.requesterName,
            r.createdAt,
            r.submittedAt,
            r.completedAt,
          ])
        );

        return [header, ...body].join("\r\n");
      }

      case "tasks": {
        const tScope = analyticsScope.forTasks(user, "t");
        const rows: any[] = await prisma.$queryRaw`
          SELECT
            t.id,
            t.title,
            t.status::text AS status,
            t.priority::text AS priority,
            u.name AS "assigneeName",
            to_char(t."dueDate", 'YYYY-MM-DD HH24:MI:SS') AS "dueDate",
            to_char(t."createdAt", 'YYYY-MM-DD HH24:MI:SS') AS "createdAt",
            to_char(t."completedAt", 'YYYY-MM-DD HH24:MI:SS') AS "completedAt"
          FROM "Task" t
          LEFT JOIN "User" u ON u.id = t."assigneeId"
          WHERE t."createdAt" >= ${fromDate}
            AND t."createdAt" <= ${toDate}
            AND ${tScope}
          ORDER BY t."createdAt" DESC;
        `;

        const header = toRow([
          "Task ID",
          "Title",
          "Status",
          "Priority",
          "Assignee",
          "Due Date (UTC)",
          "Created At (UTC)",
          "Completed At (UTC)",
        ]);

        const body = rows.map((r) =>
          toRow([
            r.id,
            r.title,
            r.status,
            r.priority,
            r.assigneeName || "Unassigned",
            r.dueDate,
            r.createdAt,
            r.completedAt,
          ])
        );

        return [header, ...body].join("\r\n");
      }

      case "approvals": {
        const astScope = analyticsScope.forApprovals(user, "ast");
        const rows: any[] = await prisma.$queryRaw`
          SELECT
            ast.id,
            wr.title AS "requestTitle",
            ast."stepOrder",
            ast."approverRole"::text AS "approverRole",
            ast.status::text AS status,
            u.name AS "approverName",
            to_char(ast."decidedAt", 'YYYY-MM-DD HH24:MI:SS') AS "decidedAt",
            ast.comment
          FROM "ApprovalStep" ast
          JOIN "WorkRequest" wr ON wr.id = ast."requestId"
          LEFT JOIN "User" u ON u.id = ast."approverId"
          WHERE ast."createdAt" >= ${fromDate}
            AND ast."createdAt" <= ${toDate}
            AND ${astScope}
          ORDER BY ast."createdAt" DESC;
        `;

        const header = toRow([
          "Step ID",
          "Request Title",
          "Step Order",
          "Approver Role",
          "Status",
          "Approver",
          "Decided At (UTC)",
          "Comment",
        ]);

        const body = rows.map((r) =>
          toRow([
            r.id,
            r.requestTitle,
            r.stepOrder,
            r.approverRole,
            r.status,
            r.approverName || "Pending",
            r.decidedAt,
            r.comment,
          ])
        );

        return [header, ...body].join("\r\n");
      }

      case "ai-usage": {
        if (!isAdminRole(user)) {
          throw AppError.forbidden("Admin access required for AI usage export");
        }

        const csScope = analyticsScope.forChatSessions(user, "cs");

        const rows: any[] = await prisma.$queryRaw`
          SELECT
            cm.id,
            cm.role::text AS role,
            cm."notFound",
            cm."tokensUsed",
            cm."inputTokens",
            cm."outputTokens",
            cm."latencyMs",
            cm.feedback,
            to_char(cm."createdAt", 'YYYY-MM-DD HH24:MI:SS') AS "createdAt"
          FROM "ChatMessage" cm
          JOIN "ChatSession" cs ON cs.id = cm."sessionId"
          WHERE cm."createdAt" >= ${fromDate}
            AND cm."createdAt" <= ${toDate}
            AND ${csScope}
          ORDER BY cm."createdAt" DESC;
        `;

        const header = toRow([
          "Message ID",
          "Role",
          "Not Found",
          "Tokens Used",
          "Input Tokens",
          "Output Tokens",
          "Latency (ms)",
          "Feedback",
          "Created At (UTC)",
        ]);

        const body = rows.map((r) =>
          toRow([
            r.id,
            r.role,
            r.notFound ? "YES" : "NO",
            r.tokensUsed,
            r.inputTokens,
            r.outputTokens,
            r.latencyMs,
            r.feedback === 1 ? "+1" : r.feedback === -1 ? "-1" : "None",
            r.createdAt,
          ])
        );

        return [header, ...body].join("\r\n");
      }
    }
  },
};
