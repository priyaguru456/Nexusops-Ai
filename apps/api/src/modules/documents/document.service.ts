import path from "path";
import { Prisma, Role, DocVisibility, DocStatus, Document } from "@prisma/client";
import { AppError } from "../../lib/errors";
import { AuthenticatedUser } from "../../types/express";
import { storageService } from "../../lib/storage";
import { documentQueue } from "../../lib/queue";
import { documentRepository } from "./document.repository";
import { UploadDocumentMetadataInput, GetDocumentsQuery } from "./document.schema";
import { logger } from "../../lib/logger";
import { auditService } from "../audit/audit.service";
import {
  assertSameTenant,
  isAdminRole,
  isSuperAdmin,
  resolveTenantId,
  tenantWhere,
} from "../../lib/tenant";

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".doc", ".txt", ".md"]);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  // Some browsers/OSes report DOCX or MD as application/octet-stream or application/zip
  "application/octet-stream",
  "application/zip",
]);

export function validateMimeAndExtension(originalName: string, mimeType: string): string {
  const ext = path.extname(originalName).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw AppError.badRequest(
      `Invalid file extension "${ext}". Allowed extensions: .pdf, .docx, .doc, .txt, .md`
    );
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw AppError.badRequest(
      `Invalid MIME type "${mimeType}". Allowed document formats: PDF, DOCX, TXT, Markdown.`
    );
  }

  // Cross-verify extension matches reasonable MIME family
  if (ext === ".pdf" && mimeType !== "application/pdf") {
    throw AppError.badRequest(
      `MIME type "${mimeType}" does not match file extension "${ext}".`
    );
  }

  return ext;
}

export function canUserAccessDocument(
  user: AuthenticatedUser,
  doc: {
    organizationId?: string;
    visibility: DocVisibility;
    departmentId: string | null;
    uploadedById: string;
  }
): boolean {
  if (
    !isSuperAdmin(user) &&
    user.organizationId !== undefined &&
    doc.organizationId !== undefined &&
    doc.organizationId !== user.organizationId
  ) {
    return false;
  }

  if (isAdminRole(user)) return true;
  if (doc.uploadedById === user.id) return true;
  if (doc.visibility === DocVisibility.ALL) return true;
  if (doc.visibility === DocVisibility.MANAGERS && user.role === Role.MANAGER) return true;
  if (
    doc.visibility === DocVisibility.DEPARTMENT &&
    doc.departmentId &&
    user.departmentId === doc.departmentId
  ) {
    return true;
  }
  return false;
}

export function buildVisibilityFilter(user: AuthenticatedUser): Prisma.DocumentWhereInput {
  const scope = tenantWhere(user);

  if (isAdminRole(user)) {
    return scope;
  }

  if (user.role === Role.MANAGER) {
    const conditions: Prisma.DocumentWhereInput[] = [
      { visibility: DocVisibility.ALL },
      { visibility: DocVisibility.MANAGERS },
      { uploadedById: user.id },
    ];
    if (user.departmentId) {
      conditions.push({
        visibility: DocVisibility.DEPARTMENT,
        departmentId: user.departmentId,
      });
    }
    return { ...scope, OR: conditions };
  }

  // Role.EMPLOYEE
  const conditions: Prisma.DocumentWhereInput[] = [
    { visibility: DocVisibility.ALL },
    { uploadedById: user.id },
  ];
  if (user.departmentId) {
    conditions.push({
      visibility: DocVisibility.DEPARTMENT,
      departmentId: user.departmentId,
    });
  }
  return { ...scope, OR: conditions };
}

