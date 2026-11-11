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

export const DEFAULT_TEST_ORG_ID = "00000000-0000-4000-8000-000000000001";

export async function ensureDefaultOrganization() {
  return prisma.organization.upsert({
    where: { slug: "default" },
    update: { isActive: true },
    create: {
      id: DEFAULT_TEST_ORG_ID,
      name: "NexusOps Default",
      slug: "default",
      isActive: true,
    },
  });
}

export async function createOrganization(options: {
  name?: string;
  slug?: string;
  isActive?: boolean;
} = {}) {
  const seq = counter++;
  const slug = options.slug || `org-${Date.now()}-${seq}`;
  return prisma.organization.create({
    data: {
      name: options.name || `Organization ${seq}`,
      slug,
      isActive: options.isActive ?? true,
    },
  });
}

export async function createDepartment(name?: string, organizationId?: string) {
  const id = `dept-${Date.now()}-${counter++}`;
  const orgId = organizationId || (await ensureDefaultOrganization()).id;
  return prisma.department.create({
    data: {
      name: name || `Department ${id}`,
      organizationId: orgId,
    },
  });
}

export interface CreateUserOptions {
  name?: string;
  email?: string;
  role?: Role;
  organizationId?: string | null;
  departmentId?: string | null;
  managerId?: string | null;
  isActive?: boolean;
}

export async function createUser(options: CreateUserOptions = {}) {
  const seq = counter++;
  const role = options.role || Role.EMPLOYEE;
  let organizationId: string | null = null;
  if (options.organizationId !== undefined) {
    organizationId = options.organizationId;
  } else if (role !== Role.SUPER_ADMIN) {
    if (options.departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: options.departmentId },
        select: { organizationId: true },
      });
      organizationId = dept?.organizationId ?? (await ensureDefaultOrganization()).id;
    } else {
      organizationId = (await ensureDefaultOrganization()).id;
    }
  }

  const user = await prisma.user.create({
    data: {
      name: options.name || `Test User ${seq}`,
      email: options.email || `user-${Date.now()}-${seq}@nexusops.com`,
      passwordHash: DEFAULT_PASSWORD_HASH,
      role,
      organizationId,
      departmentId: options.departmentId,
      managerId: options.managerId,
      isActive: options.isActive !== undefined ? options.isActive : true,
    },
  });

  const token = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
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
  organizationId?: string;
}

export async function createRequest(
  requester: { id: string; departmentId?: string | null; organizationId?: string | null },
  options: CreateRequestOptions = {}
) {
  const seq = counter++;
  const organizationId =
    options.organizationId ||
    requester.organizationId ||
    (await ensureDefaultOrganization()).id;

  return prisma.workRequest.create({
    data: {
      title: options.title || `Test Request ${seq}`,
      description: options.description || `Test request description ${seq}`,
      category: options.category || RequestCategory.IT,
      priority: options.priority || Priority.MEDIUM,
      status: options.status || RequestStatus.DRAFT,
      requesterId: requester.id,
      organizationId,
    },
  });
}

export interface CreateDocumentOptions {
  title?: string;
  fileName?: string;
  fileSize?: number;
  sizeBytes?: number;
  mimeType?: string;
  storagePath?: string;
  filePath?: string;
  visibility?: DocVisibility;
  status?: DocStatus;
  departmentId?: string | null;
  organizationId?: string;
}

export async function createDocument(
  uploader: { id: string; organizationId?: string | null },
  options: CreateDocumentOptions = {}
) {
  const seq = counter++;
  const organizationId =
    options.organizationId ||
    uploader.organizationId ||
    (await ensureDefaultOrganization()).id;

  return prisma.document.create({
    data: {
      title: options.title || `Test Document ${seq}`,
      fileName: options.fileName || `document-${seq}.pdf`,
      sizeBytes: options.sizeBytes ?? options.fileSize ?? 1024,
      mimeType: options.mimeType || "application/pdf",
      filePath: options.filePath ?? options.storagePath ?? `uploads/test-doc-${seq}.pdf`,
      visibility: options.visibility || DocVisibility.ALL,
      status: options.status || DocStatus.READY,
      departmentId: options.departmentId,
      uploadedById: uploader.id,
      organizationId,
    },
  });
}

export interface CreateChunkOptions {
  chunkIndex?: number;
  pageNumber?: number;
  content?: string;
  tokenCount?: number;
  vector?: number[];
  organizationId?: string;
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

  let organizationId = options.organizationId;
  if (!organizationId) {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { organizationId: true },
    });
    organizationId = doc?.organizationId ?? (await ensureDefaultOrganization()).id;
  }

  // Insert using raw SQL because pgvector embedding column requires vector type
  const inserted = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "DocumentChunk" (
      "id", "documentId", "organizationId", "chunkIndex", "pageNumber", "content", "tokenCount", "embedding", "createdAt"
    ) VALUES (
      gen_random_uuid(), ${documentId}, ${organizationId}, ${chunkIndex}, ${pageNumber}, ${content}, ${tokenCount}, ${vectorStr}::vector, NOW()
    )
    RETURNING "id";
  `;

  return inserted[0];
}
