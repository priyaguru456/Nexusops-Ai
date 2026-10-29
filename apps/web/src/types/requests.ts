import type { Role } from "./auth";

export type RequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type RequestCategory = "IT" | "HR" | "FINANCE" | "FACILITIES" | "OTHER";

export interface RequestAttachment {
  id: string;
  fileName: string;
  filePath: string;
  createdAt: string;
}

export interface RequestApprovalStep {
  id: string;
  stepOrder: number;
  approverRole: Role;
  approverId: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";
  comment: string | null;
  decidedAt: string | null;
}

export interface WorkRequest {
  id: string;
  title: string;
  description: string;
  category: RequestCategory;
  priority: Priority;
  status: RequestStatus;
  amount: string | number | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  requesterId: string;
  requester: {
    id: string;
    name: string;
    email: string;
    role: Role;
    departmentId: string | null;
    department?: {
      id: string;
      name: string;
    } | null;
  };
  attachments?: RequestAttachment[];
  approvalSteps?: RequestApprovalStep[];
}

export interface RequestQueryFilters {
  status?: RequestStatus | "";
  priority?: Priority | "";
  category?: RequestCategory | "";
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "title" | "priority" | "status" | "dueDate" | "amount";
  sortOrder?: "asc" | "desc";
}

export interface PaginatedRequestsResponse {
  requests: WorkRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ActivityHistoryItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actorId: string | null;
  metadata?: Record<string, unknown> | null;
  actor?: {
    id: string;
    name: string;
    email: string;
    role: Role;
  } | null;
}
