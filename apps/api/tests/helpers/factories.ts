import bcrypt from "bcryptjs";
import {
  Role,
  RequestStatus,
  Priority,
  RequestCategory,
  DocVisibility,
  DocStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { signAccessToken } from "../../src/lib/jwt";
import { formatVectorForPg, EMBEDDING_DIMENSION } from "../../src/lib/embeddings";

export const DEFAULT_PASSWORD = "Password123!";
export const DEFAULT_PASSWORD_HASH = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

export const FIXED_FAKE_VECTOR = new Array(EMBEDDING_DIMENSION).fill(0.025);
export const FIXED_FAKE_VECTOR_PG = formatVectorForPg(FIXED_FAKE_VECTOR);

let counter = 1;

export async function createDepartment(name?: string) {
  const id = `dept-${Date.now()}-${counter++}`;
  return prisma.department.create({
    data: {
      name: name || `Department ${id}`,
    },
  });
}

export interface CreateUserOptions {
  name?: string;
  email?: string;
  role?: Role;
  departmentId?: string | null;
  managerId?: string | null;
  isActive?: boolean;
}

export async function createUser(options: CreateUserOptions = {}) {
  const seq = counter++;
  const user = await prisma.user.create({
    data: {
      name: options.name || `Test User ${seq}`,
      email: options.email || `user-${Date.now()}-${seq}@nexusops.com`,
      passwordHash: DEFAULT_PASSWORD_HASH,
      role: options.role || Role.EMPLOYEE,
      departmentId: options.departmentId,
      managerId: options.managerId,
      isActive: options.isActive !== undefined ? options.isActive : true,
    },
  });

  const token = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  return { user, token };
}

export interface CreateRequestOptions {
  title?: string;
  description?: string;
  category?: RequestCategory;
  priority?: Priority;
  status?: RequestStatus;
  departmentId?: string | null;
}

export async function createRequest(
  requester: { id: string; departmentId?: string | null },
  options: CreateRequestOptions = {}
) {
  const seq = counter++;
  return prisma.workRequest.create({
    data: {
      title: options.title || `Test Request ${seq}`,
      description: options.description || `Test request description ${seq}`,
      category: options.category || RequestCategory.IT,
      priority: options.priority || Priority.MEDIUM,
      status: options.status || RequestStatus.DRAFT,
      requesterId: requester.id,
      departmentId: options.departmentId !== undefined ? options.departmentId : requester.departmentId,
    },
  });
}

export interface CreateDocumentOptions {
  title?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  storagePath?: string;
  visibility?: DocVisibility;
  status?: DocStatus;
  departmentId?: string | null;
}

export async function createDocument(
  uploader: { id: string },
  options: CreateDocumentOptions = {}
) {
  const seq = counter++;
  return prisma.document.create({
    data: {
      title: options.title || `Test Document ${seq}`,
      fileName: options.fileName || `document-${seq}.pdf`,
      fileSize: options.fileSize || 1024,
      mimeType: options.mimeType || "application/pdf",
      storagePath: options.storagePath || `uploads/test-doc-${seq}.pdf`,
      visibility: options.visibility || DocVisibility.ALL,
      status: options.status || DocStatus.READY,
      departmentId: options.departmentId,
      uploadedById: uploader.id,
    },
  });
}

export interface CreateChunkOptions {
  chunkIndex?: number;
  pageNumber?: number;
  content?: string;
  tokenCount?: number;
  vector?: number[];
}

export async function createChunk(
  documentId: string,
  options: CreateChunkOptions = {}
) {
  const seq = counter++;
  const vectorStr = options.vector
    ? formatVectorForPg(options.vector)
    : FIXED_FAKE_VECTOR_PG;

  const content = options.content || `Test document chunk content for indexing ${seq}.`;
  const pageNumber = options.pageNumber ?? 1;
  const chunkIndex = options.chunkIndex ?? 0;
  const tokenCount = options.tokenCount ?? 20;

  // Insert using raw SQL because pgvector embedding column requires vector type
  const inserted = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "DocumentChunk" (
      "id", "documentId", "chunkIndex", "pageNumber", "content", "tokenCount", "embedding", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), ${documentId}, ${chunkIndex}, ${pageNumber}, ${content}, ${tokenCount}, ${vectorStr}::vector, NOW(), NOW()
    )
    RETURNING "id";
  `;

  return inserted[0];
}
