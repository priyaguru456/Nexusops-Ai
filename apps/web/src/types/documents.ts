export type DocVisibility = "ALL" | "DEPARTMENT" | "MANAGERS" | "ADMIN_ONLY";

export type DocStatus = "UPLOADED" | "PROCESSING" | "READY" | "FAILED";

export interface DocumentItem {
  id: string;
  title: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  category: string | null;
  visibility: DocVisibility;
  status: DocStatus;
  errorMessage: string | null;
  version: number;
  createdAt: string;
  departmentId: string | null;
  department?: {
    id: string;
    name: string;
  } | null;
  uploadedById: string;
  uploadedBy?: {
    id: string;
    name: string;
    email: string;
  };
  _count?: {
    chunks: number;
  };
}

export interface DocumentListResponse {
  documents: DocumentItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UploadDocumentPayload {
  file: File;
  title?: string;
  category?: string;
  visibility?: DocVisibility;
  version?: number;
}
