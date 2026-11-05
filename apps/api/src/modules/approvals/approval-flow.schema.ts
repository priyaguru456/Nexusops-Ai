import { z } from "zod";
import { RequestCategory, Role } from "@prisma/client";

export const approvalFlowStepInputSchema = z
  .object({
    stepOrder: z.coerce.number().int().positive("stepOrder must be a positive integer"),
    approverRole: z.nativeEnum(Role).optional().nullable(),
    approverId: z.string().uuid("approverId must be a valid UUID").optional().nullable(),
  })
  .refine(
    (data) => Boolean(data.approverRole || data.approverId),
    { message: "Each step must specify either approverRole or approverId" }
  );

export const createApprovalFlowSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Flow name is required")
      .max(100, "Flow name cannot exceed 100 characters"),
    category: z.nativeEnum(RequestCategory, {
      message: "Category must be IT, HR, FINANCE, FACILITIES, or OTHER",
    }),
    minAmount: z.coerce.number().min(0, "minAmount must be greater than or equal to 0").default(0),
    maxAmount: z.coerce.number().min(0, "maxAmount must be greater than or equal to 0").optional().nullable(),
    isActive: z.boolean().optional().default(true),
    steps: z.array(approvalFlowStepInputSchema).min(1, "At least one approval step is required"),
  })
  .refine(
    (data) => {
      if (data.maxAmount !== null && data.maxAmount !== undefined) {
        return data.maxAmount >= data.minAmount;
      }
      return true;
    },
    {
      message: "maxAmount must be greater than or equal to minAmount",
      path: ["maxAmount"],
    }
  )
  .refine(
    (data) => {
      const orders = data.steps.map((s) => s.stepOrder);
      return new Set(orders).size === orders.length;
    },
    {
      message: "Approval steps must not have duplicate stepOrder values",
      path: ["steps"],
    }
  );

export const updateApprovalFlowSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    category: z.nativeEnum(RequestCategory).optional(),
    minAmount: z.coerce.number().min(0).optional(),
    maxAmount: z.coerce.number().min(0).optional().nullable(),
    isActive: z.boolean().optional(),
    steps: z.array(approvalFlowStepInputSchema).min(1, "At least one approval step is required").optional(),
  })
  .refine(
    (data) => {
      if (data.minAmount !== undefined && data.maxAmount !== undefined && data.maxAmount !== null) {
        return data.maxAmount >= data.minAmount;
      }
      return true;
    },
    {
      message: "maxAmount must be greater than or equal to minAmount",
      path: ["maxAmount"],
    }
  )
  .refine(
    (data) => {
      if (data.steps) {
        const orders = data.steps.map((s) => s.stepOrder);
        return new Set(orders).size === orders.length;
      }
      return true;
    },
    {
      message: "Approval steps must not have duplicate stepOrder values",
      path: ["steps"],
    }
  );

export const flowIdParamSchema = z.object({
  id: z.string().uuid("Invalid approval flow ID format"),
});

export const flowQuerySchema = z.object({
  category: z.nativeEnum(RequestCategory).optional(),
  isActive: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((val) => (typeof val === "boolean" ? val : val === "true"))
    .optional(),
});

export type CreateApprovalFlowInput = z.infer<typeof createApprovalFlowSchema>;
export type UpdateApprovalFlowInput = z.infer<typeof updateApprovalFlowSchema>;
export type ApprovalFlowStepInput = z.infer<typeof approvalFlowStepInputSchema>;
export type FlowQueryParams = z.infer<typeof flowQuerySchema>;
