import { z } from "zod";
import { RequestStatus, Priority, RequestCategory } from "@prisma/client";

export const requestIdParamSchema = z.object({
  id: z.string().uuid("Invalid request ID format"),
});

export const createRequestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title cannot exceed 200 characters"),
  description: z
    .string()
    .trim()
    .min(5, "Description must be at least 5 characters")
    .max(5000, "Description cannot exceed 5000 characters"),
  category: z.nativeEnum(RequestCategory, {
    message: "Category must be IT, HR, FINANCE, FACILITIES, or OTHER",
  }),
  priority: z
    .nativeEnum(Priority, {
      message: "Priority must be LOW, MEDIUM, HIGH, or URGENT",
    })
    .optional()
    .default(Priority.MEDIUM),
  amount: z.coerce.number().positive("Amount must be positive").optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
});

export const updateRequestSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(5).max(5000).optional(),
  category: z.nativeEnum(RequestCategory).optional(),
  priority: z.nativeEnum(Priority).optional(),
  amount: z.coerce.number().positive().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
});

export const updateRequestStatusSchema = z.object({
  status: z.nativeEnum(RequestStatus, {
    message: "Invalid request status",
  }),
  comment: z.string().trim().max(1000).optional(),
});

export const getRequestsQuerySchema = z.object({
  status: z.nativeEnum(RequestStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  category: z.nativeEnum(RequestCategory).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["createdAt", "updatedAt", "title", "priority", "status", "dueDate", "amount"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;
export type UpdateRequestStatusInput = z.infer<typeof updateRequestStatusSchema>;
export type GetRequestsQuery = z.infer<typeof getRequestsQuerySchema>;
