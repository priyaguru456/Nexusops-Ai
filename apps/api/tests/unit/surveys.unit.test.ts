import { describe, it, expect, vi, beforeEach } from "vitest";
import { Role, RequestStatus } from "@prisma/client";
import {
  surveyService,
  calculateAverageCsat,
  calculateRatingDistribution,
  calculateWeeklyTrend,
  calculateCategoryBreakdown,
} from "../../src/modules/surveys/survey.service";
import { surveyRepository } from "../../src/modules/surveys/survey.repository";
import { auditService } from "../../src/modules/audit/audit.service";
import { notificationService } from "../../src/modules/notifications/notification.service";
import { AppError } from "../../src/lib/errors";
import type { AuthenticatedUser } from "../../src/types/express";

vi.mock("../../src/lib/prisma", () => ({
  prisma: {
    survey: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    surveyResponse: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    workRequest: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../src/modules/audit/audit.service", () => ({
  auditService: {
    log: vi.fn().mockResolvedValue({ id: "audit-1" }),
  },
}));

vi.mock("../../src/modules/notifications/notification.service", () => ({
  notificationService: {
    notify: vi.fn().mockResolvedValue(undefined),
    notifyMultiple: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("Survey Service Unit Tests: Math, Permissions, & One-Response Constraint", () => {
  const mockAdminUser: AuthenticatedUser = {
    id: "usr-admin-1",
    email: "admin@nexusops.com",
    name: "Admin User",
    role: Role.ADMIN,
    departmentId: "dept-it",
    isActive: true,
  };

  const mockEmployeeUser: AuthenticatedUser = {
    id: "usr-emp-1",
    email: "employee@nexusops.com",
    name: "Regular Employee",
    role: Role.EMPLOYEE,
    departmentId: "dept-it",
    isActive: true,
  };

  const mockOtherUser: AuthenticatedUser = {
    id: "usr-emp-2",
    email: "other@nexusops.com",
    name: "Other Employee",
    role: Role.EMPLOYEE,
    departmentId: "dept-hr",
    isActive: true,
  };

  const mockSurvey = {
    id: "survey-csat-uuid",
    title: "Request Fulfillment CSAT",
    isActive: true,
    targetRole: null,
    questions: [
      { id: "csat_rating", question: "How satisfied are you?", type: "rating", min: 1, max: 5 },
      { id: "csat_comment", question: "Comments", type: "text" },
    ],
    createdAt: new Date("2026-11-01T10:00:00Z"),
    updatedAt: new Date("2026-11-01T10:00:00Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Pure Metric Calculations (Average CSAT, Distribution, Trend, Category)", () => {
    it("calculates average CSAT accurately with proper rounding", () => {
      expect(calculateAverageCsat([])).toBe(0);
      expect(calculateAverageCsat([5])).toBe(5);
      expect(calculateAverageCsat([5, 5, 5])).toBe(5);
      expect(calculateAverageCsat([1, 2, 3, 4, 5])).toBe(3);
      expect(calculateAverageCsat([4, 5, 4])).toBe(4.33);
      expect(calculateAverageCsat([5, 4, 5, 3, 4])).toBe(4.2);
    });

    it("calculates rating distribution with star counts and percentages", () => {
      const ratings = [5, 5, 5, 4, 4, 3, 2, 1, 1, 1]; // 10 ratings
      const dist = calculateRatingDistribution(ratings);

      expect(dist).toHaveLength(5);
      // Stars are ordered 5 down to 1
      expect(dist[0]).toEqual({ stars: 5, count: 3, percentage: 30 });
      expect(dist[1]).toEqual({ stars: 4, count: 2, percentage: 20 });
      expect(dist[2]).toEqual({ stars: 3, count: 1, percentage: 10 });
      expect(dist[3]).toEqual({ stars: 2, count: 1, percentage: 10 });
      expect(dist[4]).toEqual({ stars: 1, count: 3, percentage: 30 });
    });

    it("handles rating distribution when there are 0 ratings", () => {
      const dist = calculateRatingDistribution([]);
      expect(dist).toEqual([
        { stars: 5, count: 0, percentage: 0 },
        { stars: 4, count: 0, percentage: 0 },
        { stars: 3, count: 0, percentage: 0 },
        { stars: 2, count: 0, percentage: 0 },
        { stars: 1, count: 0, percentage: 0 },
      ]);
    });

    it("aggregates weekly trend buckets chronologically", () => {
      const items = [
        { rating: 5, createdAt: new Date("2026-11-01T12:00:00Z") },
        { rating: 4, createdAt: new Date("2026-11-02T12:00:00Z") },
        { rating: 5, createdAt: new Date("2026-11-03T12:00:00Z") },
      ];
      const trend = calculateWeeklyTrend(items);

      expect(trend.length).toBeGreaterThan(0);
      expect(trend[0]).toHaveProperty("week");
      expect(trend[0]).toHaveProperty("averageCsat");
      expect(trend[0]).toHaveProperty("count");
    });

    it("aggregates category breakdown sorted by volume", () => {
      const items = [
        { rating: 5, category: "IT" },
        { rating: 4, category: "IT" },
        { rating: 3, category: "HR" },
        { rating: 5, category: "FINANCE" },
        { rating: 5, category: "FINANCE" },
        { rating: 4, category: "FINANCE" },
      ];
      const breakdown = calculateCategoryBreakdown(items);

      expect(breakdown).toHaveLength(3);
      // FINANCE has 3 ratings, IT has 2, HR has 1
      expect(breakdown[0].category).toBe("FINANCE");
      expect(breakdown[0].count).toBe(3);
      expect(breakdown[0].averageCsat).toBe(4.67);

      expect(breakdown[1].category).toBe("IT");
      expect(breakdown[1].count).toBe(2);
      expect(breakdown[1].averageCsat).toBe(4.5);

      expect(breakdown[2].category).toBe("HR");
      expect(breakdown[2].count).toBe(1);
      expect(breakdown[2].averageCsat).toBe(3);
    });
  });

  describe("2. One Response Per Request & Privacy Enforcement", () => {
    it("successfully records CSAT response for requester's completed request", async () => {
      vi.spyOn(surveyRepository, "findById").mockResolvedValue(mockSurvey as any);
      const { prisma } = await import("../../src/lib/prisma");

      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue({
        id: "req-123",
        title: "New Developer Laptop",
        category: "IT",
        status: RequestStatus.COMPLETED,
        requesterId: mockEmployeeUser.id,
      } as any);

      vi.spyOn(surveyRepository, "findResponseByUserAndEntity").mockResolvedValue(null);

      vi.spyOn(surveyRepository, "createResponse").mockResolvedValue({
        id: "resp-1",
        surveyId: mockSurvey.id,
        userId: mockEmployeeUser.id,
        entityType: "REQUEST",
        entityId: "req-123",
        answers: { rating: 5, comment: "Super fast fulfillment!" },
        createdAt: new Date(),
        user: mockEmployeeUser,
      } as any);

      const result = await surveyService.submitResponse(mockEmployeeUser, {
        surveyId: mockSurvey.id,
        entityType: "REQUEST",
        entityId: "req-123",
        answers: { rating: 5, comment: "Super fast fulfillment!" },
      });

      expect(result.id).toBe("resp-1");
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SURVEY_RESPONSE_SUBMITTED",
          actorId: mockEmployeeUser.id,
        })
      );
      expect(notificationService.notify).toHaveBeenCalledWith(
        mockEmployeeUser.id,
        "SURVEY_FEEDBACK_RECEIVED",
        "Feedback Received",
        expect.any(String),
        "/requests/req-123",
        "SurveyResponse",
        "resp-1"
      );
    });

    it("rejects duplicate response submission for the same request with 409 Conflict", async () => {
      vi.spyOn(surveyRepository, "findById").mockResolvedValue(mockSurvey as any);
      const { prisma } = await import("../../src/lib/prisma");

      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue({
        id: "req-123",
        title: "New Developer Laptop",
        status: RequestStatus.COMPLETED,
        requesterId: mockEmployeeUser.id,
      } as any);

      // Already responded!
      vi.spyOn(surveyRepository, "findResponseByUserAndEntity").mockResolvedValue({
        id: "existing-resp-id",
        surveyId: mockSurvey.id,
        userId: mockEmployeeUser.id,
        entityType: "REQUEST",
        entityId: "req-123",
        answers: { rating: 4 },
        createdAt: new Date(),
      } as any);

      await expect(
        surveyService.submitResponse(mockEmployeeUser, {
          surveyId: mockSurvey.id,
          entityType: "REQUEST",
          entityId: "req-123",
          answers: { rating: 5 },
        })
      ).rejects.toThrow(AppError);
    });

    it("records a Skip response so user is never prompted again for that request", async () => {
      vi.spyOn(surveyRepository, "findById").mockResolvedValue(mockSurvey as any);
      const { prisma } = await import("../../src/lib/prisma");

      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue({
        id: "req-123",
        title: "Access Card",
        status: RequestStatus.COMPLETED,
        requesterId: mockEmployeeUser.id,
      } as any);

      vi.spyOn(surveyRepository, "findResponseByUserAndEntity").mockResolvedValue(null);

      vi.spyOn(surveyRepository, "createResponse").mockResolvedValue({
        id: "resp-skip-1",
        surveyId: mockSurvey.id,
        userId: mockEmployeeUser.id,
        entityType: "REQUEST",
        entityId: "req-123",
        answers: { skipped: true, rating: null, comment: null },
        createdAt: new Date(),
        user: mockEmployeeUser,
      } as any);

      const result = await surveyService.submitResponse(mockEmployeeUser, {
        surveyId: mockSurvey.id,
        entityType: "REQUEST",
        entityId: "req-123",
        answers: { skipped: true },
      });

      expect(result.id).toBe("resp-skip-1");
      // Does NOT notify user since they skipped
      expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it("forbids employee from submitting CSAT for another user's request", async () => {
      vi.spyOn(surveyRepository, "findById").mockResolvedValue(mockSurvey as any);
      const { prisma } = await import("../../src/lib/prisma");

      // Request belongs to mockOtherUser
      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue({
        id: "req-456",
        title: "HR Document",
        status: RequestStatus.COMPLETED,
        requesterId: mockOtherUser.id,
      } as any);

      await expect(
        surveyService.submitResponse(mockEmployeeUser, {
          surveyId: mockSurvey.id,
          entityType: "REQUEST",
          entityId: "req-456",
          answers: { rating: 5 },
        })
      ).rejects.toThrow("You can only submit satisfaction surveys for your own requests");
    });

    it("rejects submitting CSAT for a request that is NOT completed", async () => {
      vi.spyOn(surveyRepository, "findById").mockResolvedValue(mockSurvey as any);
      const { prisma } = await import("../../src/lib/prisma");

      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue({
        id: "req-789",
        title: "WIP Task",
        status: RequestStatus.IN_PROGRESS,
        requesterId: mockEmployeeUser.id,
      } as any);

      await expect(
        surveyService.submitResponse(mockEmployeeUser, {
          surveyId: mockSurvey.id,
          entityType: "REQUEST",
          entityId: "req-789",
          answers: { rating: 5 },
        })
      ).rejects.toThrow("Satisfaction surveys can only be submitted for completed requests");
    });

    it("rejects submitting response if survey is inactive", async () => {
      vi.spyOn(surveyRepository, "findById").mockResolvedValue({
        ...mockSurvey,
        isActive: false,
      } as any);

      await expect(
        surveyService.submitResponse(mockEmployeeUser, {
          surveyId: mockSurvey.id,
          entityType: "REQUEST",
          entityId: "req-123",
          answers: { rating: 5 },
        })
      ).rejects.toThrow("This survey is currently inactive");
    });
  });

  describe("3. Admin Operations & Results Aggregation", () => {
    it("creates a new survey and audits action", async () => {
      const newSurvey = {
        title: "Annual Operations Survey",
        isActive: true,
        targetRole: null,
        questions: [{ id: "q1", question: "Rate operations", type: "rating" as const }],
      };

      vi.spyOn(surveyRepository, "createSurvey").mockResolvedValue({
        id: "new-survey-id",
        ...newSurvey,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const created = await surveyService.createSurvey(mockAdminUser, newSurvey);

      expect(created.id).toBe("new-survey-id");
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SURVEY_CREATED",
          actorId: mockAdminUser.id,
        })
      );
    });

    it("toggles survey active status and audits action", async () => {
      vi.spyOn(surveyRepository, "findById").mockResolvedValue(mockSurvey as any);
      vi.spyOn(surveyRepository, "toggleActive").mockResolvedValue({
        ...mockSurvey,
        isActive: false,
      } as any);

      const toggled = await surveyService.toggleActive(mockAdminUser, mockSurvey.id);

      expect(toggled.isActive).toBe(false);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SURVEY_STATUS_TOGGLED",
          actorId: mockAdminUser.id,
        })
      );
    });

    it("aggregates results including average CSAT, response counts, category breakdown, and comments", async () => {
      const mockRawResponses = [
        {
          id: "r1",
          surveyId: mockSurvey.id,
          userId: "u1",
          entityType: "REQUEST",
          entityId: "req-1",
          answers: { rating: 5, comment: "Excellent service" },
          createdAt: new Date("2026-11-02T10:00:00Z"),
          survey: { id: mockSurvey.id, title: mockSurvey.title },
          user: { id: "u1", name: "Alice", role: Role.EMPLOYEE },
        },
        {
          id: "r2",
          surveyId: mockSurvey.id,
          userId: "u2",
          entityType: "REQUEST",
          entityId: "req-2",
          answers: { rating: 3, comment: "Took a bit long" },
          createdAt: new Date("2026-11-03T10:00:00Z"),
          survey: { id: mockSurvey.id, title: mockSurvey.title },
          user: { id: "u2", name: "Bob", role: Role.EMPLOYEE },
        },
        {
          id: "r3",
          surveyId: mockSurvey.id,
          userId: "u3",
          entityType: "REQUEST",
          entityId: "req-3",
          answers: { skipped: true },
          createdAt: new Date("2026-11-04T10:00:00Z"),
          survey: { id: mockSurvey.id, title: mockSurvey.title },
          user: { id: "u3", name: "Charlie", role: Role.EMPLOYEE },
        },
      ];

      vi.spyOn(surveyRepository, "getResponsesForResults").mockResolvedValue(mockRawResponses as any);
      vi.spyOn(surveyRepository, "findRequestsByIds").mockResolvedValue([
        { id: "req-1", title: "Monitor Request", category: "IT" },
        { id: "req-2", title: "Benefits Inquiry", category: "HR" },
      ] as any);

      const results = await surveyService.getResults(mockSurvey.id);

      expect(results.averageCsat).toBe(4); // (5 + 3) / 2
      expect(results.responseCount).toBe(2);
      expect(results.totalSubmissions).toBe(3);
      expect(results.skipCount).toBe(1);
      expect(results.recentComments).toHaveLength(2);
      expect(results.breakdownByCategory).toHaveLength(2);
    });
  });
});
