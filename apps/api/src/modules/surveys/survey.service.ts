import { Role, RequestStatus } from "@prisma/client";
import { surveyRepository } from "./survey.repository";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import {
  assertSameTenant,
  DEFAULT_ORGANIZATION_ID,
  isSuperAdmin,
  resolveTenantId,
} from "../../lib/tenant";
import { auditService } from "../audit/audit.service";
import { notificationService } from "../notifications/notification.service";
import type { AuthenticatedUser } from "../../types/express";
import type { CreateSurveyInput, UpdateSurveyInput, SubmitSurveyResponseInput } from "./survey.schema";

function resolveOptionalSurveyOrgId(user?: AuthenticatedUser): string | undefined {
  if (!user || user.organizationId === undefined) return undefined;
  if (isSuperAdmin(user) && !user.organizationId) return undefined;
  return resolveTenantId(user);
}

export interface RatingDistributionItem {
  stars: number;
  count: number;
  percentage: number;
}

export interface WeeklyTrendItem {
  week: string;
  averageCsat: number;
  count: number;
}

export interface CategoryBreakdownItem {
  category: string;
  averageCsat: number;
  count: number;
}

export interface RecentCommentItem {
  id: string;
  rating: number | null;
  comment: string;
  userName: string;
  userRole: Role;
  requestTitle?: string;
  category?: string;
  createdAt: string;
}

export interface SurveyResultsResponse {
  averageCsat: number;
  responseCount: number;
  totalSubmissions: number;
  skipCount: number;
  ratingDistribution: RatingDistributionItem[];
  trendByWeek: WeeklyTrendItem[];
  breakdownByCategory: CategoryBreakdownItem[];
  recentComments: RecentCommentItem[];
}

/**
 * Pure calculation helpers for CSAT metrics
 */
export function calculateAverageCsat(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, curr) => acc + curr, 0);
  return Math.round((sum / ratings.length) * 100) / 100;
}

export function calculateRatingDistribution(ratings: number[]): RatingDistributionItem[] {
  const total = ratings.length;
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const r of ratings) {
    if (r >= 1 && r <= 5) {
      counts[r] = (counts[r] || 0) + 1;
    }
  }

  return [5, 4, 3, 2, 1].map((stars) => {
    const count = counts[stars] || 0;
    const percentage = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
    return {
      stars,
      count,
      percentage,
    };
  });
}

function getWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function calculateWeeklyTrend(items: Array<{ rating: number; createdAt: Date }>): WeeklyTrendItem[] {
  const weekMap = new Map<string, number[]>();

  for (const item of items) {
    if (item.rating >= 1 && item.rating <= 5) {
      const key = getWeekKey(item.createdAt);
      if (!weekMap.has(key)) {
        weekMap.set(key, []);
      }
      weekMap.get(key)!.push(item.rating);
    }
  }

  // Sort weeks chronologically
  const sortedWeeks = Array.from(weekMap.keys()).sort();

  return sortedWeeks.map((week) => {
    const ratings = weekMap.get(week)!;
    return {
      week,
      averageCsat: calculateAverageCsat(ratings),
      count: ratings.length,
    };
  });
}

export function calculateCategoryBreakdown(
  items: Array<{ rating: number; category: string }>
): CategoryBreakdownItem[] {
  const categoryMap = new Map<string, number[]>();

  for (const item of items) {
    if (item.rating >= 1 && item.rating <= 5) {
      const cat = item.category || "OTHER";
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, []);
      }
      categoryMap.get(cat)!.push(item.rating);
    }
  }

  return Array.from(categoryMap.entries())
    .map(([category, ratings]) => ({
      category,
      averageCsat: calculateAverageCsat(ratings),
      count: ratings.length,
    }))
    .sort((a, b) => b.count - a.count);
}

export class SurveyService {
  /**
   * Automatically seed a default CSAT survey for the organization if none exists.
   */
  async ensureDefaultCsatSurvey(organizationId: string = DEFAULT_ORGANIZATION_ID) {
    const existing = await prisma.survey.findFirst({
      where: {
        organizationId,
        title: "Request Fulfillment CSAT",
      },
    });
    if (existing) return existing;

    try {
      return await prisma.survey.create({
        data: {
          organizationId,
          title: "Request Fulfillment CSAT",
          isActive: true,
          targetRole: null,
          questions: [
            {
              id: "csat_rating",
              question: "How satisfied are you with this fulfillment?",
              type: "rating",
              min: 1,
              max: 5,
              required: true,
            },
            {
              id: "csat_comment",
              question: "Any comments or suggestions?",
              type: "text",
              required: false,
            },
          ],
        },
      });
    } catch {
      // If concurrent request created it, return existing
      return prisma.survey.findFirst({
        where: {
          organizationId,
          title: "Request Fulfillment CSAT",
        },
      });
    }
  }

  /**
   * Finds the most recent completed request for the authenticated user
   * that hasn't received a CSAT response yet.
   */
  async getPendingCsat(user: AuthenticatedUser) {
    const orgId = resolveOptionalSurveyOrgId(user);
    await this.ensureDefaultCsatSurvey(orgId ?? DEFAULT_ORGANIZATION_ID);
    return surveyRepository.findPendingCsatForUser(user.id, user.role, orgId);
  }

