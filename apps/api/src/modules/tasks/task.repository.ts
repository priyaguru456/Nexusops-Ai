import { prisma } from "../../lib/prisma";
import { Prisma, TaskStatus, Priority } from "@prisma/client";

export const taskDetailInclude = {
  assignee: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      departmentId: true,
    },
  },
  assignedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  request: {
    select: {
      id: true,
      title: true,
      status: true,
      category: true,
      requesterId: true,
      requester: {
        select: {
          departmentId: true,
        },
      },
    },
  },
} as const;

export interface CreateTaskData {
  title: string;
  description?: string | null;
  priority?: Priority;
  status?: TaskStatus;
  dueDate?: Date | null;
  requestId?: string | null;
  assigneeId?: string | null;
  assignedById?: string | null;
  organizationId: string;
}

export interface UpdateTaskData {
  title?: string;
  description?: string | null;
  priority?: Priority;
  status?: TaskStatus;
  dueDate?: Date | null;
  completedAt?: Date | null;
}

export interface TaskQueryFilters {
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  requestId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export class TaskRepository {
  async findById(id: string) {
    return prisma.task.findUnique({
      where: { id },
      include: taskDetailInclude,
    });
  }

  async create(data: CreateTaskData) {
    return prisma.task.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        priority: data.priority ?? Priority.MEDIUM,
        status: data.status ?? TaskStatus.TODO,
        dueDate: data.dueDate ?? null,
        requestId: data.requestId ?? null,
        assigneeId: data.assigneeId ?? null,
        assignedById: data.assignedById ?? null,
        organizationId: data.organizationId,
      },
      include: taskDetailInclude,
    });
  }

  async update(id: string, data: UpdateTaskData) {
    const updatePayload: Prisma.TaskUpdateInput = {};
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.priority !== undefined) updatePayload.priority = data.priority;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.dueDate !== undefined) updatePayload.dueDate = data.dueDate;
    if (data.completedAt !== undefined) updatePayload.completedAt = data.completedAt;

    return prisma.task.update({
      where: { id },
      data: updatePayload,
      include: taskDetailInclude,
    });
  }

  async assign(id: string, assigneeId: string | null, assignedById: string) {
    return prisma.task.update({
      where: { id },
      data: {
        assigneeId,
        assignedById,
      },
      include: taskDetailInclude,
    });
  }

  async findAll(filters: TaskQueryFilters, visibilityWhere: Prisma.TaskWhereInput = {}) {
    const andConditions: Prisma.TaskWhereInput[] = [];

    if (visibilityWhere && Object.keys(visibilityWhere).length > 0) {
      andConditions.push(visibilityWhere);
    }

    if (filters.status) {
      andConditions.push({ status: filters.status });
    }

    if (filters.priority) {
      andConditions.push({ priority: filters.priority });
    }

    if (filters.assigneeId) {
      andConditions.push({ assigneeId: filters.assigneeId });
    }

    if (filters.requestId) {
      andConditions.push({ requestId: filters.requestId });
    }

    if (filters.search && typeof filters.search === "string" && filters.search.trim()) {
      andConditions.push({
        OR: [
          { title: { contains: filters.search.trim(), mode: "insensitive" } },
          { description: { contains: filters.search.trim(), mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.TaskWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;
    const take = limit;

    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "title",
      "priority",
      "status",
      "dueDate",
    ] as const;
    const sortBy = (filters.sortBy && allowedSortFields.includes(filters.sortBy as any))
      ? filters.sortBy
      : "createdAt";
    const sortOrder = filters.sortOrder === "asc" ? "asc" : "desc";

    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: taskDetailInclude,
      }),
    ]);

    return {
      tasks,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async delete(id: string) {
    return prisma.task.delete({
      where: { id },
    });
  }
}

export const taskRepository = new TaskRepository();
