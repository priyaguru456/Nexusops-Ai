import type { Role } from "./auth";
import type { RequestCategory, Priority, RequestStatus } from "./requests";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";

export interface ApprovalStepItem {
  id: string;
  stepOrder: number;
  approverRole: Role;
  approverId: string | null;
  status: ApprovalStatus;
  comment: string | null;
  decidedAt: string | null;
  activatedAt?: string | null;
  escalatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  approver?: {
    id: string;
    name: string;
    email: string;
    role: Role;
  } | null;
}

export interface PendingApprovalStep extends ApprovalStepItem {
  request: {
    id: string;
    title: string;
    description: string;
    category: RequestCategory;
    priority: Priority;
    status: RequestStatus;
    amount: string | number | null;
    dueDate: string | null;
    requesterId: string;
    createdAt: string;
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
    approvalSteps: ApprovalStepItem[];
  };
}

export interface PendingApprovalsResponse {
  steps: PendingApprovalStep[];
  escalationAfterHours?: number;
}

export interface BulkApprovePayload {
  stepIds: string[];
  comment?: string;
}

export interface BulkApproveItemResult {
  stepId: string;
  success: boolean;
  step?: ApprovalStepItem;
  error?: string;
}

export interface BulkApproveResponse {
  results: BulkApproveItemResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

export interface ApproveStepPayload {
  comment?: string;
}

export interface RejectStepPayload {
  comment: string;
}

export interface ReassignStepPayload {
  approverId: string;
}