  /**
   * Submits a CSAT survey response or skips it.
   * Enforces one response per user per completed request.
   */
  async submitResponse(user: AuthenticatedUser, input: SubmitSurveyResponseInput) {
    const survey = await surveyRepository.findById(input.surveyId);
    if (!survey) {
      throw AppError.notFound("Survey not found");
    }

    assertSameTenant(survey.organizationId, user, "Survey not found");

    if (!survey.isActive) {
      throw AppError.badRequest("This survey is currently inactive");
    }

    // Role eligibility check
    if (survey.targetRole && survey.targetRole !== user.role) {
      throw AppError.forbidden("You are not eligible for this survey");
    }

    // If answering for a WorkRequest
    if (input.entityType === "REQUEST") {
      const request = await prisma.workRequest.findUnique({
        where: { id: input.entityId },
      });

      if (!request) {
        throw AppError.notFound("Target request not found");
      }

      assertSameTenant(request.organizationId, user, "Target request not found");

      // Requester privacy: only requester can submit CSAT for their fulfilled request
      if (request.requesterId !== user.id) {
        throw AppError.forbidden("You can only submit satisfaction surveys for your own requests");
      }

      // Must be COMPLETED
      if (request.status !== RequestStatus.COMPLETED) {
        throw AppError.badRequest("Satisfaction surveys can only be submitted for completed requests");
      }
    }

    // Check if response already exists (One response per user per completed request)
    const existing = await surveyRepository.findResponseByUserAndEntity(
      user.id,
      input.entityType,
      input.entityId
    );

    if (existing) {
      throw AppError.conflict("You have already submitted a response for this request");
    }

    // Answers sanitization & normalization
    const rating = typeof input.answers?.rating === "number" ? input.answers.rating : null;
    const comment = typeof input.answers?.comment === "string" ? input.answers.comment.trim() : null;
    const isSkipped = Boolean(input.answers?.skipped);

    const savedResponse = await surveyRepository.createResponse({
      surveyId: input.surveyId,
      userId: user.id,
      entityType: input.entityType,
      entityId: input.entityId,
      answers: {
        ...input.answers,
        rating: isSkipped ? null : rating,
        comment: isSkipped ? null : comment,
        skipped: isSkipped,
      },
    });

    // Record audit log
    await auditService.log({
      organizationId: survey.organizationId ?? null,
      actorId: user.id,
      action: "SURVEY_RESPONSE_SUBMITTED",
      entityType: "SurveyResponse",
      entityId: savedResponse.id,
      summary: isSkipped
        ? `User skipped CSAT survey for ${input.entityType} #${input.entityId}`
        : `User submitted CSAT rating (${rating}★) for ${input.entityType} #${input.entityId}`,
      metadata: {
        surveyId: input.surveyId,
        entityType: input.entityType,
        entityId: input.entityId,
        rating,
        skipped: isSkipped,
      },
    });

    // Send notifications if feedback provided
    if (!isSkipped) {
      await notificationService.notify(
        user.id,
        "SURVEY_FEEDBACK_RECEIVED",
        "Feedback Received",
        "Thank you for sharing your feedback on request fulfillment.",
        `/requests/${input.entityId}`,
        "SurveyResponse",
        savedResponse.id
      );

      // Low CSAT Alert for Admins in the survey's organization if rating is 1 or 2 stars
      if (rating && rating <= 2) {
        const alertOrgId = survey.organizationId ?? resolveOptionalSurveyOrgId(user);
        const admins = await prisma.user.findMany({
          where: {
            role: Role.ADMIN,
            isActive: true,
            ...(alertOrgId ? { organizationId: alertOrgId } : {}),
          },
          select: { id: true },
        });

        const adminIds = admins.map((a) => a.id);
        await notificationService.notifyMultiple(
          adminIds,
          "LOW_CSAT_ALERT",
          "Low CSAT Alert",
          `Low rating (${rating}★) received for Request #${input.entityId}: "${comment || "No comment"}"`,
          `/admin/surveys`,
          "SurveyResponse",
          savedResponse.id
        );
      }
    }

    return savedResponse;
  }

  async createSurvey(user: AuthenticatedUser, input: CreateSurveyInput) {
    const orgId =
      user.organizationId !== undefined ? resolveTenantId(user) : DEFAULT_ORGANIZATION_ID;
    const survey = await surveyRepository.createSurvey({
      ...input,
      organizationId: orgId,
    });

    await auditService.log({
      organizationId: survey.organizationId ?? (user.organizationId !== undefined ? orgId : null),
      actorId: user.id,
      action: "SURVEY_CREATED",
      entityType: "Survey",
      entityId: survey.id,
      summary: `Created survey "${survey.title}"`,
      metadata: {
        title: survey.title,
        targetRole: survey.targetRole,
        isActive: survey.isActive,
      },
    });

    return survey;
  }

