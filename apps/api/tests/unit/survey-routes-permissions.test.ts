import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { authorize } from "../../src/middleware/auth";
import { surveyController } from "../../src/modules/surveys/survey.controller";
import { surveyService } from "../../src/modules/surveys/survey.service";
import { AppError } from "../../src/lib/errors";

vi.mock("../../src/modules/surveys/survey.service", () => ({
  surveyService: {
    getPendingCsat: vi.fn(),
    submitResponse: vi.fn(),
    createSurvey: vi.fn(),
    updateSurvey: vi.fn(),
    toggleActive: vi.fn(),
    listSurveys: vi.fn(),
    getSurveyById: vi.fn(),
    getResults: vi.fn(),
    listResponses: vi.fn(),
  },
}));

const createMockResponse = () => {
  const res: Partial<Response> & { statusCode?: number; body?: any } = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res as Response;
  };
  res.json = (data: any) => {
    res.body = data;
    return res as Response;
  };
  return res as Response & { statusCode: number; body: any };
};

describe("Survey Routes & RBAC Permissions Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Role-Based Access Control (authorize middleware)", () => {
    const adminOnlyMiddleware = authorize(Role.ADMIN);

    it("allows ADMIN to access admin-only survey routes", () => {
      const req = {
        user: { id: "admin-1", role: Role.ADMIN },
      } as unknown as Request;
      const res = createMockResponse();
      let nextCalled = false;
      const next: NextFunction = (err?: any) => {
        expect(err).toBeUndefined();
        nextCalled = true;
      };

      adminOnlyMiddleware(req, res, next);
      expect(nextCalled).toBe(true);
    });

    it("forbids EMPLOYEE from accessing admin-only survey routes", () => {
      const req = {
        user: { id: "emp-1", role: Role.EMPLOYEE },
      } as unknown as Request;
      const res = createMockResponse();
      let capturedError: any = null;
      const next: NextFunction = (err?: any) => {
        capturedError = err;
      };

      adminOnlyMiddleware(req, res, next);
      expect(capturedError).toBeInstanceOf(AppError);
      expect(capturedError.statusCode).toBe(403);
      expect(capturedError.message).toContain("permission");
    });

    it("forbids MANAGER from accessing admin-only survey results & survey admin pages", () => {
      const req = {
        user: { id: "mgr-1", role: Role.MANAGER },
      } as unknown as Request;
      const res = createMockResponse();
      let capturedError: any = null;
      const next: NextFunction = (err?: any) => {
        capturedError = err;
      };

      adminOnlyMiddleware(req, res, next);
      expect(capturedError).toBeInstanceOf(AppError);
      expect(capturedError.statusCode).toBe(403);
    });
  });

  describe("2. Survey Controller Methods Execution", () => {
    it("getPendingCsat returns data for authenticated employee", async () => {
      vi.mocked(surveyService.getPendingCsat).mockResolvedValue({
        survey: { id: "survey-1", title: "CSAT" } as any,
        request: { id: "req-1", title: "Laptop" } as any,
      });

      const req = {
        user: { id: "emp-1", role: Role.EMPLOYEE },
      } as unknown as Request;
      const res = createMockResponse();
      const next: NextFunction = vi.fn();

      await surveyController.getPendingCsat(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.pending).toBe(true);
      expect(res.body.data.request.id).toBe("req-1");
    });

    it("submitResponse returns 201 on valid submission", async () => {
      vi.mocked(surveyService.submitResponse).mockResolvedValue({
        id: "resp-1",
        surveyId: "survey-1",
        userId: "emp-1",
        entityType: "REQUEST",
        entityId: "req-1",
        answers: { rating: 5, comment: "Great!" },
      } as any);

      const req = {
        user: { id: "emp-1", role: Role.EMPLOYEE },
        body: {
          surveyId: "11111111-1111-1111-1111-111111111111",
          entityType: "REQUEST",
          entityId: "req-1",
          answers: { rating: 5, comment: "Great!" },
        },
      } as unknown as Request;
      const res = createMockResponse();
      const next: NextFunction = vi.fn();

      await surveyController.submitResponse(req, res, next);

      expect(res.statusCode).toBe(201);
      expect(res.body.response.id).toBe("resp-1");
      expect(res.body.message).toContain("submitted");
    });

    it("getResults returns aggregate metrics for admin", async () => {
      vi.mocked(surveyService.getResults).mockResolvedValue({
        averageCsat: 4.5,
        responseCount: 10,
        totalSubmissions: 12,
        skipCount: 2,
        ratingDistribution: [],
        trendByWeek: [],
        breakdownByCategory: [],
        recentComments: [],
      });

      const req = {
        user: { id: "admin-1", role: Role.ADMIN },
        query: {},
      } as unknown as Request;
      const res = createMockResponse();
      const next: NextFunction = vi.fn();

      await surveyController.getResults(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.results.averageCsat).toBe(4.5);
      expect(res.body.results.responseCount).toBe(10);
    });
  });
});
