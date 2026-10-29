import { z } from "zod";

const normalizeEntityType = (val: unknown) => {
  if (typeof val === "string") {
    const lower = val.trim().toLowerCase();
    if (lower === "workrequest" || lower === "request") return "request";
    if (lower === "task") return "task";
  }
  return val;
};

export const createCommentSchema = z.object({
  entityType: z.preprocess(
    normalizeEntityType,
    z.enum(["request", "task"], {
      message: "entityType must be 'request' or 'task'",
    })
  ),
  entityId: z.string().uuid("Invalid entity ID format"),
  body: z
    .string()
    .trim()
    .min(1, "Comment body cannot be empty")
    .max(5000, "Comment cannot exceed 5000 characters"),
});

export const getCommentsQuerySchema = z.object({
  entityType: z.preprocess(
    normalizeEntityType,
    z.enum(["request", "task"], {
      message: "entityType must be 'request' or 'task'",
    })
  ),
  entityId: z.string().uuid("Invalid entity ID format"),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type GetCommentsQuery = z.infer<typeof getCommentsQuerySchema>;
