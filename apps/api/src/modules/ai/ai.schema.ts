import { z } from "zod";

export const debugRetrieveSchema = z.object({
  question: z.string().trim().min(1, "Question is required"),
  topK: z.coerce.number().int().min(1).max(50).default(8),
  hybrid: z.boolean().default(true),
  asUserId: z.string().uuid("Invalid user ID format").optional(),
});

export type DebugRetrieveInput = z.infer<typeof debugRetrieveSchema>;

export const chatInputSchema = z.object({
  message: z.string().trim().min(1, "Message is required"),
  sessionId: z.string().uuid("Invalid session ID format").optional(),
});

export type ChatInput = z.infer<typeof chatInputSchema>;

export const feedbackInputSchema = z
  .object({
    feedback: z.number().int().min(-1).max(1).optional(),
    vote: z.enum(["up", "down"]).optional(),
  })
  .refine((data) => data.feedback !== undefined || data.vote !== undefined, {
    message: "Either feedback (1 or -1) or vote ('up' or 'down') must be provided",
  });

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

export const uuidParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});
