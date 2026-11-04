import { z } from "zod";

export const stepIdParamSchema = z.object({
  stepId: z.string().uuid("Invalid approval step ID format"),
});

export const approveStepSchema = z.object({
  comment: z.string().trim().max(1000).optional(),
});

export const rejectStepSchema = z.object({
  comment: z
    .string()
    .trim()
    .min(1, "Comment is required when rejecting a request")
    .max(1000, "Comment cannot exceed 1000 characters"),
});

export const reassignStepSchema = z.object({
  approverId: z.string().uuid("Invalid approver user ID format"),
});

export const bulkApproveSchema = z.object({
  stepIds: z
    .array(z.string().uuid("Invalid approval step ID format"))
    .min(1, "At least one approval step ID is required"),
  comment: z.string().trim().max(1000).optional(),
});

export type ApproveStepInput = z.infer<typeof approveStepSchema>;
export type RejectStepInput = z.infer<typeof rejectStepSchema>;
export type ReassignStepInput = z.infer<typeof reassignStepSchema>;
export type BulkApproveInput = z.infer<typeof bulkApproveSchema>;
