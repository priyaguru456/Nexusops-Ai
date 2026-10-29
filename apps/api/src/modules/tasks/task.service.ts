import { Role, Prisma, TaskStatus } from "@prisma/client";
import {
  taskRepository,
  type CreateTaskData,
  type UpdateTaskData,
  type TaskQueryFilters,
} from "./task.repository";
import { canTransitionTask } from "./task.state-machine";
import { auditService } from "../audit/audit.service";
import { AppError } from "../../lib/errors";
import type { AuthenticatedUser } from "../../types/express";

export class TaskService {
  /**
   * Builds the visibility query based on RBAC rules:
   * - Employees see only their own tasks (assigned to them or on their requests)
   * - Managers see own + their department's tasks
   * - Admins see all
   */
  private buildVisibilityFilter(user: AuthenticatedUser): Prisma.TaskWhereInput {
    if (user.role === Role.ADMIN) {
      return {};
    }

    if (user.role === Role.MANAGER) {
      if (user.departmentId) {
        return {
          OR: [
            { assigneeId: user.id },
            { assignedById: user.id },
            { assignee: { departmentId: user.departmentId } },
            { request: { requester: { departmentId: user.departmentId } } },
          ],
        };
      }
      return {
        OR: [{ assigneeId: user.id }, { assignedById: user.id }],
      };
    }

    // Role.EMPLOYEE
    return {
      OR: [
        { assigneeId: user.id },
        { request: { requesterId: user.id } },
      ],
    };
  }

  /**
   * Verifies if a user has permission to read a specific task.
   */
  private assertCanViewTask(
    task: {
      assigneeId: string | null;
      assignedById: string | null;
      assignee: { departmentId: string | null } | null;
      request: {
        requesterId: string;
        requester: { departmentId: string | null };
      } | null;
    },
    user: AuthenticatedUser
  ): void {
    if (user.role === Role.ADMIN) return;

    if (user.role === Role.MANAGER) {
      if (task.assigneeId === user.id || task.assignedById === user.id) return;
      if (
        user.departmentId &&
        (task.assignee?.departmentId === user.departmentId ||
          task.request?.requester.departmentId === user.departmentId)
      ) {
        return;
      }
    }

    if (user.role === Role.EMPLOYEE) {
      if (task.assigneeId === user.id || task.request?.requesterId === user.id) {
        return;
      }
    }

    throw AppError.forbidden("You do not have permission to view this task");
  }

  async createTask(
    user: AuthenticatedUser,
    data: Omit<CreateTaskData, "assignedById">
  ) {
    // Only managers and admins can assign tasks upon creation
    if (data.assigneeId && user.role === Role.EMPLOYEE) {
      throw AppError.forbidden("Only managers and admins can assign tasks");
    }

    const assignedById = data.assigneeId ? user.id : null;
    const task = await taskRepository.create({
      ...data,
      assignedById,
    });

    await auditService.log({
      actorId: user.id,
      action: "TASK_CREATED",
      entityType: "Task",
      entityId: task.id,
      metadata: {
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId,
        requestId: task.requestId,
      },
    });

    return task;
  }

  async getTasks(user: AuthenticatedUser, filters: TaskQueryFilters) {
    const visibilityWhere = this.buildVisibilityFilter(user);
    return taskRepository.findAll(filters, visibilityWhere);
  }

  async getTaskById(id: string, user: AuthenticatedUser) {
    const task = await taskRepository.findById(id);
    if (!task) {
      throw AppError.notFound("Task not found");
    }

    this.assertCanViewTask(task, user);
    return task;
  }

  async updateTask(id: string, user: AuthenticatedUser, data: UpdateTaskData) {
    const task = await taskRepository.findById(id);
    if (!task) {
      throw AppError.notFound("Task not found");
    }

    this.assertCanViewTask(task, user);

    // Enforce status transitions
    if (data.status && data.status !== task.status) {
      if (!canTransitionTask(task.status, data.status)) {
        throw AppError.conflict(
          `Illegal status transition from ${task.status} to ${data.status}`
        );
      }
    }

    const updated = await taskRepository.update(id, data);

    await auditService.log({
      actorId: user.id,
      action: "TASK_UPDATED",
      entityType: "Task",
      entityId: id,
      metadata: {
        previousStatus: task.status,
        newStatus: data.status ?? task.status,
        updatedFields: Object.keys(data),
      },
    });

    return updated;
  }

  /**
   * Assign a task. Only managers and admins are allowed.
   */
  async assignTask(id: string, user: AuthenticatedUser, assigneeId: string | null) {
    if (user.role === Role.EMPLOYEE) {
      throw AppError.forbidden("Only managers and admins can assign tasks");
    }

    const task = await taskRepository.findById(id);
    if (!task) {
      throw AppError.notFound("Task not found");
    }

    const previousAssigneeId = task.assigneeId;
    const updated = await taskRepository.assign(id, assigneeId, user.id);

    await auditService.log({
      actorId: user.id,
      action: "TASK_ASSIGNED",
      entityType: "Task",
      entityId: id,
      metadata: {
        previousAssigneeId,
        newAssigneeId: assigneeId,
        assignedById: user.id,
      },
    });

    return updated;
  }
}

export const taskService = new TaskService();
