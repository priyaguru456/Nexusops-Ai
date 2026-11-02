import { z } from "zod";

export const searchQuerySchema = z.object({
  q: z
    .string({ message: "Search query 'q' is required" })
    .trim()
    .min(2, "Search query must be at least 2 characters")
    .max(100, "Search query is too long"),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
