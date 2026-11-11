import { z } from "zod";

export const organizationIdParamSchema = z.object({
  id: z.string().uuid("Invalid organization ID"),
});

export const getOrganizationsQuerySchema = z.object({
  search: z.string().trim().optional(),
  isActive: z
    .preprocess((val) => {
      if (typeof val === "string") {
        if (val === "true") return true;
        if (val === "false") return false;
      }
      return val;
    }, z.boolean().optional()),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const createOrganizationSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
    adminName: z.string().trim().min(2).max(100).optional(),
    adminEmail: z.string().trim().email("Invalid admin email").optional(),
    adminPassword: z.string().min(8, "Password must be at least 8 characters").optional(),
  })
  .refine(
    (data) => {
      const hasAnyAdminField = Boolean(data.adminEmail || data.adminName || data.adminPassword);
      if (!hasAnyAdminField) return true;
      return Boolean(data.adminEmail && data.adminName && data.adminPassword);
    },
    {
      message: "adminName, adminEmail, and adminPassword must all be provided together",
      path: ["adminEmail"],
    }
  );

export const updateOrganizationSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type GetOrganizationsQuery = z.infer<typeof getOrganizationsQuerySchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
