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
}

export interface UpdateTaskData {
  title?: string;
  description?: string | null;
  priority?: Priority;
  status?: TaskStatus;
  dueDate?: Date | null;
}

export interface TaskQueryFilters {
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  requestId?: string;
  search?: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
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

  async findAll(filters: TaskQueryFilters, visibilityWhere: Prisma.TaskWhereInput) {
    const where: Prisma.TaskWhereInput = {
      AND: [visibilityWhere],
    };

    const andConditions: Prisma.TaskWhereInput[] = [];

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

    if (filters.search) {
      andConditions.push({
        OR: [
          { title: { contains: filters.search, mode: "insensitive" } },
          { description: { contains: filters.search, mode: "insensitive" } },
        ],
      });
    }

    if (andConditions.length > 0) {
      (where.AND as Prisma.TaskWhereInput[]).push(...andConditions);
    }

    const skip = (filters.page - 1) * filters.limit;
    const take = filters.limit;

    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        skip,
        take,
        orderBy: {
          [filters.sortBy]: filters.sortOrder,
        },
        include: taskDetailInclude,
      }),
    ]);

    return {
      tasks,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit) || 1,
    };
  }
}

export const taskRepository = new TaskRepository();
