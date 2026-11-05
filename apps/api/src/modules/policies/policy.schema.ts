import { z } from "zod";
import { DocVisibility } from "@prisma/client";

export const PolicyCategoryEnum = z.enum(["HR", "SECURITY", "TRAVEL", "OTHER"], {
  message: "Category must be one of: HR, SECURITY, TRAVEL, OTHER",
});
export type PolicyCategory = z.infer<typeof PolicyCategoryEnum>;

export const policyIdParamSchema = z.object({
  id: z.string().uuid("Invalid policy ID format"),
});

export const createPolicyMetadataSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title must be at least 1 character")
    .max(255, "Title cannot exceed 255 characters"),
  category: PolicyCategoryEnum,
  isMandatory: z
    .preprocess((val) => {
      if (typeof val === "string") return val.toLowerCase() === "true" || val === "1";
      return Boolean(val);
    }, z.boolean())
    .default(false),
  targetDepartmentId: z.string().uuid("Invalid target department ID").optional().nullable(),
  visibility: z
    .nativeEnum(DocVisibility, {
      message: "Visibility must be ALL, DEPARTMENT, MANAGERS, or ADMIN_ONLY",
    })
    .default(DocVisibility.ALL),
});

export const uploadPolicyVersionMetadataSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  category: PolicyCategoryEnum.optional(),
  isMandatory: z
    .preprocess((val) => {
      if (typeof val === "string") return val.toLowerCase() === "true" || val === "1";
      if (val === undefined) return undefined;
      return Boolean(val);
    }, z.boolean().optional())
    .optional(),
  targetDepartmentId: z.string().uuid("Invalid target department ID").optional().nullable(),
  visibility: z.nativeEnum(DocVisibility).optional(),
});

export const listPoliciesQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: PolicyCategoryEnum.optional(),
  isMandatory: z
    .preprocess((val) => {
      if (val === "true" || val === true || val === "1") return true;
      if (val === "false" || val === false || val === "0") return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
  targetDepartmentId: z.string().uuid().optional(),
  acknowledged: z
    .preprocess((val) => {
      if (val === "true" || val === true || val === "1") return true;
      if (val === "false" || val === false || val === "0") return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "title", "version", "category"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const acknowledgePolicySchema = z.object({
  version: z.coerce.number().int().min(1).optional(),
});

export const complianceSummaryQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  policyId: z.string().uuid().optional(),
});

export type CreatePolicyMetadataInput = z.infer<typeof createPolicyMetadataSchema>;
export type UploadPolicyVersionMetadataInput = z.infer<typeof uploadPolicyVersionMetadataSchema>;
export type ListPoliciesQuery = z.infer<typeof listPoliciesQuerySchema>;
export type AcknowledgePolicyInput = z.infer<typeof acknowledgePolicySchema>;
export type ComplianceSummaryQuery = z.infer<typeof complianceSummaryQuerySchema>;
