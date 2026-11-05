import { Router } from "express";
import multer from "multer";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { policyController } from "./policy.controller";
import {
  policyIdParamSchema,
  createPolicyMetadataSchema,
  uploadPolicyVersionMetadataSchema,
  listPoliciesQuerySchema,
  acknowledgePolicySchema,
  complianceSummaryQuerySchema,
} from "./policy.schema";
import { env } from "../../config/env";

export const policyRouter = Router();

// Multer memory storage with 20MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (env.MAX_UPLOAD_MB || 20) * 1024 * 1024,
  },
});

/**
 * GET /api/policies/my-status
 * Current authenticated user's compliance overview and policy statuses
 */
policyRouter.get(
  "/my-status",
  authenticate,
  policyController.getMyStatus
);

/**
 * GET /api/policies/compliance/summary
 * Compliance summary per policy and department (Admin and Manager only)
 */
policyRouter.get(
  "/compliance/summary",
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER),
  validate({ query: complianceSummaryQuerySchema }),
  policyController.getComplianceSummary
);

/**
 * GET /api/policies/compliance/export
 * CSV export of compliance status per policy and user (Admin and Manager only)
 */
policyRouter.get(
  "/compliance/export",
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER),
  validate({ query: complianceSummaryQuerySchema }),
  policyController.exportComplianceCsv
);

/**
 * GET /api/policies
 * List policies with search, filters, pagination, and current user acknowledgement status
 */
policyRouter.get(
  "/",
  authenticate,
  validate({ query: listPoliciesQuerySchema }),
  policyController.list
);

/**
 * POST /api/policies
 * Create and upload a new policy (Admin only)
 */
policyRouter.post(
  "/",
  authenticate,
  authorize(Role.ADMIN),
  upload.single("file"),
  validate({ body: createPolicyMetadataSchema }),
  policyController.create
);

/**
 * GET /api/policies/:id
 * Get single policy details and my acknowledgement status
 */
policyRouter.get(
  "/:id",
  authenticate,
  validate({ params: policyIdParamSchema }),
  policyController.getById
);

/**
 * POST /api/policies/:id/versions
 * Upload a new version of an existing policy (Admin only)
 * Resets user acknowledgements while preserving old records for history,
 * removes old chunks, and re-embeds latest version.
 */
policyRouter.post(
  "/:id/versions",
  authenticate,
  authorize(Role.ADMIN),
  upload.single("file"),
  validate({ params: policyIdParamSchema, body: uploadPolicyVersionMetadataSchema }),
  policyController.uploadNewVersion
);

/**
 * POST /api/policies/:id/acknowledge
 * Acknowledge policy (current version only)
 */
policyRouter.post(
  "/:id/acknowledge",
  authenticate,
  validate({ params: policyIdParamSchema, body: acknowledgePolicySchema }),
  policyController.acknowledge
);
