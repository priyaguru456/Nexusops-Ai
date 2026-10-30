import path from "path";
import { Prisma, Role, DocVisibility, DocStatus, Document } from "@prisma/client";
import { AppError } from "../../lib/errors";
import { AuthenticatedUser } from "../../types/express";
import { storageService } from "../../lib/storage";
import { documentQueue } from "../../lib/queue";
import { documentRepository } from "./document.repository";
import { UploadDocumentMetadataInput, GetDocumentsQuery } from "./document.schema";
import { logger } from "../../lib/logger";

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
  doc: { visibility: DocVisibility; departmentId: string | null; uploadedById: string }
): boolean {
  if (user.role === Role.ADMIN) return true;
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
  if (user.role === Role.ADMIN) {
    return {};
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
    return { OR: conditions };
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
  return { OR: conditions };
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
      department: user.departmentId ? { connect: { id: user.departmentId } } : undefined,
      uploadedBy: { connect: { id: user.id } },
    });

    // 4. Enqueue BullMQ job and return immediately
    try {
      await documentQueue.add("process-document", { documentId: doc.id });
    } catch (queueErr) {
      logger.error({ queueErr, documentId: doc.id }, "Failed to enqueue document processing job");
    }

    return doc;
  },

  async list(query: GetDocumentsQuery, user: AuthenticatedUser) {
    const visibilityFilter = buildVisibilityFilter(user);

    const where: Prisma.DocumentWhereInput = {
      AND: [
        visibilityFilter,
        query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: "insensitive" } },
                { fileName: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {},
        query.category ? { category: query.category } : {},
        query.status ? { status: query.status } : {},
        query.visibility ? { visibility: query.visibility } : {},
      ],
    };

    const skip = (query.page - 1) * query.limit;
    const take = query.limit;
    const orderBy = { [query.sortBy]: query.sortOrder };

    const [documents, total] = await Promise.all([
      documentRepository.findMany(where, { skip, take, orderBy }),
      documentRepository.count(where),
    ]);

    return {
      documents,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
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

    return updated;
  },

  async delete(id: string, user: AuthenticatedUser) {
    const doc = await documentRepository.findById(id);
    if (!doc) {
      throw AppError.notFound("Document not found");
    }

    if (user.role !== Role.ADMIN) {
      throw AppError.forbidden("Only administrators can delete documents");
    }

    // Delete file from disk
    await storageService.delete(doc.filePath);

    // Delete document and chunks from database
    await documentRepository.delete(id);

    return { success: true };
  },
};
