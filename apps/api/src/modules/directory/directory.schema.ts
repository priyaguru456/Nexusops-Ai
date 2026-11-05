import { z } from "zod";
import { Role } from "@prisma/client";

export const getDirectoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  search: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  role: z.nativeEnum(Role).optional(),
});

export const getOrgQuerySchema = z.object({
  departmentId: z.string().trim().optional(),
});

export const managerIdParamSchema = z.object({
  managerId: z.string().min(1, "Manager ID is required"),
});

export const userIdParamSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export type GetDirectoryQuery = z.infer<typeof getDirectoryQuerySchema>;
export type GetOrgQuery = z.infer<typeof getOrgQuerySchema>;
