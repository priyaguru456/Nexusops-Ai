import type { Prisma, Role, ApprovalStatus, Priority } from "@prisma/client";
import type { AuthenticatedUser } from "../../../types/express";

export interface ApprovalEntityDetails {
  id: string;
  title: string;
  description?: string | null;
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
    managerId?: string | null;
  };
  status?: string;
  priority?: Priority;
  category?: string;
  amount?: number | string | Prisma.Decimal | null;
  dueDate?: Date | string | null;
  link: string;
  approvalSteps?: Array<{
    id: string;
    stepOrder: number;
    status: ApprovalStatus;
  }>;
  metadata?: Record<string, unknown>;
}

export interface OnStepApprovedParams {
  step: {
    id: string;
    entityType: string;
    entityId: string;
    requestId?: string | null;
    stepOrder: number;
    approverRole: Role;
    approverId?: string | null;
    request?: any;
  };
  nextStep?: {
    id: string;
    stepOrder: number;
    approverRole: Role;
    approverId?: string | null;
  } | null;
  user: AuthenticatedUser;
  comment?: string;
  tx: Prisma.TransactionClient;
}

export interface OnFinalApprovedParams {
  step: {
    id: string;
    entityType: string;
    entityId: string;
    requestId?: string | null;
    stepOrder: number;
    approverRole: Role;
    approverId?: string | null;
    request?: any;
  };
  user: AuthenticatedUser;
  comment?: string;
  tx: Prisma.TransactionClient;
}

export interface OnRejectedParams {
  step: {
    id: string;
    entityType: string;
    entityId: string;
    requestId?: string | null;
    stepOrder: number;
    approverRole: Role;
    approverId?: string | null;
    request?: any;
  };
  user: AuthenticatedUser;
  comment: string;
  tx: Prisma.TransactionClient;
}

export interface ApprovalEntityHandler {
  readonly entityType: string;

  /**
   * Loads entity details for authorization checks, UI inbox display, and notifications.
   */
  getEntityDetails(
    entityId: string,
    tx?: Prisma.TransactionClient
  ): Promise<ApprovalEntityDetails | null>;

  /**
   * Called when an intermediate approval step is approved and a subsequent step exists.
   */
  onStepApproved?(params: OnStepApprovedParams): Promise<void>;

  /**
   * Called when the final approval step is approved.
   */
  onFinalApproved(params: OnFinalApprovedParams): Promise<void>;

  /**
   * Called when an approval step is rejected.
   */
  onRejected(params: OnRejectedParams): Promise<void>;

  /**
   * Returns the user-facing web link for the entity (e.g. `/requests/${id}`).
   */
  getLink(entityId: string): string;

  /**
   * Returns human-readable entity name for notifications and audit logs (e.g. 'WorkRequest', 'Leave', 'Expense').
   */
  getEntityTypeName(): string;
}
