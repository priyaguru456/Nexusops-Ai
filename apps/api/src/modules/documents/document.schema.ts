import { z } from "zod";
import { DocVisibility, DocStatus } from "@prisma/client";

export const documentIdParamSchema = z.object({
  id: z.string().uuid("Invalid document ID format"),
});

export const uploadDocumentMetadataSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title must be at least 1 character")
    .max(255, "Title cannot exceed 255 characters")
    .optional(),
  category: z
    .string()
    .trim()
    .max(100, "Category cannot exceed 100 characters")
    .optional()
    .nullable(),
  visibility: z
    .nativeEnum(DocVisibility, {
      message: "Visibility must be ALL, DEPARTMENT, MANAGERS, or ADMIN_ONLY",
    })
    .default(DocVisibility.ALL),
  version: z.coerce.number().int().min(1, "Version must be at least 1").default(1),
});

export const getDocumentsQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  status: z.nativeEnum(DocStatus).optional(),
  visibility: z.nativeEnum(DocVisibility).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "title", "status", "sizeBytes", "version"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type UploadDocumentMetadataInput = z.infer<typeof uploadDocumentMetadataSchema>;
export type GetDocumentsQuery = z.infer<typeof getDocumentsQuerySchema>;
