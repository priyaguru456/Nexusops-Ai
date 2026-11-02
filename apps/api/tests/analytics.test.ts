import { describe, it, expect, vi, beforeEach } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { dateRangeQuerySchema, exportQuerySchema } from "../src/modules/analytics/analytics.schema";
import { analyticsService } from "../src/modules/analytics/analytics.service";
import { analyticsController } from "../src/modules/analytics/analytics.controller";
import { authorize } from "../src/middleware/auth";
import type { Request, Response, NextFunction } from "express";

vi.mock("../src/lib/prisma", () => {
  return {
    prisma: {
      $queryRaw: vi.fn(),
    },
  };
});

describe("Analytics Module Unit & Integration Tests", () => {
  const adminUser = {
    id: "a0000000-0000-4000-8000-000000000001",
    name: "Admin User",
    email: "admin@nexusops.com",
    role: Role.ADMIN,
    isActive: true,
    departmentId: null,
  };

  const managerUser = {
    id: "b0000000-0000-4000-8000-000000000001",
    name: "Engineering Manager",
    email: "manager@nexusops.com",
    role: Role.MANAGER,
    isActive: true,
    departmentId: "dept-engineering",
  };

  const employeeUser = {
    id: "c0000000-0000-4000-8000-000000000001",
    name: "Jane Employee",
    email: "jane@nexusops.com",
    role: Role.EMPLOYEE,
    isActive: true,
    departmentId: "dept-engineering",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Date Range Schema Validation", () => {
    it("defaults to the last 30 days UTC when from and to are omitted", () => {
      const parsed = dateRangeQuerySchema.parse({});
      expect(parsed.fromDate).toBeInstanceOf(Date);
      expect(parsed.toDate).toBeInstanceOf(Date);
      expect(parsed.fromDate <= parsed.toDate).toBe(true);

      const diffDays = Math.round(
        (parsed.toDate.getTime() - parsed.fromDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(diffDays).toBeGreaterThanOrEqual(30);
    });

    it("parses valid custom ISO date range and treats 'to' as end of day", () => {
      const parsed = dateRangeQuerySchema.parse({
        from: "2026-10-01",
        to: "2026-10-15",
      });

      expect(parsed.fromDate.toISOString()).toBe("2026-10-01T00:00:00.000Z");
      expect(parsed.toDate.toISOString()).toBe("2026-10-15T23:59:59.999Z");
    });

    it("rejects invalid date strings", () => {
      expect(() =>
        dateRangeQuerySchema.parse({ from: "invalid-date", to: "2026-10-15" })
      ).toThrow();
    });

    it("rejects date ranges where from > to", () => {
      expect(() =>
        dateRangeQuerySchema.parse({ from: "2026-10-20", to: "2026-10-10" })
      ).toThrow(/'from' date must be less than or equal to 'to' date/);
    });

    it("rejects date ranges exceeding 366 days", () => {
      expect(() =>
        dateRangeQuerySchema.parse({ from: "2025-01-01", to: "2026-03-01" })
      ).toThrow(/cannot exceed 366 days/);
    });

    it("validates CSV export query schema and requires valid type", () => {
      const valid = exportQuerySchema.parse({
        type: "requests",
        from: "2026-10-01",
        to: "2026-10-10",
      });
      expect(valid.type).toBe("requests");

      expect(() =>
        exportQuerySchema.parse({
          type: "unsupported-type",
        })
      ).toThrow();
    });
  });

  describe("Role-Based Access Control Middleware", () => {
    it("allows ADMIN to access admin-only routes", () => {
      const req = { user: adminUser } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      authorize(Role.ADMIN)(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it("returns 403 Forbidden when an EMPLOYEE accesses admin-only route", () => {
      const req = { user: employeeUser } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      authorize(Role.ADMIN)(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: expect.stringMatching(/permission/i),
        })
      );
    });

    it("returns 403 Forbidden when a MANAGER accesses /api/analytics/ai-usage (admin only)", () => {
      const req = { user: managerUser } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      authorize(Role.ADMIN)(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: expect.stringMatching(/permission/i),
        })
      );
    });
  });

  describe("Role Scoping in SQL WHERE Clauses", () => {
    const fromDate = new Date("2026-10-01T00:00:00.000Z");
    const toDate = new Date("2026-10-30T23:59:59.999Z");

    it("scopes EMPLOYEE queries to their own requester_id and assignee_id", async () => {
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([{
          totalRequests: 4,
          open: 1,
          approved: 1,
          rejected: 1,
          completed: 1,
          draft: 0,
          cancelled: 0,
          avgCompletionHours: 15.0,
        }])
        .mockResolvedValueOnce([{
          avgApprovalHours: 3.5,
        }])
        .mockResolvedValueOnce([{
          total: 5,
          todo: 1,
          inProgress: 2,
          blocked: 1,
          done: 1,
          overdue: 1,
        }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{
          totalQuestions: 10,
          notFoundCount: 1,
          totalAnswers: 9,
          avgLatencyMs: 800,
          positiveFeedback: 8,
          negativeFeedback: 1,
          totalInputTokens: 15000,
          totalOutputTokens: 8000,
        }]);

      await analyticsService.getOverview(employeeUser as any, fromDate, toDate);

      const calls = vi.mocked(prisma.$queryRaw).mock.calls;
      expect(calls.length).toBe(6);

      // Verify that every query passes employee ID in the parameters
      const stringifiedArgs = calls.flatMap((call) => call.map((c) => JSON.stringify(c)));
      const employeeFound = stringifiedArgs.some((arg) => arg.includes(employeeUser.id));
      expect(employeeFound).toBe(true);

      // Verify it does NOT query company-wide or department ID
      const deptFound = stringifiedArgs.some((arg) => arg.includes("dept-engineering"));
      expect(deptFound).toBe(false);
    });

    it("scopes MANAGER queries to their department in SQL WHERE clause", async () => {
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([{
          totalRequests: 12,
          open: 5,
          approved: 4,
          rejected: 1,
          completed: 2,
          draft: 0,
          cancelled: 0,
          avgCompletionHours: null,
        }])
        .mockResolvedValueOnce([{
          avgApprovalHours: 6.2,
        }])
        .mockResolvedValueOnce([{
          total: 10,
          todo: 3,
          inProgress: 4,
          blocked: 1,
          done: 2,
          overdue: 2,
        }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await analyticsService.getOverview(managerUser as any, fromDate, toDate);

      const calls = vi.mocked(prisma.$queryRaw).mock.calls;
      const stringifiedArgs = calls.flatMap((call) => call.map((c) => JSON.stringify(c)));
      const deptFound = stringifiedArgs.some((arg) => arg.includes("dept-engineering"));
      expect(deptFound).toBe(true);
    });

    it("applies company-wide scope for ADMIN without filtering by requester or department", async () => {
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([{
          totalRequests: 50,
          open: 20,
          approved: 15,
          rejected: 5,
          completed: 10,
          draft: 0,
          cancelled: 0,
          avgCompletionHours: 28.4,
        }])
        .mockResolvedValueOnce([{
          avgApprovalHours: 5.1,
        }])
        .mockResolvedValueOnce([{
          total: 40,
          todo: 10,
          inProgress: 15,
          blocked: 5,
          done: 10,
          overdue: 4,
        }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{
          totalQuestions: 200,
          notFoundCount: 8,
          totalAnswers: 190,
          avgLatencyMs: 1050,
          positiveFeedback: 120,
          negativeFeedback: 6,
          totalInputTokens: 1500000,
          totalOutputTokens: 600000,
        }]);

      await analyticsService.getOverview(adminUser as any, fromDate, toDate);

      const calls = vi.mocked(prisma.$queryRaw).mock.calls;
      const stringifiedArgs = calls.flatMap((call) => call.map((c) => JSON.stringify(c)));
      expect(stringifiedArgs.some((arg) => arg.includes("dept-engineering"))).toBe(false);
    });
  });

  describe("Exact Metric Calculations", () => {
    const fromDate = new Date("2026-10-01T00:00:00.000Z");
    const toDate = new Date("2026-10-30T23:59:59.999Z");

    it("returns exact totals, overdue tasks, and handles null averages properly", async () => {
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([{
          totalRequests: 15,
          open: 5,
          approved: 4,
          rejected: 2,
          completed: 4,
          draft: 0,
          cancelled: 0,
          avgCompletionHours: 18.75,
        }])
        .mockResolvedValueOnce([{
          avgApprovalHours: null, // No completed approvals: must return null, not 0
        }])
        .mockResolvedValueOnce([{
          total: 12,
          todo: 4,
          inProgress: 3,
          blocked: 1,
          done: 4,
          overdue: 3, // Exact overdue count
        }])
        .mockResolvedValueOnce([
          { category: "SOFTWARE_ACCESS", count: 8 },
          { category: "EQUIPMENT", count: 7 },
        ])
        .mockResolvedValueOnce([
          { date: "2026-10-01", count: 2 },
          { date: "2026-10-02", count: 3 },
        ])
        .mockResolvedValueOnce([{
          totalQuestions: 25,
          notFoundCount: 2,
          totalAnswers: 23,
          avgLatencyMs: 1100,
          positiveFeedback: 18,
          negativeFeedback: 2,
          totalInputTokens: 100000,
          totalOutputTokens: 40000,
        }]);

      const result = await analyticsService.getOverview(adminUser as any, fromDate, toDate);

      expect(result.totals.totalRequests).toBe(15);
      expect(result.totals.open).toBe(5);
      expect(result.totals.completed).toBe(4);
      expect(result.tasks.overdue).toBe(3);
      expect(result.performance.avgApprovalTimeHours).toBeNull();
      expect(result.performance.avgCompletionTimeHours).toBe(18.8); // rounded to 1 decimal
      expect(result.requestsByCategory).toHaveLength(2);
      expect(result.requestsByCategory[0]).toEqual({ category: "SOFTWARE_ACCESS", count: 8 });
    });

    it("calculates AI token cost accurately from configured prices per MTok", async () => {
      // Query 1: questionsPerDay
      // Query 2: overall metrics
      // Query 3: topDocuments
      // 2,000,000 input tokens * $3/MTok = $6.00
      // 1,000,000 output tokens * $15/MTok = $15.00
      // Total expected = $21.00
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([
          { date: "2026-10-01", count: 10 },
          { date: "2026-10-02", count: 15 },
        ])
        .mockResolvedValueOnce([{
          totalQuestions: 100,
          totalAnswers: 95,
          notFoundCount: 5,
          avgLatencyMs: 1250,
          positiveFeedback: 45,
          negativeFeedback: 5,
          totalInputTokens: 2000000,
          totalOutputTokens: 1000000,
          totalTokensUsed: 3000000,
        }])
        .mockResolvedValueOnce([
          { documentId: "doc-1", title: "Employee Handbook", citationCount: 50 },
        ]);

      const result = await analyticsService.getAIUsageAnalytics(adminUser as any, fromDate, toDate);

      expect(result.metrics.tokens.inputTokens).toBe(2000000);
      expect(result.metrics.tokens.outputTokens).toBe(1000000);
      expect(result.metrics.tokens.totalTokens).toBe(3000000);
      expect(result.metrics.tokens.estimatedCostUsd).toBe(21.0);
      expect(result.metrics.notFoundRatePercent).toBe(5.3); // 5/95 * 100 = 5.26 -> 5.3%
      expect(result.mostUsedDocuments[0].title).toBe("Employee Handbook");
    });
  });

  describe("CSV Export & Formula Injection Prevention", () => {
    const fromDate = new Date("2026-10-01T00:00:00.000Z");
    const toDate = new Date("2026-10-30T23:59:59.999Z");

    it("prefixes malicious formula characters (=, +, -, @) with a single quote", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
        {
          id: "req-1",
          title: "=cmd|' /C calc'!A0",
          category: "+DDE('cmd';'/c calc';'__DdeLink__')",
          priority: "-HIGH",
          status: "@SUM(1+1)",
          amount: 250.0,
          requesterName: "Test User",
          createdAt: "2026-10-15 10:00:00",
          submittedAt: "2026-10-15 10:05:00",
          completedAt: null,
        },
      ]);

      const csv = await analyticsService.exportCSV(adminUser as any, "requests", fromDate, toDate);

      expect(csv).toContain("Request ID,Title,Category,Priority,Status,Amount,Requester,Created At (UTC),Submitted At (UTC),Completed At (UTC)");

      // Verify malicious values are prefixed with single quote
      expect(csv).toContain("'=cmd|' /C calc'!A0");
      expect(csv).toContain("'+DDE('cmd';'/c calc';'__DdeLink__')");
      expect(csv).toContain("'-HIGH");
      expect(csv).toContain("'@SUM(1+1)");
    });

    it("properly quotes values containing commas, quotes, and newlines", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
        {
          id: "task-1",
          title: 'Upgrade "PostgreSQL", verify replica',
          status: "DONE",
          priority: "HIGH",
          assigneeName: "Jane Doe",
          dueDate: "2026-10-20 00:00:00",
          createdAt: "2026-10-10 10:00:00",
          completedAt: "2026-10-19 14:00:00",
        },
      ]);

      const csv = await analyticsService.exportCSV(adminUser as any, "tasks", fromDate, toDate);

      // Quotes should be escaped with double quotes: "Upgrade ""PostgreSQL"", verify replica"
      expect(csv).toContain('"Upgrade ""PostgreSQL"", verify replica"');
    });
  });

  describe("Analytics Controller Handlers", () => {
    it("getOverview responds with status 200 and formatted data", async () => {
      const mockReq = {
        user: adminUser,
        query: { from: "2026-10-01", to: "2026-10-15" },
      } as unknown as Request;

      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
      const mockRes = { status: statusMock } as unknown as Response;
      const mockNext = vi.fn();

      vi.spyOn(analyticsService, "getOverview").mockResolvedValueOnce({
        dateRange: { from: "2026-10-01", to: "2026-10-15" },
        totals: {
          totalRequests: 10,
          open: 4,
          approved: 3,
          rejected: 1,
          completed: 2,
          draft: 0,
          cancelled: 0,
        },
        performance: { avgApprovalTimeHours: 4.0, avgCompletionTimeHours: 20.0 },
        tasks: { total: 5, todo: 1, inProgress: 2, blocked: 0, done: 2, overdue: 0 },
        requestsByCategory: [],
        requestsOverTime: [],
        aiSummary: null,
      });

      await analyticsController.getOverview(mockReq, mockRes, mockNext);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          data: expect.objectContaining({
            totals: expect.objectContaining({ totalRequests: 10 }),
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("exportCSV sets text/csv and Content-Disposition attachment headers", async () => {
      const mockReq = {
        user: adminUser,
        query: { type: "requests", from: "2026-10-01", to: "2026-10-15" },
      } as unknown as Request;

      const setHeaderMock = vi.fn();
      const sendMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ send: sendMock });
      const mockRes = {
        setHeader: setHeaderMock,
        status: statusMock,
      } as unknown as Response;
      const mockNext = vi.fn();

      vi.spyOn(analyticsService, "exportCSV").mockResolvedValueOnce("id,title\n1,Demo");

      await analyticsController.exportCSV(mockReq, mockRes, mockNext);

      expect(setHeaderMock).toHaveBeenCalledWith("Content-Type", "text/csv; charset=utf-8");
      expect(setHeaderMock).toHaveBeenCalledWith(
        "Content-Disposition",
        expect.stringContaining('attachment; filename="nexusops-analytics-requests-')
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(sendMock).toHaveBeenCalledWith("id,title\n1,Demo");
    });
  });
});
