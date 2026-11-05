import { z } from "zod";

export const announcementPriorityEnum = z.enum(["NORMAL", "URGENT"]);

export const createAnnouncementSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters"),
  content: z
    .string()
    .trim()
    .min(1, "Content is required")
    .max(20000, "Content must be at most 20,000 characters"),
  priority: announcementPriorityEnum.default("NORMAL"),
  targetDepartmentId: z.string().uuid("Invalid department ID").nullable().optional(),
  isPinned: z.boolean().default(false),
  expiresAt: z
    .string()
    .nullable()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const d = new Date(val);
      return !isNaN(d.getTime());
    }, "Invalid expiration date"),
});

export const updateAnnouncementSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(200, "Title must be at most 200 characters")
    .optional(),
  content: z
    .string()
    .trim()
    .min(1, "Content cannot be empty")
    .max(20000, "Content must be at most 20,000 characters")
    .optional(),
  priority: announcementPriorityEnum.optional(),
  targetDepartmentId: z.string().uuid("Invalid department ID").nullable().optional(),
  isPinned: z.boolean().optional(),
  expiresAt: z
    .string()
    .nullable()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const d = new Date(val);
      return !isNaN(d.getTime());
    }, "Invalid expiration date"),
});

export const announcementQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  unreadOnly: z
    .union([z.boolean(), z.enum(["true", "false"]).transform((val) => val === "true")])
    .optional(),
  priority: announcementPriorityEnum.optional(),
  pinnedOnly: z
    .union([z.boolean(), z.enum(["true", "false"]).transform((val) => val === "true")])
    .optional(),
});

export const announcementIdParamSchema = z.object({
  id: z.string().uuid("Invalid announcement ID"),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type AnnouncementQueryInput = z.infer<typeof announcementQuerySchema>;