  async updateSurvey(user: AuthenticatedUser, id: string, input: UpdateSurveyInput) {
    const existing = await surveyRepository.findById(id);
    if (!existing) {
      throw AppError.notFound("Survey not found");
    }

    assertSameTenant(existing.organizationId, user, "Survey not found");

    const updated = await surveyRepository.updateSurvey(id, input);

    await auditService.log({
      organizationId: existing.organizationId ?? null,
      actorId: user.id,
      action: "SURVEY_UPDATED",
      entityType: "Survey",
      entityId: id,
      summary: `Updated survey "${updated.title}"`,
      metadata: {
        changes: input,
      },
    });

    return updated;
  }

  async toggleActive(user: AuthenticatedUser, id: string) {
    const existing = await surveyRepository.findById(id);
    if (!existing) {
      throw AppError.notFound("Survey not found");
    }

    assertSameTenant(existing.organizationId, user, "Survey not found");

    const updated = await surveyRepository.toggleActive(id);
    if (!updated) {
      throw AppError.notFound("Survey not found");
    }

    await auditService.log({
      organizationId: existing.organizationId ?? null,
      actorId: user.id,
      action: "SURVEY_STATUS_TOGGLED",
      entityType: "Survey",
      entityId: id,
      summary: `Toggled survey "${updated.title}" to ${updated.isActive ? "ACTIVE" : "INACTIVE"}`,
      metadata: {
        isActive: updated.isActive,
      },
    });

    return updated;
  }

  async listSurveys(user?: AuthenticatedUser) {
    const orgId = resolveOptionalSurveyOrgId(user);
    await this.ensureDefaultCsatSurvey(orgId ?? DEFAULT_ORGANIZATION_ID);
    return surveyRepository.findAll(orgId);
  }

  async getSurveyById(id: string, user?: AuthenticatedUser) {
    const survey = await surveyRepository.findById(id);
    if (!survey) {
      throw AppError.notFound("Survey not found");
    }
    if (user) {
      assertSameTenant(survey.organizationId, user, "Survey not found");
    }
    return survey;
  }

  /**
   * Aggregates survey results (Admin only)
   * Average CSAT, response count, rating distribution, trend by week and by category, and recent comments.
   */
  async getResults(
    surveyId?: string,
    fromDateStr?: string,
    toDateStr?: string,
    user?: AuthenticatedUser
  ): Promise<SurveyResultsResponse> {
    const orgId = resolveOptionalSurveyOrgId(user);
    await this.ensureDefaultCsatSurvey(orgId ?? DEFAULT_ORGANIZATION_ID);

    const fromDate = fromDateStr ? new Date(fromDateStr) : undefined;
    const toDate = toDateStr ? new Date(toDateStr) : undefined;

    const rawResponses = await surveyRepository.getResponsesForResults(
      surveyId,
      fromDate,
      toDate,
      orgId
    );

    // Extract requests to map categories
    const requestEntityIds = rawResponses
      .filter((r) => r.entityType === "REQUEST")
      .map((r) => r.entityId);

    const requests = await surveyRepository.findRequestsByIds(Array.from(new Set(requestEntityIds)));
    const requestMap = new Map(requests.map((req) => [req.id, req]));

    const ratings: number[] = [];
    const trendItems: Array<{ rating: number; createdAt: Date }> = [];
    const categoryItems: Array<{ rating: number; category: string }> = [];
    const recentComments: RecentCommentItem[] = [];
    let skipCount = 0;

    for (const r of rawResponses) {
      const answers = (r.answers as Record<string, any>) || {};
      const rating = typeof answers.rating === "number" ? answers.rating : null;
      const isSkipped = Boolean(answers.skipped);
      const comment = typeof answers.comment === "string" ? answers.comment.trim() : "";

      if (isSkipped || rating === null) {
        skipCount++;
        continue;
      }

      ratings.push(rating);
      trendItems.push({ rating, createdAt: r.createdAt });

      const req = requestMap.get(r.entityId);
      const category = req?.category || "OTHER";
      categoryItems.push({ rating, category });

      if (comment.length > 0) {
        recentComments.push({
          id: r.id,
          rating,
          comment,
          userName: r.user.name,
          userRole: r.user.role,
          requestTitle: req?.title,
          category,
          createdAt: r.createdAt.toISOString(),
        });
      }
    }

    return {
      averageCsat: calculateAverageCsat(ratings),
      responseCount: ratings.length,
      totalSubmissions: rawResponses.length,
      skipCount,
      ratingDistribution: calculateRatingDistribution(ratings),
      trendByWeek: calculateWeeklyTrend(trendItems),
      breakdownByCategory: calculateCategoryBreakdown(categoryItems),
      recentComments: recentComments.slice(0, 50),
    };
  }

  async listResponses(
    filters: {
      surveyId?: string;
      entityType?: string;
      page: number;
      limit: number;
    },
    user?: AuthenticatedUser
  ) {
    const orgId = resolveOptionalSurveyOrgId(user);
    return surveyRepository.listResponses({
      ...filters,
      ...(orgId ? { organizationId: orgId } : {}),
    });
  }
}

export const surveyService = new SurveyService();
