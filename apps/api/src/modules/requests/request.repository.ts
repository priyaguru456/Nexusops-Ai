import { prisma } from "../../lib/prisma";
import { Prisma, RequestStatus, Priority, RequestCategory } from "@prisma/client";

export const requestDetailInclude = {
  requester: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      departmentId: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  attachments: {
    select: {
      id: true,
      fileName: true,
      filePath: true,
      createdAt: true,
    },
  },
  tasks: {
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      assigneeId: true,
      dueDate: true,
      createdAt: true,
    },
  },
  approvalSteps: {
    orderBy: {
      stepOrder: "asc" as const,
    },
    select: {
      id: true,
      stepOrder: true,
      approverRole: true,
      approverId: true,
      approver: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      status: true,
      comment: true,
      decidedAt: true,
    },
  },
} as const;

export interface CreateRequestData {
  title: string;
  description: string;
  category: RequestCategory;
  priority?: Priority;
  amount?: number | null;
  dueDate?: Date | null;
  requesterId: string;
  attachments?: Array<{ fileName: string; filePath: string }>;
}

export interface UpdateRequestData {
  title?: string;
  description?: string;
  category?: RequestCategory;
  priority?: Priority;
  amount?: number | null;
  dueDate?: Date | null;
}

export interface RequestQueryFilters {
  status?: RequestStatus;
  priority?: Priority;
  category?: RequestCategory;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export class RequestRepository {
  async findById(id: string) {
    return prisma.workRequest.findUnique({
      where: { id },
      include: requestDetailInclude,
    });
  }

  async create(data: CreateRequestData) {
    return prisma.workRequest.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority ?? Priority.MEDIUM,
        status: RequestStatus.DRAFT,
        amount: data.amount !== undefined && data.amount !== null ? new Prisma.Decimal(data.amount) : null,
        dueDate: data.dueDate ?? null,
        requesterId: data.requesterId,
        attachments: data.attachments?.length
          ? {
              create: data.attachments.map((att) => ({
                fileName: att.fileName,
                filePath: att.filePath,
              })),
            }
          : undefined,
      },
      include: requestDetailInclude,
    });
  }

  async update(id: string, data: UpdateRequestData) {
    const updatePayload: Prisma.WorkRequestUpdateInput = {};
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.category !== undefined) updatePayload.category = data.category;
    if (data.priority !== undefined) updatePayload.priority = data.priority;
    if (data.amount !== undefined) {
      updatePayload.amount = data.amount !== null ? new Prisma.Decimal(data.amount) : null;
    }
    if (data.dueDate !== undefined) updatePayload.dueDate = data.dueDate;

    return prisma.workRequest.update({
      where: { id },
      data: updatePayload,
      include: requestDetailInclude,
    });
  }

  async updateStatus(id: string, status: RequestStatus) {
    return prisma.workRequest.update({
      where: { id },
      data: { status },
      include: requestDetailInclude,
    });
  }

  async addAttachment(requestId: string, attachment: { fileName: string; filePath: string }) {
    return prisma.requestAttachment.create({
      data: {
        requestId,
        fileName: attachment.fileName,
        filePath: attachment.filePath,
      },
    });
  }

  async getActivityHistory(requestId: string) {
    return prisma.auditLog.findMany({
      where: {
        entityType: "WorkRequest",
        entityId: requestId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        actor: {
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

  async findAll(filters: RequestQueryFilters, visibilityWhere: Prisma.WorkRequestWhereInput) {
    const where: Prisma.WorkRequestWhereInput = {
      AND: [visibilityWhere],
    };

    const andConditions: Prisma.WorkRequestWhereInput[] = [];

    if (filters.status) {
      andConditions.push({ status: filters.status });
    }

    if (filters.priority) {
      andConditions.push({ priority: filters.priority });
    }

    if (filters.category) {
      andConditions.push({ category: filters.category });
    }

    if (filters.startDate || filters.endDate) {
      const dateCondition: Prisma.DateTimeFilter = {};
      if (filters.startDate) dateCondition.gte = filters.startDate;
      if (filters.endDate) dateCondition.lte = filters.endDate;
      andConditions.push({ createdAt: dateCondition });
    }

    if (filters.search) {
      andConditions.push({
        OR: [
          { title: { contains: filters.search, mode: "insensitive" } },
          { description: { contains: filters.search, mode: "insensitive" } },
        ],
      });
    }

    if (andConditions.length > 0) {
      (where.AND as Prisma.WorkRequestWhereInput[]).push(...andConditions);
    }

    const skip = (filters.page - 1) * filters.limit;
    const take = filters.limit;

    const [total, requests] = await Promise.all([
      prisma.workRequest.count({ where }),
      prisma.workRequest.findMany({
        where,
        skip,
        take,
        orderBy: {
          [filters.sortBy]: filters.sortOrder,
        },
        include: requestDetailInclude,
      }),
    ]);

    return {
      requests,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit) || 1,
    };
  }
}

export const requestRepository = new RequestRepository();
