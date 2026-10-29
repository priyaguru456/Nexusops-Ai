import { z } from "zod";
import { Role } from "@prisma/client";

export const userIdParamSchema = z.object({
  id: z.string().uuid("Invalid user ID format"),
});

export const updateRoleSchema = z.object({
  role: z.nativeEnum(Role, {
    message: "Role must be one of EMPLOYEE, MANAGER, ADMIN",
  }),
});

export const updateStatusSchema = z.object({
  isActive: z.boolean({
    message: "isActive is required and must be a boolean",
  }),
});

export const getUsersQuerySchema = z.object({
  skip: z.coerce.number().min(0).optional(),
  take: z.coerce.number().min(1).max(100).optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z
    .preprocess((val) => {
      if (typeof val === "string") {
        if (val === "true") return true;
        if (val === "false") return false;
      }
      return val;
    }, z.boolean().optional()),
  search: z.string().trim().optional(),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>;
