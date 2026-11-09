import type { Role } from "./auth";

export type ExpenseStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID";

export type ExpenseCategory = "TRAVEL" | "MEALS" | "SOFTWARE" | "OFFICE" | "OTHER";

export interface ExpenseItem {
  id: string;
  claimId: string;
  category: ExpenseCategory;
  amount: number; // in integer paise
  receiptUrl?: string | null;
  description?: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseClaimEmployee {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: {
    id: string;
    name: string;
  } | null;
}

export interface ApprovalStepDetail {
  id: string;
  stepOrder: number;
  approverRole: Role;
  approverId?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";
  comment?: string | null;
  decidedAt?: string | null;
  activatedAt?: string | null;
  escalatedAt?: string | null;
  approver?: {
    id: string;
    name: string;
    email: string;
    role?: Role;
  } | null;
}

export interface ExpenseClaim {
  id: string;
  title: string;
  totalAmount: number; // in integer paise
  status: ExpenseStatus;
  employeeId: string;
  employee?: ExpenseClaimEmployee;
  submittedAt?: string | null;
  paidAt?: string | null;
  paymentReference?: string | null;
  createdAt: string;
  updatedAt: string;
  items: ExpenseItem[];
  approvalSteps?: ApprovalStepDetail[];
}

export interface ExpenseSummary {
  employee: {
    totalReimbursedThisYear: number; // in integer paise
    pendingPayout: number; // in integer paise
    pendingReviewAmount?: number;
    draftClaimsCount: number;
    year: number;
  };
  finance?: {
    queueCount: number;
    queueTotalAmount: number; // in integer paise
  } | null;
}

export interface CreateExpenseItemDraft {
  category: ExpenseCategory;
  amountRupees: string | number; // in rupees for UI input
  description?: string;
  date: string;
  receiptUrl?: string;
  receiptName?: string;
}

export interface CreateExpenseClaimPayload {
  title: string;
  items: Array<{
    category: ExpenseCategory;
    amount: number; // in paise
    description?: string;
    date: string;
    receiptUrl?: string;
  }>;
  submitImmediately?: boolean;
}

export interface ListExpensesResponse {
  claims: ExpenseClaim[];
  items?: ExpenseClaim[];
  total?: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GetExpensesParams {
  tab?: "my" | "finance";
  status?: ExpenseStatus;
  search?: string;
  page?: number;
  limit?: number;
}
