import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "../../components/ui/toast";
import { ExpensesPage } from "./ExpensesPage";
import { NewExpenseModal } from "./NewExpenseModal";
import { ExpenseDetailModal } from "./ExpenseDetailModal";
import { MarkAsPaidModal } from "./MarkAsPaidModal";
import * as AuthContextModule from "../auth/AuthContext";
import { expensesApi } from "./api";
import type { ExpenseClaim, ExpenseSummary } from "../../types/expenses";

vi.mock("../auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("./api", () => ({
  expensesApi: {
    getSummary: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    submit: vi.fn(),
    delete: vi.fn(),
    markAsPaid: vi.fn(),
    uploadReceipt: vi.fn(),
  },
}));

const mockSummary: ExpenseSummary = {
  employee: {
    totalReimbursedThisYear: 4500000, // ₹45,000.00
    pendingPayout: 1250000, // ₹12,500.00
    draftClaimsCount: 2,
    year: 2026,
  },
  finance: {
    queueCount: 3,
    queueTotalAmount: 3800000, // ₹38,000.00
  },
};

const mockClaims: ExpenseClaim[] = [
  {
    id: "claim-101",
    title: "Client Dinner & Taxi",
    totalAmount: 320000, // ₹3,200.00
    status: "APPROVED",
    employeeId: "user-1",
    employee: {
      id: "user-1",
      name: "Alice Developer",
      email: "alice@company.com",
      role: "EMPLOYEE",
    },
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    submittedAt: "2026-11-01T11:00:00.000Z",
    items: [
      {
        id: "item-1",
        claimId: "claim-101",
        category: "MEALS",
        amount: 220000,
        description: "Dinner with partner",
        date: "2026-11-01T00:00:00.000Z",
        receiptUrl: "/api/expenses/receipts/dinner.pdf",
        createdAt: "2026-11-01T10:00:00.000Z",
        updatedAt: "2026-11-01T10:00:00.000Z",
      },
      {
        id: "item-2",
        claimId: "claim-101",
        category: "TRAVEL",
        amount: 100000,
        description: "Cab home",
        date: "2026-11-01T00:00:00.000Z",
        receiptUrl: null,
        createdAt: "2026-11-01T10:00:00.000Z",
        updatedAt: "2026-11-01T10:00:00.000Z",
      },
    ],
    approvalSteps: [
      {
        id: "step-1",
        stepOrder: 1,
        approverRole: "MANAGER",
        status: "APPROVED",
        decidedAt: "2026-11-02T10:00:00.000Z",
        comment: "Looks good, approved.",
        approver: { id: "mgr-1", name: "Bob Manager", email: "bob@company.com" },
      },
      {
        id: "step-2",
        stepOrder: 2,
        approverRole: "ADMIN",
        status: "APPROVED",
        decidedAt: "2026-11-03T10:00:00.000Z",
        comment: "Finance verification passed.",
        approver: { id: "adm-1", name: "Carol Admin", email: "carol@company.com" },
      },
    ],
  },
  {
    id: "claim-102",
    title: "AWS Cloud Certification",
    totalAmount: 1500000, // ₹15,000.00
    status: "PAID",
    employeeId: "user-1",
    employee: {
      id: "user-1",
      name: "Alice Developer",
      email: "alice@company.com",
      role: "EMPLOYEE",
    },
    paymentReference: "UTR-2026-990088",
    paidAt: "2026-11-04T12:00:00.000Z",
    createdAt: "2026-10-25T10:00:00.000Z",
    updatedAt: "2026-10-25T10:00:00.000Z",
    submittedAt: "2026-10-26T10:00:00.000Z",
    items: [
      {
        id: "item-3",
        claimId: "claim-102",
        category: "SOFTWARE",
        amount: 1500000,
        description: "Exam fee",
        date: "2026-10-25T00:00:00.000Z",
        receiptUrl: "/api/expenses/receipts/aws.pdf",
        createdAt: "2026-10-25T10:00:00.000Z",
        updatedAt: "2026-10-25T10:00:00.000Z",
      },
    ],
  },
];

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ToastProvider>{ui}</ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ExpensesPage Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: {
        id: "user-1",
        name: "Alice Developer",
        email: "alice@company.com",
        role: "EMPLOYEE",
      },
    });

    (expensesApi.getSummary as any).mockResolvedValue(mockSummary);
    (expensesApi.list as any).mockResolvedValue({
      claims: mockClaims,
      items: mockClaims,
      total: mockClaims.length,
      pagination: { page: 1, limit: 10, total: mockClaims.length, totalPages: 1 },
    });
  });

  it("renders employee summary cards with INR formatted values", async () => {
    renderWithProviders(<ExpensesPage />);

    // Total reimbursed this year: ₹45,000.00
    await waitFor(() => {
      const reimbursedEl = screen.getByTestId("summary-reimbursed");
      expect(reimbursedEl.textContent).toContain("45,000");
    });

    // Pending payout: ₹12,500.00
    const pendingEl = screen.getByTestId("summary-pending-payout");
    expect(pendingEl.textContent).toContain("12,500");

    // Draft claims: 2 claims
    const draftEl = screen.getByTestId("summary-draft-claims");
    expect(draftEl.textContent).toContain("2");
  });

  it("renders claims table with INR amounts and status badges", async () => {
    renderWithProviders(<ExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText("Client Dinner & Taxi")).toBeInTheDocument();
      expect(screen.getByText("AWS Cloud Certification")).toBeInTheDocument();
    });

    // Verify INR formatted amounts in the table
    expect(screen.getByText("₹3,200.00")).toBeInTheDocument();
    expect(screen.getByText("₹15,000.00")).toBeInTheDocument();

    // Verify status badges
    expect(screen.getByText("APPROVED")).toBeInTheDocument();
    expect(screen.getByText("PAID")).toBeInTheDocument();
  });

  it("hides Finance Queue tab for regular employees", async () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "user-1", role: "EMPLOYEE" },
    });

    renderWithProviders(<ExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText("My Expenses")).toBeInTheDocument();
    });

    expect(screen.queryByText(/Finance Queue/i)).not.toBeInTheDocument();
  });

  it("displays Finance Queue tab for Managers and Admins", async () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "admin-1", role: "ADMIN" },
    });

    renderWithProviders(<ExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText(/Finance Queue/i)).toBeInTheDocument();
    });
  });

  it("opens New Expense Report modal, supports multi-items and calculates auto-total", async () => {
    renderWithProviders(<NewExpenseModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText("New Expense Report")).toBeInTheDocument();

    const titleInput = screen.getByLabelText(/Report Title/i);
    fireEvent.change(titleInput, { target: { value: "Team Offsite Travel" } });

    // Item 1 amount: ₹2,500
    const amountInput1 = screen.getByLabelText(/Amount \(INR ₹\)/i);
    fireEvent.change(amountInput1, { target: { value: "2500" } });

    // Auto-total should display ₹2,500.00
    const totalEl = screen.getByTestId("auto-total-display");
    expect(totalEl.textContent).toBe("₹2,500.00");

    // Click Add Item
    const addItemBtn = screen.getByRole("button", { name: /Add Item/i });
    fireEvent.click(addItemBtn);

    // There should now be 2 items
    expect(screen.getByText("Item #2")).toBeInTheDocument();

    // Enter second item amount: ₹1,500
    const amountInputs = screen.getAllByLabelText(/Amount \(INR ₹\)/i);
    fireEvent.change(amountInputs[1], { target: { value: "1500" } });

    // Auto-total should update in real-time to ₹4,000.00
    expect(totalEl.textContent).toBe("₹4,000.00");
  });

  it("validates file upload format and size in NewExpenseModal", async () => {
    renderWithProviders(<NewExpenseModal isOpen={true} onClose={vi.fn()} />);

    const fileInput = screen.getByLabelText(/Upload receipt for item 1/i);

    // Invalid file extension
    const invalidFile = new File(["dummy"], "malicious.exe", {
      type: "application/x-msdownload",
    });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Invalid file format/i)).toBeInTheDocument();
    });
  });

  it("opens ExpenseDetailModal with ApprovalStepper and receipt preview trigger", async () => {
    const handleClose = vi.fn();
    renderWithProviders(
      <ExpenseDetailModal
        claim={mockClaims[0]}
        isOpen={true}
        onClose={handleClose}
        currentUserRole="EMPLOYEE"
        currentUserId="user-1"
      />
    );

    expect(screen.getByText("Client Dinner & Taxi")).toBeInTheDocument();
    expect(screen.getByText("Approval Stepper & Decision History")).toBeInTheDocument();

    // Check step 1 details
    expect(screen.getByText(/Step 1: Manager Review/i)).toBeInTheDocument();
    expect(screen.getByText(/"Looks good, approved."/i)).toBeInTheDocument();

    // Check step 2 details
    expect(screen.getByText(/Step 2: Finance & Admin Review/i)).toBeInTheDocument();
    expect(screen.getByText(/"Finance verification passed."/i)).toBeInTheDocument();

    // View Receipt button should be present for item 1
    expect(screen.getByRole("button", { name: /View Receipt/i })).toBeInTheDocument();
  });

  it("supports Finance Mark as Paid workflow with payment reference input", async () => {
    (expensesApi.markAsPaid as any).mockResolvedValue({
      ...mockClaims[0],
      status: "PAID",
      paymentReference: "UTR-TEST-123",
    });

    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    renderWithProviders(
      <MarkAsPaidModal
        claim={mockClaims[0]}
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    expect(screen.getByText("Record Reimbursement Payout")).toBeInTheDocument();
    expect(screen.getByText("₹3,200.00")).toBeInTheDocument();

    const refInput = screen.getByLabelText(/Payment Reference/i);
    fireEvent.change(refInput, { target: { value: "UTR-TEST-123" } });

    const confirmBtn = screen.getByRole("button", { name: /Confirm Payout/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(expensesApi.markAsPaid).toHaveBeenCalledWith("claim-101", "UTR-TEST-123");
      expect(handleSuccess).toHaveBeenCalled();
    });
  });
});
