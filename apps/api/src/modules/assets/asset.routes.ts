import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { assetController } from "./asset.controller";
import {
  createAssetSchema,
  updateAssetSchema,
  assignAssetSchema,
  returnAssetSchema,
  retireAssetSchema,
  getAssetsQuerySchema,
  assetIdParamSchema,
} from "./asset.schema";

export const assetRouter = Router();

// All asset routes require authentication
assetRouter.use(authenticate);

// List visible assets (scoped by role: Admin sees all, Employee/Manager see own)
assetRouter.get(
  "/",
  validate({ query: getAssetsQuerySchema }),
  (req, res, next) => assetController.list(req, res, next)
);

// Get current user's assigned assets (for "My Assigned Assets" tab)
assetRouter.get(
  "/my",
  (req, res, next) => assetController.getMyAssets(req, res, next)
);

// Get single asset details (with full assignment history; scoped by role)
assetRouter.get(
  "/:id",
  validate({ params: assetIdParamSchema }),
  (req, res, next) => assetController.getById(req, res, next)
);

// --- Admin & IT Staff Operations ---
// Create asset
assetRouter.post(
  "/",
  authorize(Role.ADMIN),
  validate({ body: createAssetSchema }),
  (req, res, next) => assetController.create(req, res, next)
);

// Update asset
assetRouter.patch(
  "/:id",
  authorize(Role.ADMIN),
  validate({ params: assetIdParamSchema, body: updateAssetSchema }),
  (req, res, next) => assetController.update(req, res, next)
);

assetRouter.put(
  "/:id",
  authorize(Role.ADMIN),
  validate({ params: assetIdParamSchema, body: updateAssetSchema }),
  (req, res, next) => assetController.update(req, res, next)
);

// Assign asset
assetRouter.post(
  "/:id/assign",
  authorize(Role.ADMIN),
  validate({ params: assetIdParamSchema, body: assignAssetSchema }),
  (req, res, next) => assetController.assign(req, res, next)
);

// Return asset
assetRouter.post(
  "/:id/return",
  authorize(Role.ADMIN),
  validate({ params: assetIdParamSchema, body: returnAssetSchema }),
  (req, res, next) => assetController.returnAsset(req, res, next)
);

// Retire asset
assetRouter.post(
  "/:id/retire",
  authorize(Role.ADMIN),
  validate({ params: assetIdParamSchema, body: retireAssetSchema }),
  (req, res, next) => assetController.retire(req, res, next)
);
