import { z } from "zod";
import { TaskStatus, Priority } from "@prisma/client";

export const taskIdParamSchema = z.object({
  id: z.string().uuid("Invalid task ID format"),
});

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title cannot exceed 200 characters"),
  description: z.string().trim().max(5000).optional().nullable(),
  priority: z
    .nativeEnum(Priority, {
      message: "Priority must be LOW, MEDIUM, HIGH, or URGENT",
    })
    .optional()
    .default(Priority.MEDIUM),
  status: z
    .nativeEnum(TaskStatus, {
      message: "Invalid task status",
    })
    .optional()
    .default(TaskStatus.TODO),
  dueDate: z.coerce.date().optional().nullable(),
  requestId: z.string().uuid("Invalid request ID").optional().nullable(),
  assigneeId: z.string().uuid("Invalid assignee ID").optional().nullable(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  priority: z.nativeEnum(Priority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  dueDate: z.coerce.date().optional().nullable(),
});

export const assignTaskSchema = z.object({
  assigneeId: z.string().uuid("Invalid assignee ID").nullable(),
});

export const getTasksQuerySchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  assigneeId: z.string().uuid().optional(),
  requestId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["createdAt", "updatedAt", "title", "priority", "status", "dueDate"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;
export type GetTasksQuery = z.infer<typeof getTasksQuerySchema>;
