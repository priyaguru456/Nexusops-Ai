import { z } from "zod";
import { AssetType, AssetStatus } from "@prisma/client";

export const assetIdParamSchema = z.object({
  id: z.string().min(1, "Asset ID is required"),
});

export const createAssetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Asset name must be at least 2 characters")
    .max(200, "Asset name cannot exceed 200 characters"),
  type: z.nativeEnum(AssetType, {
    message: "Type must be LAPTOP, MONITOR, PHONE, LICENSE, or ACCESSORY",
  }),
  serialNumber: z
    .string()
    .trim()
    .max(100, "Serial number cannot exceed 100 characters")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  status: z
    .nativeEnum(AssetStatus, {
      message: "Status must be AVAILABLE, ASSIGNED, IN_REPAIR, or RETIRED",
    })
    .optional()
    .default(AssetStatus.AVAILABLE)
    .refine((val) => val !== AssetStatus.ASSIGNED, {
      message: "Initial asset status cannot be ASSIGNED without an assignment record",
    }),
  purchaseDate: z.coerce.date().optional().nullable(),
  warrantyExpiresAt: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
});

export const updateAssetSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  type: z.nativeEnum(AssetType).optional(),
  serialNumber: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((val) => (val !== undefined && val !== null && val.length > 0 ? val : val === null ? null : undefined)),
  status: z
    .nativeEnum(AssetStatus)
    .optional()
    .refine((val) => val !== AssetStatus.ASSIGNED, {
      message: "Asset status cannot be changed to ASSIGNED directly; use the assign action instead",
    }),
  purchaseDate: z.coerce.date().optional().nullable(),
  warrantyExpiresAt: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
});

export const assignAssetSchema = z.object({
  userId: z.string().min(1, "Assignee User ID is required"),
  requestId: z.string().uuid("Invalid request ID format").optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const returnAssetSchema = z.object({
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const retireAssetSchema = z.object({
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const getAssetsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  type: z.nativeEnum(AssetType).optional(),
  status: z.nativeEnum(AssetStatus).optional(),
  warranty: z.enum(["all", "expired", "expiring_soon", "valid"]).optional().default("all"),
  requestId: z.string().optional(),
  sortBy: z.enum(["createdAt", "name", "type", "status", "warrantyExpiresAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type AssignAssetInput = z.infer<typeof assignAssetSchema>;
export type ReturnAssetInput = z.infer<typeof returnAssetSchema>;
export type RetireAssetInput = z.infer<typeof retireAssetSchema>;
export type GetAssetsQueryInput = z.infer<typeof getAssetsQuerySchema>;
