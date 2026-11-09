import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getZonedTime,
  isScheduleDue,
  DigestService,
  digestService,
} from "../../src/modules/analytics/digest.service";
import { analyticsController } from "../../src/modules/analytics/analytics.controller";
import { authorize } from "../../src/middleware/auth";
import { emailService } from "../../src/lib/email.service";
import { prisma } from "../../src/lib/prisma";
import { DigestSchedule, DigestFrequency, Role } from "@prisma/client";

describe("Weekly Analytics Digest Unit Tests", () => {
  describe("Schedule Calculation & Timezones", () => {
    it("correctly converts UTC timestamp to Asia/Kolkata (IST = UTC + 5:30)", () => {
      // 2026-11-02 is a Monday. 03:30 UTC is 09:00 IST
      const utcDate = new Date("2026-11-02T03:30:00.000Z");
      const zoned = getZonedTime(utcDate, "Asia/Kolkata");

      expect(zoned.dayOfWeek).toBe(1); // Monday
      expect(zoned.hour).toBe(9);      // 09:00 AM
      expect(zoned.minute).toBe(0);
      expect(zoned.dateStr).toBe("2026-11-02");
    });

    it("correctly handles day boundary transitions across timezones", () => {
      // Sunday 20:00 UTC is Monday 01:30 IST
      const utcDate = new Date("2026-11-01T20:00:00.000Z");
      const istZoned = getZonedTime(utcDate, "Asia/Kolkata");
      const utcZoned = getZonedTime(utcDate, "UTC");

      // In UTC, it's Sunday (0) at 20:00
      expect(utcZoned.dayOfWeek).toBe(0);
      expect(utcZoned.hour).toBe(20);

      // In IST, it's Monday (1) at 01:30
      expect(istZoned.dayOfWeek).toBe(1);
      expect(istZoned.hour).toBe(1);
      expect(istZoned.minute).toBe(30);
    });

    it("evaluates isScheduleDue as true when day, hour and timezone match", () => {
      const now = new Date("2026-11-02T03:30:00.000Z"); // Monday 09:00 IST
      const schedule: DigestSchedule = {
        id: "sched-1",
        recipients: ["admin@nexusops.com"],
        frequency: DigestFrequency.WEEKLY,
        dayOfWeek: 1, // Monday
        hour: 9,      // 09:00 AM
        timezone: "Asia/Kolkata",
        isActive: true,
        lastRunAt: null,
        createdBy: "usr-admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isScheduleDue(schedule, now)).toBe(true);
    });

    it("evaluates isScheduleDue as false when inactive", () => {
      const now = new Date("2026-11-02T03:30:00.000Z");
      const schedule: DigestSchedule = {
        id: "sched-1",
        recipients: ["admin@nexusops.com"],
        frequency: DigestFrequency.WEEKLY,
        dayOfWeek: 1,
        hour: 9,
        timezone: "Asia/Kolkata",
        isActive: false, // Paused
        lastRunAt: null,
        createdBy: "usr-admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isScheduleDue(schedule, now)).toBe(false);
    });

    it("evaluates isScheduleDue as false when day of week does not match", () => {
      const now = new Date("2026-11-02T03:30:00.000Z"); // Monday
      const schedule: DigestSchedule = {
        id: "sched-1",
        recipients: ["admin@nexusops.com"],
        frequency: DigestFrequency.WEEKLY,
        dayOfWeek: 2, // Tuesday
        hour: 9,
        timezone: "Asia/Kolkata",
        isActive: true,
        lastRunAt: null,
        createdBy: "usr-admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isScheduleDue(schedule, now)).toBe(false);
    });

    it("evaluates isScheduleDue as false when hour does not match", () => {
      const now = new Date("2026-11-02T03:30:00.000Z"); // 09:00 IST
      const schedule: DigestSchedule = {
        id: "sched-1",
        recipients: ["admin@nexusops.com"],
        frequency: DigestFrequency.WEEKLY,
        dayOfWeek: 1,
        hour: 14, // 02:00 PM
        timezone: "Asia/Kolkata",
        isActive: true,
        lastRunAt: null,
        createdBy: "usr-admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isScheduleDue(schedule, now)).toBe(false);
    });
  });

  describe("Duplicate-Send Prevention", () => {
    it("prevents duplicate execution if schedule already executed on the same calendar day in timezone", () => {
      const now = new Date("2026-11-02T03:30:00.000Z"); // Monday 09:00 IST
      const alreadyRanEarlierToday = new Date("2026-11-02T02:00:00.000Z"); // Monday 07:30 IST

      const schedule: DigestSchedule = {
        id: "sched-1",
        recipients: ["admin@nexusops.com"],
        frequency: DigestFrequency.WEEKLY,
        dayOfWeek: 1,
        hour: 9,
        timezone: "Asia/Kolkata",
        isActive: true,
        lastRunAt: alreadyRanEarlierToday,
        createdBy: "usr-admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isScheduleDue(schedule, now)).toBe(false);
    });

    it("prevents duplicate execution if lastRunAt was within 20 hours buffer", () => {
      const now = new Date("2026-11-02T03:30:00.000Z");
      const ran10HoursAgo = new Date(now.getTime() - 10 * 3600 * 1000);

      const schedule: DigestSchedule = {
        id: "sched-1",
        recipients: ["admin@nexusops.com"],
        frequency: DigestFrequency.WEEKLY,
        dayOfWeek: 1,
        hour: 9,
        timezone: "Asia/Kolkata",
        isActive: true,
        lastRunAt: ran10HoursAgo,
        createdBy: "usr-admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isScheduleDue(schedule, now)).toBe(false);
    });

    it("allows execution when last execution was 7 days ago", () => {
      const now = new Date("2026-11-02T03:30:00.000Z"); // Monday
      const lastWeekRun = new Date("2026-10-26T03:30:00.000Z"); // Previous Monday

      const schedule: DigestSchedule = {
        id: "sched-1",
        recipients: ["admin@nexusops.com"],
        frequency: DigestFrequency.WEEKLY,
        dayOfWeek: 1,
        hour: 9,
        timezone: "Asia/Kolkata",
        isActive: true,
        lastRunAt: lastWeekRun,
        createdBy: "usr-admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isScheduleDue(schedule, now)).toBe(true);
    });

    it("atomic claimScheduleExecution uses atomic database conditions to prevent concurrent instance duplicates", async () => {
      const service = new DigestService();
      const now = new Date("2026-11-02T03:30:00.000Z");

      // Mock prisma.digestSchedule.updateMany
      const updateManySpy = vi.spyOn(prisma.digestSchedule, "updateMany");

      // Case 1: First worker claims -> count = 1
      updateManySpy.mockResolvedValueOnce({ count: 1 });
      const claimedFirst = await service.claimScheduleExecution("sched-1", now);
      expect(claimedFirst).toBe(true);
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "sched-1",
            isActive: true,
          }),
          data: { lastRunAt: now },
        })
      );

      // Case 2: Concurrent second worker tries to claim -> count = 0 (blocked by WHERE clause)
      updateManySpy.mockResolvedValueOnce({ count: 0 });
      const claimedSecond = await service.claimScheduleExecution("sched-1", now);
      expect(claimedSecond).toBe(false);

      updateManySpy.mockRestore();
    });
  });

  describe("Failure & Success Delivery Logging", () => {
    let digestService: DigestService;

    beforeEach(() => {
      digestService = new DigestService();
      vi.restoreAllMocks();
    });

    it("logs failure in DigestDelivery table and does not crash when email delivery fails", async () => {
      // Mock compileDigestSummary
      vi.spyOn(digestService, "compileDigestSummary").mockResolvedValueOnce({
        dateRange: { from: "2026-10-26", to: "2026-11-02" },
        totals: {
          totalRequests: 10,
          open: 4,
          approved: 3,
          rejected: 1,
          completed: 2,
          draft: 0,
          cancelled: 0,
        },
        performance: { avgApprovalTimeHours: 4.5, avgCompletionTimeHours: 12.0 },
        tasks: { total: 8, todo: 2, inProgress: 3, blocked: 1, done: 2, overdue: 1 },
        requestsByCategory: [{ category: "IT", count: 7 }, { category: "HR", count: 3 }],
        requestsOverTime: [],
        aiSummary: {
          totalQuestions: 25,
          notFoundRatePercent: 4.0,
          avgLatencyMs: 450,
          positiveFeedbackCount: 15,
          negativeFeedbackCount: 1,
          estimatedCostUsd: 0.85,
        },
      });

      // Mock emailService.sendEmail to throw
      vi.spyOn(emailService, "sendEmail").mockRejectedValueOnce(
        new Error("SMTP Connection Refused: ETIMEDOUT")
      );

      // Mock prisma.digestDelivery.create and update
      vi.spyOn(prisma.digestDelivery, "create").mockResolvedValueOnce({
        id: "deliv-failed-1",
        scheduleId: "sched-1",
        sentAt: new Date(),
        status: "PENDING",
        error: null,
        recipientCount: 1,
        createdAt: new Date(),
      });

      const updateSpy = vi.spyOn(prisma.digestDelivery, "update").mockResolvedValueOnce({
        id: "deliv-failed-1",
        scheduleId: "sched-1",
        sentAt: new Date(),
        status: "FAILED",
        error: "SMTP Connection Refused: ETIMEDOUT",
        recipientCount: 1,
        createdAt: new Date(),
      });

      const result = await digestService.sendDigest({
        scheduleId: "sched-1",
        recipients: ["director@nexusops.com"],
        isTest: false,
      });

      expect(result.success).toBe(false);
      expect(result.deliveryId).toBe("deliv-failed-1");
      expect(result.error).toContain("SMTP Connection Refused");

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: "deliv-failed-1" },
        data: {
          status: "FAILED",
          error: "SMTP Connection Refused: ETIMEDOUT",
        },
      });
    });

    it("logs SUCCESS in DigestDelivery table when email delivery succeeds", async () => {
      vi.spyOn(digestService, "compileDigestSummary").mockResolvedValueOnce({
        dateRange: { from: "2026-10-26", to: "2026-11-02" },
        totals: {
          totalRequests: 5,
          open: 2,
          approved: 1,
          rejected: 0,
          completed: 2,
          draft: 0,
          cancelled: 0,
        },
        performance: { avgApprovalTimeHours: 3.0, avgCompletionTimeHours: 8.0 },
        tasks: { total: 4, todo: 1, inProgress: 1, blocked: 0, done: 2, overdue: 0 },
        requestsByCategory: [{ category: "FINANCE", count: 5 }],
        requestsOverTime: [],
        aiSummary: null,
      });

      vi.spyOn(emailService, "sendEmail").mockResolvedValueOnce();

      vi.spyOn(prisma.digestDelivery, "create").mockResolvedValueOnce({
        id: "deliv-success-1",
        scheduleId: "sched-1",
        sentAt: new Date(),
        status: "PENDING",
        error: null,
        recipientCount: 2,
        createdAt: new Date(),
      });

      const updateSpy = vi.spyOn(prisma.digestDelivery, "update").mockResolvedValueOnce({
        id: "deliv-success-1",
        scheduleId: "sched-1",
        sentAt: new Date(),
        status: "SUCCESS",
        error: null,
        recipientCount: 2,
        createdAt: new Date(),
      });

      const result = await digestService.sendDigest({
        scheduleId: "sched-1",
        recipients: ["admin@nexusops.com", "ops@nexusops.com"],
        isTest: true,
      });

      expect(result.success).toBe(true);
      expect(result.deliveryId).toBe("deliv-success-1");
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: "deliv-success-1" },
        data: expect.objectContaining({
          status: "SUCCESS",
        }),
      });
    });
  });

  describe("HTML Digest Email Generation", () => {
    it("renders email-client safe HTML containing real KPI metrics, categories, and Asia/Kolkata date headers", () => {
      const digestService = new DigestService();
      const fromDate = new Date("2026-10-26T00:00:00.000Z");
      const toDate = new Date("2026-11-02T00:00:00.000Z");

      const overview = {
        dateRange: { from: "2026-10-26", to: "2026-11-02" },
        totals: {
          totalRequests: 42,
          open: 12,
          approved: 15,
          rejected: 5,
          completed: 10,
          draft: 0,
          cancelled: 0,
        },
        performance: { avgApprovalTimeHours: 5.2, avgCompletionTimeHours: 18.4 },
        tasks: { total: 30, todo: 5, inProgress: 10, blocked: 2, done: 13, overdue: 3 },
        requestsByCategory: [
          { category: "IT", count: 24 },
          { category: "HR", count: 18 },
        ],
        requestsOverTime: [],
        aiSummary: {
          totalQuestions: 156,
          notFoundRatePercent: 3.2,
          avgLatencyMs: 380,
          positiveFeedbackCount: 88,
          negativeFeedbackCount: 4,
          estimatedCostUsd: 4.52,
        },
      };

      const html = digestService.renderDigestHtml(overview, fromDate, toDate, "Asia/Kolkata");

      // Validates structural components
      expect(html).toContain("NexusOps AI");
      expect(html).toContain("Weekly Operations & Analytics Digest");
      expect(html).toContain("42"); // total requests
      expect(html).toContain("10"); // completed
      expect(html).toContain("30"); // total tasks
      expect(html).toContain("18.4h"); // avg completion
      expect(html).toContain("156"); // AI queries
      expect(html).toContain("$4.52"); // AI cost
      expect(html).toContain("IT"); // category
      expect(html).toContain("View Full Analytics Dashboard");
      expect(html).toContain("Asia/Kolkata");
    });
  });

  describe("Admin Controller & Route Authorization Unit Tests", () => {
    it("authorize middleware blocks EMPLOYEE and MANAGER roles with 403 Forbidden", () => {
      const authMiddleware = authorize(Role.ADMIN);

      const empReq: any = { user: { id: "u-1", role: Role.EMPLOYEE } };
      const mgrReq: any = { user: { id: "u-2", role: Role.MANAGER } };
      const nextEmp = vi.fn();
      const nextMgr = vi.fn();

      authMiddleware(empReq, {} as any, nextEmp);
      expect(nextEmp).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );

      authMiddleware(mgrReq, {} as any, nextMgr);
      expect(nextMgr).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });

    it("authorize middleware allows ADMIN role", () => {
      const authMiddleware = authorize(Role.ADMIN);
      const adminReq: any = { user: { id: "u-admin", role: Role.ADMIN } };
      const next = vi.fn();

      authMiddleware(adminReq, {} as any, next);
      expect(next).toHaveBeenCalledWith();
    });

    it("getDigestSchedule returns 200 with schedule data", async () => {
      const req: any = { user: { id: "u-admin", role: Role.ADMIN } };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      vi.spyOn(digestService, "getSchedule").mockResolvedValueOnce({
        id: "sched-1",
        recipients: ["admin@company.com"],
        frequency: "WEEKLY",
        dayOfWeek: 1,
        hour: 9,
        timezone: "Asia/Kolkata",
        isActive: true,
        lastRunAt: null,
        createdBy: "u-admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await analyticsController.getDigestSchedule(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: "success",
        data: expect.objectContaining({ id: "sched-1" }),
      });
    });

    it("saveDigestSchedule validates payload and saves", async () => {
      const req: any = {
        user: { id: "u-admin", role: Role.ADMIN },
        body: {
          recipients: ["lead@company.com"],
          dayOfWeek: 1,
          hour: 9,
          timezone: "Asia/Kolkata",
          isActive: true,
        },
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      vi.spyOn(digestService, "saveSchedule").mockResolvedValueOnce({
        id: "sched-1",
        recipients: ["lead@company.com"],
        frequency: "WEEKLY",
        dayOfWeek: 1,
        hour: 9,
        timezone: "Asia/Kolkata",
        isActive: true,
        lastRunAt: null,
        createdBy: "u-admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await analyticsController.saveDigestSchedule(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: "success",
        data: expect.objectContaining({ recipients: ["lead@company.com"] }),
      });
    });

    it("saveDigestSchedule rejects invalid input with validation error via next()", async () => {
      const req: any = {
        user: { id: "u-admin", role: Role.ADMIN },
        body: {
          recipients: ["invalid-email-not-valid"],
          dayOfWeek: 1,
          hour: 9,
        },
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await analyticsController.saveDigestSchedule(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it("sendTestDigest returns 200 on success", async () => {
      const req: any = {
        user: { id: "u-admin", role: Role.ADMIN, email: "admin@company.com" },
        body: { recipients: ["test@company.com"] },
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      vi.spyOn(digestService, "getSchedule").mockResolvedValueOnce(null);
      vi.spyOn(digestService, "sendDigest").mockResolvedValueOnce({
        success: true,
        deliveryId: "deliv-test-1",
      });

      await analyticsController.sendTestDigest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: "success" })
      );
    });

    it("sendTestDigest returns 502 on delivery failure", async () => {
      const req: any = {
        user: { id: "u-admin", role: Role.ADMIN, email: "admin@company.com" },
        body: { recipients: ["test@company.com"] },
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      vi.spyOn(digestService, "getSchedule").mockResolvedValueOnce(null);
      vi.spyOn(digestService, "sendDigest").mockResolvedValueOnce({
        success: false,
        error: "SMTP server down",
      });

      await analyticsController.sendTestDigest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: "error", message: "SMTP server down" })
      );
    });

    it("getDigestDeliveries returns 200 with paginated results", async () => {
      const req: any = {
        user: { id: "u-admin", role: Role.ADMIN },
        query: { page: "1", limit: "10" },
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      vi.spyOn(digestService, "getDeliveries").mockResolvedValueOnce({
        deliveries: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });

      await analyticsController.getDigestDeliveries(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: "success",
        data: expect.objectContaining({ deliveries: [] }),
      });
    });
  });
});
