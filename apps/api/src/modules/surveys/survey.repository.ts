import { Role, RequestStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { DEFAULT_ORGANIZATION_ID } from "../../lib/tenant";
import type { CreateSurveyInput, UpdateSurveyInput } from "./survey.schema";

export class SurveyRepository {
  async findDefaultActiveSurvey(targetRole?: Role | null, organizationId?: string) {
    return prisma.survey.findFirst({
      where: {
        ...(organizationId ? { organizationId } : {}),
        isActive: true,
        OR: [
          { targetRole: null },
          ...(targetRole ? [{ targetRole }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findPendingCsatForUser(
    userId: string,
    targetRole?: Role | null,
    organizationId?: string
  ) {
    const activeSurvey = await this.findDefaultActiveSurvey(targetRole, organizationId);
    if (!activeSurvey) {
      return null;
    }

    // Find all completed requests for this user that have not received a SurveyResponse
    const respondedRequestIds = await prisma.surveyResponse.findMany({
      where: {
        userId,
        entityType: "REQUEST",
      },
      select: {
        entityId: true,
      },
    });

    const excludedIds = respondedRequestIds.map((r) => r.entityId);

    const pendingRequest = await prisma.workRequest.findFirst({
      where: {
        ...(organizationId ? { organizationId } : {}),
        requesterId: userId,
        status: RequestStatus.COMPLETED,
        id: {
          notIn: excludedIds.length > 0 ? excludedIds : undefined,
        },
      },
      orderBy: {
        completedAt: "desc",
      },
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        completedAt: true,
      },
    });

    if (!pendingRequest) {
      return null;
    }

    return {
      survey: activeSurvey,
      request: pendingRequest,
    };
  }

  async createSurvey(data: CreateSurveyInput & { organizationId?: string }) {
    return prisma.survey.create({
      data: {
        organizationId: data.organizationId ?? DEFAULT_ORGANIZATION_ID,
        title: data.title,
        isActive: data.isActive ?? true,
        targetRole: data.targetRole ?? null,
        questions: data.questions as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async updateSurvey(id: string, data: UpdateSurveyInput) {
    return prisma.survey.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.targetRole !== undefined ? { targetRole: data.targetRole } : {}),
        ...(data.questions !== undefined
          ? { questions: data.questions as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  async toggleActive(id: string) {
    const survey = await prisma.survey.findUnique({ where: { id } });
    if (!survey) return null;
    return prisma.survey.update({
      where: { id },
      data: { isActive: !survey.isActive },
    });
  }

  async findById(id: string) {
    return prisma.survey.findUnique({
      where: { id },
      include: {
        _count: {
          select: { responses: true },
        },
      },
    });
  }

  async findAll(organizationId?: string) {
    return prisma.survey.findMany({
      where: organizationId ? { organizationId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { responses: true },
        },
      },
    });
  }

  async findResponseByUserAndEntity(userId: string, entityType: string, entityId: string) {
    return prisma.surveyResponse.findUnique({
      where: {
        userId_entityType_entityId: {
          userId,
          entityType,
          entityId,
        },
      },
    });
  }

  async createResponse(data: {
    surveyId: string;
    userId: string;
    entityType: string;
    entityId: string;
    answers: Prisma.InputJsonValue;
  }) {
    return prisma.surveyResponse.create({
      data: {
        surveyId: data.surveyId,
        userId: data.userId,
        entityType: data.entityType,
        entityId: data.entityId,
        answers: data.answers,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async getResponsesForResults(
    surveyId?: string,
    fromDate?: Date,
    toDate?: Date,
    organizationId?: string
  ) {
    const where: Prisma.SurveyResponseWhereInput = {
      ...(surveyId ? { surveyId } : {}),
      ...(organizationId ? { survey: { organizationId } } : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    };

    return prisma.surveyResponse.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        survey: {
          select: { id: true, title: true },
        },
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    });
  }

  async findRequestsByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return prisma.workRequest.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        title: true,
        category: true,
      },
    });
  }

  async listResponses(filters: {
    organizationId?: string;
    surveyId?: string;
    entityType?: string;
    page: number;
    limit: number;
  }) {
    const where: Prisma.SurveyResponseWhereInput = {
      ...(filters.organizationId ? { survey: { organizationId: filters.organizationId } } : {}),
      ...(filters.surveyId ? { surveyId: filters.surveyId } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.surveyResponse.count({ where }),
      prisma.surveyResponse.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: "desc" },
        include: {
          survey: {
            select: { id: true, title: true },
          },
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
    ]);

    return {
      total,
      items,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    };
  }
}

export const surveyRepository = new SurveyRepository();