export const documentService = {
  async upload(
    file: Express.Multer.File,
    metadata: UploadDocumentMetadataInput,
    user: AuthenticatedUser
  ): Promise<Document> {
    if (!file) {
      throw AppError.badRequest("File is required");
    }

    // 1. Strict validation of MIME and extension
    validateMimeAndExtension(file.originalname, file.mimetype);

    // 2. Persist to storage abstraction (UUID filename, stored outside src)
    const stored = await storageService.save(file.buffer, file.originalname);

    const title =
      metadata.title ||
      path.basename(file.originalname, path.extname(file.originalname));

    const organizationId = resolveTenantId(user);

    // 3. Create document record in database
    const doc = await documentRepository.create({
      title,
      fileName: file.originalname,
      filePath: stored.relativePath,
      mimeType: file.mimetype,
      sizeBytes: stored.sizeBytes,
      category: metadata.category || null,
      visibility: metadata.visibility || DocVisibility.ALL,
      version: metadata.version || 1,
      status: DocStatus.UPLOADED,
      organization: { connect: { id: organizationId } },
      department: user.departmentId ? { connect: { id: user.departmentId } } : undefined,
      uploadedBy: { connect: { id: user.id } },
    });

    // 4. Enqueue BullMQ job and return immediately
    try {
      await documentQueue.add("process-document", { documentId: doc.id });
    } catch (queueErr) {
      logger.error({ queueErr, documentId: doc.id }, "Failed to enqueue document processing job");
    }

    // 5. Record audit entry for document upload
    await auditService.log({
      actorId: user.id,
      organizationId,
      action: "DOCUMENT_UPLOADED",
      entityType: "Document",
      entityId: doc.id,
      summary: `Uploaded document "${doc.title}"`,
      metadata: {
        title: doc.title,
        fileName: doc.fileName,
        sizeBytes: doc.sizeBytes,
        mimeType: doc.mimeType,
        category: doc.category,
        visibility: doc.visibility,
      },
    });

    return doc;
  },

  async list(query: GetDocumentsQuery, user: AuthenticatedUser) {
    const visibilityFilter = buildVisibilityFilter(user);

    const conditions: Prisma.DocumentWhereInput[] = [];

    if (Object.keys(visibilityFilter).length > 0) {
      conditions.push(visibilityFilter);
    }

    if (query.search?.trim()) {
      conditions.push({
        OR: [
          { title: { contains: query.search.trim(), mode: "insensitive" } },
          { fileName: { contains: query.search.trim(), mode: "insensitive" } },
        ],
      });
    }

    if (query.category?.trim()) {
      conditions.push({ category: query.category.trim() });
    }

    if (query.status) {
      conditions.push({ status: query.status });
    }

    if (query.visibility) {
      conditions.push({ visibility: query.visibility });
    }

    const where: Prisma.DocumentWhereInput = conditions.length > 0 ? { AND: conditions } : {};

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    const take = limit;

    const allowedSortFields = ["createdAt", "title", "status", "sizeBytes", "version"] as const;
    const sortBy = allowedSortFields.includes(query.sortBy as any) ? query.sortBy : "createdAt";
    const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";
    const orderBy = { [sortBy]: sortOrder };

    const [documents, total] = await Promise.all([
      documentRepository.findMany(where, { skip, take, orderBy }),
      documentRepository.count(where),
    ]);

    return {
      documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  },

  async getById(id: string, user: AuthenticatedUser) {
    const doc = await documentRepository.findById(id);
    if (!doc) {
      throw AppError.notFound("Document not found");
    }

    if (!canUserAccessDocument(user, doc)) {
      throw AppError.forbidden("You do not have permission to access this document");
    }

    return doc;
  },

  async getFile(id: string, user: AuthenticatedUser) {
    const doc = await documentRepository.findById(id);
    if (!doc) {
      throw AppError.notFound("Document not found");
    }

    // Download route checks the EXACT same visibility rules as list route
    if (!canUserAccessDocument(user, doc)) {
      throw AppError.forbidden("You do not have permission to download this document");
    }

    const stream = await storageService.getStream(doc.filePath);
    return {
      stream,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
    };
  },

  async reprocess(id: string, user: AuthenticatedUser) {
    const doc = await documentRepository.findById(id);
    if (!doc) {
      throw AppError.notFound("Document not found");
    }

    assertSameTenant(doc.organizationId, user, "Document not found");

    if (!canUserAccessDocument(user, doc)) {
      throw AppError.forbidden("You do not have permission to reprocess this document");
    }

    // Delete existing chunks first to prevent duplicates
    await documentRepository.deleteChunks(id);

    // Reset status to UPLOADED and clear error message
    const updated = await documentRepository.update(id, {
      status: DocStatus.UPLOADED,
      errorMessage: null,
    });

    // Enqueue BullMQ job
    try {
      await documentQueue.add("process-document", { documentId: id });
    } catch (queueErr) {
      logger.error({ queueErr, documentId: id }, "Failed to enqueue reprocess job");
    }

    // Record audit log for important state change
    await auditService.log({
      actorId: user.id,
      organizationId: doc.organizationId,
      action: "DOCUMENT_RETRY_EMBEDDING",
      entityType: "Document",
      entityId: id,
      metadata: {
        title: doc.title,
        previousStatus: doc.status,
      },
    });

    return updated;
  },

  async delete(id: string, user: AuthenticatedUser) {
    const doc = await documentRepository.findById(id);
    if (!doc) {
      throw AppError.notFound("Document not found");
    }

    assertSameTenant(doc.organizationId, user, "Document not found");

    if (!isAdminRole(user)) {
      throw AppError.forbidden("Only administrators can delete documents");
    }

    // Delete file from disk
    await storageService.delete(doc.filePath);

    // Delete document and chunks from database
    await documentRepository.delete(id);

    // Record audit entry for document deletion
    await auditService.log({
      actorId: user.id,
      organizationId: doc.organizationId,
      action: "DOCUMENT_DELETED",
      entityType: "Document",
      entityId: id,
      summary: `Deleted document "${doc.title}"`,
      metadata: {
        title: doc.title,
        fileName: doc.fileName,
      },
    });

    return { success: true };
  },

  async uploadNewVersion(
    id: string,
    file: Express.Multer.File,
    metadata: { title?: string },
    user: AuthenticatedUser
  ): Promise<Document> {
    const doc = await documentRepository.findById(id);
    if (!doc) {
      throw AppError.notFound("Document not found");
    }

    assertSameTenant(doc.organizationId, user, "Document not found");

    if (!isAdminRole(user)) {
      throw AppError.forbidden("Only administrators can upload a new version of a document");
    }

    validateMimeAndExtension(file.originalname, file.mimetype);
    const stored = await storageService.save(file.buffer, file.originalname);

    const oldVersion = doc.version;
    const newVersion = oldVersion + 1;

    // Delete existing chunks to ensure old chunks do not stay in index
    await documentRepository.deleteChunks(id);

    const updated = await documentRepository.update(id, {
      version: newVersion,
      fileName: file.originalname,
      filePath: stored.relativePath,
      mimeType: file.mimetype,
      sizeBytes: stored.sizeBytes,
      title: metadata.title || doc.title,
      status: DocStatus.UPLOADED,
      errorMessage: null,
    });

    try {
      await documentQueue.add("process-document", { documentId: id });
    } catch (queueErr) {
      logger.error({ queueErr, documentId: id }, "Failed to enqueue document re-processing job");
    }

    await auditService.log({
      actorId: user.id,
      action: "DOCUMENT_NEW_VERSION_UPLOADED",
      entityType: "Document",
      entityId: id,
      summary: `Uploaded version ${newVersion} for document "${updated.title}"`,
      metadata: {
        title: updated.title,
        oldVersion,
        newVersion,
        fileName: file.originalname,
      },
    });

    return updated;
  },
};
