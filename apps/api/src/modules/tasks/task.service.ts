import { Role, Prisma, TaskStatus } from "@prisma/client";
import {
  taskRepository,
  type CreateTaskData,
  type UpdateTaskData,
  type TaskQueryFilters,
} from "./task.repository";
import { canTransitionTask } from "./task.state-machine";
import { auditService } from "../audit/audit.service";
import { notificationService } from "../notifications/notification.service";
import { AppError } from "../../lib/errors";
import {
  assertSameTenant,
  isAdminRole,
  resolveTenantId,
  tenantWhere,
} from "../../lib/tenant";
import type { AuthenticatedUser } from "../../types/express";

export class TaskService {
  /**
   * Builds the visibility query based on RBAC rules:
   * - Employees see only their own tasks within their organization
   * - Managers see own + their department's tasks within their organization
   * - Admins see all within their organization
   */
  private buildVisibilityFilter(user: AuthenticatedUser): Prisma.TaskWhereInput {
    const scope = tenantWhere(user);

    if (isAdminRole(user)) {
      return scope;
    }

    if (user.role === Role.MANAGER) {
      if (user.departmentId) {
        return {
          ...scope,
          OR: [
            { assigneeId: user.id },
            { assignedById: user.id },
            { assignee: { departmentId: user.departmentId } },
            { request: { requester: { departmentId: user.departmentId } } },
          ],
        };
      }
      return {
        ...scope,
        OR: [{ assigneeId: user.id }, { assignedById: user.id }],
      };
    }

    // Role.EMPLOYEE
    return {
      ...scope,
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
      organizationId?: string;
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
    assertSameTenant(task.organizationId, user, "Task not found");

    if (isAdminRole(user)) return;

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
    data: Omit<CreateTaskData, "assignedById" | "organizationId">
  ) {
    // Only managers and admins can assign tasks upon creation
    if (data.assigneeId && user.role === Role.EMPLOYEE) {
      throw AppError.forbidden("Only managers and admins can assign tasks");
    }

    const organizationId = resolveTenantId(user);
    const assignedById = data.assigneeId ? user.id : null;
    const task = await taskRepository.create({
      ...data,
      assignedById,
      organizationId,
    });

    await auditService.log({
      actorId: user.id,
      organizationId,
      action: "TASK_CREATED",
      entityType: "Task",
      entityId: task.id,
      summary: `Created task "${task.title}"`,
      metadata: {
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId,
        requestId: task.requestId,
      },
    });

    if (task.assigneeId && task.assigneeId !== user.id) {
      await notificationService.notify({
        userId: task.assigneeId,
        type: "TASK_ASSIGNED",
        title: "Task Assigned",
        message: `You were assigned to task "${task.title}"`,
        link: "/tasks",
        entityType: "Task",
        entityId: task.id,
      });
    }

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
      if (data.status === TaskStatus.DONE && !data.completedAt) {
        data.completedAt = new Date();
      }
    }

    const updated = await taskRepository.update(id, data);

    await auditService.log({
      actorId: user.id,
      organizationId: task.organizationId,
      action: "TASK_UPDATED",
      entityType: "Task",
      entityId: id,
      summary: `Updated task "${updated.title}"`,
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

    assertSameTenant(task.organizationId, user, "Task not found");

    const previousAssigneeId = task.assigneeId;
    const updated = await taskRepository.assign(id, assigneeId, user.id);

    await auditService.log({
      actorId: user.id,
      organizationId: task.organizationId,
      action: "TASK_ASSIGNED",
      entityType: "Task",
      entityId: id,
      summary: `Assigned task "${task.title}" to ${assigneeId ? "user" : "unassigned"}`,
      metadata: {
        previousAssigneeId,
        newAssigneeId: assigneeId,
        assignedById: user.id,
      },
    });

    if (assigneeId && assigneeId !== user.id) {
      await notificationService.notify({
        userId: assigneeId,
        type: "TASK_ASSIGNED",
        title: "Task Assigned",
        message: `You were assigned to task "${task.title}"`,
        link: "/tasks",
        entityType: "Task",
        entityId: id,
      });
    }

    return updated;
  }

  /**
   * Delete a task. Only creator, manager, or admin can delete.
   */
  async deleteTask(id: string, user: AuthenticatedUser) {
    const task = await taskRepository.findById(id);
    if (!task) {
      throw AppError.notFound("Task not found");
    }

    assertSameTenant(task.organizationId, user, "Task not found");

    const isCreator = task.assignedById === user.id;
    const isManagerOrAdmin = user.role === Role.MANAGER || isAdminRole(user);
    if (!isCreator && !isManagerOrAdmin) {
      throw AppError.forbidden("You do not have permission to delete this task");
    }

    await taskRepository.delete(id);

    await auditService.log({
      actorId: user.id,
      organizationId: task.organizationId,
      action: "TASK_DELETED",
      entityType: "Task",
      entityId: id,
      summary: `Deleted task "${task.title}"`,
      metadata: {
        title: task.title,
        status: task.status,
        assigneeId: task.assigneeId,
      },
    });

    return { success: true };
  }
}

export const taskService = new TaskService();
