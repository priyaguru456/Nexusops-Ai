import { Router } from "express";
import multer from "multer";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { documentController } from "./document.controller";
import {
  documentIdParamSchema,
  uploadDocumentMetadataSchema,
  getDocumentsQuerySchema,
} from "./document.schema";
import { env } from "../../config/env";

export const documentRouter = Router();

// Multer memory storage for validating & passing buffer to storage abstraction
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (env.MAX_UPLOAD_MB || 20) * 1024 * 1024,
  },
});

/**
 * POST /api/documents
 * Multipart upload (PDF, DOCX, TXT, MD; max 20 MB; Admin only)
 */
documentRouter.post(
  "/",
  authenticate,
  authorize(Role.ADMIN),
  upload.single("file"),
  validate({ body: uploadDocumentMetadataSchema }),
  documentController.upload
);

/**
 * GET /api/documents
 * List documents filtered by what the authenticated user may see
 */
documentRouter.get(
  "/",
  authenticate,
  validate({ query: getDocumentsQuerySchema }),
  documentController.list
);

/**
 * GET /api/documents/:id
 * Get single document details (permission checked)
 */
documentRouter.get(
  "/:id",
  authenticate,
  validate({ params: documentIdParamSchema }),
  documentController.getById
);

/**
 * GET /api/documents/:id/file
 * Download document file stream (enforces same visibility rules as list route)
 */
documentRouter.get(
  "/:id/file",
  authenticate,
  validate({ params: documentIdParamSchema }),
  documentController.getFile
);

/**
 * POST /api/documents/:id/reprocess
 * Clears existing chunks and re-triggers ingestion pipeline
 */
documentRouter.post(
  "/:id/reprocess",
  authenticate,
  authorize(Role.ADMIN, Role.MANAGER),
  validate({ params: documentIdParamSchema }),
  documentController.reprocess
);

/**
 * DELETE /api/documents/:id
 * Admin only: deletes document record, chunks, and stored file from disk
 */
documentRouter.delete(
  "/:id",
  authenticate,
  authorize(Role.ADMIN),
  validate({ params: documentIdParamSchema }),
  documentController.delete
);
