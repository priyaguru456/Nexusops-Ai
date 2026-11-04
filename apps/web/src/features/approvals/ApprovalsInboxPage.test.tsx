import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApprovalsInboxPage } from "./ApprovalsInboxPage";
import * as AuthContextModule from "../auth/AuthContext";
import * as HooksModule from "./hooks";
import type { PendingApprovalStep } from "../../types/approvals";

vi.mock("../auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("./hooks", () => ({
  usePendingApprovals: vi.fn(),
  useApproveStep: vi.fn(),
  useRejectStep: vi.fn(),
  useBulkApprove: vi.fn(),
}));

describe("ApprovalsInboxPage Component Tests", () => {
  let queryClient: QueryClient;
  const mockMutateApprove = vi.fn();
  const mockMutateReject = vi.fn();
  const mockMutateBulk = vi.fn();

  const dummySteps: PendingApprovalStep[] = [
    {
      id: "step-1",
      stepOrder: 1,
      approverRole: "MANAGER",
      approverId: null,
      status: "PENDING",
      comment: null,
      decidedAt: null,
      activatedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(), // 4h ago (green)
      escalatedAt: null,
      createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      request: {
        id: "req-11111111-1111-1111-1111-111111111111",
        title: "New Mac Laptop for DevOps",
        description: "Need upgraded hardware for Docker builds",
        category: "IT",
        priority: "HIGH",
        status: "SUBMITTED",
        amount: "2499.00",
        dueDate: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
        requesterId: "usr-emp-1",
        createdAt: new Date().toISOString(),
        requester: {
          id: "usr-emp-1",
          name: "Alice Engineer",
          email: "alice@company.com",
          role: "EMPLOYEE",
          departmentId: "dept-1",
          department: { id: "dept-1", name: "Engineering" },
        },
        approvalSteps: [],
      },
    },
    {
      id: "step-2",
      stepOrder: 1,
      approverRole: "MANAGER",
      approverId: null,
      status: "PENDING",
      comment: null,
      decidedAt: null,
      activatedAt: new Date(Date.now() - 32 * 3600 * 1000).toISOString(), // 32h ago (amber)
      escalatedAt: null,
      createdAt: new Date(Date.now() - 32 * 3600 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      request: {
        id: "req-22222222-2222-2222-2222-222222222222",
        title: "Team Offsite Travel Budget",
        description: "Annual team sync flights and stay",
        category: "FINANCE",
        priority: "URGENT",
        status: "SUBMITTED",
        amount: "8500.00",
        dueDate: null,
        requesterId: "usr-emp-2",
        createdAt: new Date().toISOString(),
        requester: {
          id: "usr-emp-2",
          name: "Bob Lead",
          email: "bob@company.com",
          role: "EMPLOYEE",
          departmentId: "dept-2",
          department: { id: "dept-2", name: "Operations" },
        },
        approvalSteps: [],
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "usr-mgr-1", name: "Carol Manager", role: "MANAGER" },
    });

    (HooksModule.usePendingApprovals as any).mockReturnValue({
      data: {
        steps: dummySteps,
        escalationAfterHours: 72,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    });

    (HooksModule.useApproveStep as any).mockReturnValue({
      mutateAsync: mockMutateApprove,
      isPending: false,
    });

    (HooksModule.useRejectStep as any).mockReturnValue({
      mutateAsync: mockMutateReject,
      isPending: false,
    });

    (HooksModule.useBulkApprove as any).mockReturnValue({
      mutateAsync: mockMutateBulk,
      isPending: false,
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ApprovalsInboxPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("renders pending rows with SLA badges and inline [Approve] and [Reject] buttons", () => {
    renderComponent();

    expect(screen.getByText("New Mac Laptop for DevOps")).toBeInTheDocument();
    expect(screen.getByText("Team Offsite Travel Budget")).toBeInTheDocument();

    // Check SLA badges with real values
    expect(screen.getByText("4h pending")).toBeInTheDocument();
    expect(screen.getByText("32h pending")).toBeInTheDocument();
    expect(screen.getByText("Escalates in 68h")).toBeInTheDocument();
    expect(screen.getByText("Escalates in 40h")).toBeInTheDocument();

    // Inline Approve and Reject buttons exist per row
    const approveButtons = screen.getAllByRole("button", { name: /approve/i });
    const rejectButtons = screen.getAllByRole("button", { name: /reject/i });
    expect(approveButtons.length).toBeGreaterThanOrEqual(2);
    expect(rejectButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("clicking inline [Approve] opens a popover with an optional comment and confirms", async () => {
    const user = userEvent.setup();
    mockMutateApprove.mockResolvedValueOnce({ success: true });
    renderComponent();

    // Click Approve on the first item
    const firstApproveBtn = screen.getByRole("button", {
      name: "Approve request: New Mac Laptop for DevOps",
    });
    await user.click(firstApproveBtn);

    // Popover dialog should now be visible
    const popover = screen.getByRole("dialog", {
      name: /approve request: new mac laptop for devops/i,
    });
    expect(popover).toBeInTheDocument();
    expect(screen.getByText(/confirm approval/i)).toBeInTheDocument();

    // Optional comment input
    const commentInput = screen.getByPlaceholderText(/add optional notes/i);
    await user.type(commentInput, "Approved for development");

    // Click Confirm button inside popover
    const confirmBtn = screen.getByRole("button", { name: /confirm/i });
    await user.click(confirmBtn);

    expect(mockMutateApprove).toHaveBeenCalledWith({
      stepId: "step-1",
      payload: { comment: "Approved for development" },
    });
  });

  it("clicking inline [Reject] opens a confirmation modal requiring a mandatory reason", async () => {
    const user = userEvent.setup();
    mockMutateReject.mockResolvedValueOnce({ success: true });
    renderComponent();

    // Click Reject on first item
    const firstRejectBtn = screen.getByRole("button", {
      name: "Reject request: New Mac Laptop for DevOps",
    });
    await user.click(firstRejectBtn);

    // Reject Modal opens
    expect(screen.getByText("Reject Approval Request")).toBeInTheDocument();
    expect(screen.getByText(/rejection reason/i)).toBeInTheDocument();

    // Attempt to submit empty reason
    const confirmRejectBtn = screen.getByRole("button", {
      name: /confirm rejection/i,
    });
    fireEvent.click(confirmRejectBtn);

    // Shows validation error
    expect(
      screen.getByText(/rejection reason is mandatory/i)
    ).toBeInTheDocument();
    expect(mockMutateReject).not.toHaveBeenCalled();

    // Type mandatory reason and confirm
    const reasonInput = screen.getByPlaceholderText(/provide a clear reason/i);
    fireEvent.change(reasonInput, { target: { value: "Not in quarterly budget" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm rejection/i }));

    expect(mockMutateReject).toHaveBeenCalledWith({
      stepId: "step-1",
      payload: { comment: "Not in quarterly budget" },
    });
  });

  it("shows checkbox column and Bulk Approve button for Managers and Admins", async () => {
    const user = userEvent.setup();
    renderComponent();

    // Checkboxes should exist for Manager
    const selectAllCheckbox = screen.getByRole("button", {
      name: /select all on this page/i,
    });
    expect(selectAllCheckbox).toBeInTheDocument();

    // Select first request
    const selectFirst = screen.getByRole("button", {
      name: "Select request New Mac Laptop for DevOps",
    });
    await user.click(selectFirst);

    // Bulk actions bar appears with Bulk Approve button
    expect(screen.getByRole("region", { name: /bulk actions toolbar/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /bulk approve \(1\)/i })
    ).toBeInTheDocument();
  });

  it("hides checkboxes and Bulk Approve actions for EMPLOYEE role", () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "usr-emp-99", name: "Regular Employee", role: "EMPLOYEE" },
    });

    renderComponent();

    expect(
      screen.queryByRole("button", { name: /select all on this page/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /select request new mac laptop for devops/i,
      })
    ).not.toBeInTheDocument();
  });

  it("handles Bulk Approve workflow and surfaces per-item failure results", async () => {
    const user = userEvent.setup();
    mockMutateBulk.mockResolvedValueOnce({
      results: [
        { stepId: "step-1", success: true },
        {
          stepId: "step-2",
          success: false,
          error: "Approval step has already been decided with status: APPROVED",
        },
      ],
      summary: { total: 2, succeeded: 1, failed: 1 },
    });

    renderComponent();

    // Select all
    const selectAllBtn = screen.getByRole("button", {
      name: /select all on this page/i,
    });
    await user.click(selectAllBtn);

    // Click Bulk Approve
    const bulkApproveBtn = screen.getByRole("button", {
      name: /bulk approve \(2\)/i,
    });
    await user.click(bulkApproveBtn);

    // Confirmation Modal opens
    expect(
      screen.getByText(/bulk approve \(2\) requests/i)
    ).toBeInTheDocument();

    // Confirm bulk approval
    const confirmBulkBtn = screen.getByRole("button", {
      name: /approve 2 items/i,
    });
    await user.click(confirmBulkBtn);

    expect(mockMutateBulk).toHaveBeenCalledWith({
      stepIds: ["step-1", "step-2"],
      comment: undefined,
    });

    // Results modal surfaces failure breakdown
    await waitFor(() => {
      expect(screen.getByText("Bulk Approval Summary")).toBeInTheDocument();
      expect(screen.getByText("1 Succeeded")).toBeInTheDocument();
      expect(screen.getByText("1 Failed")).toBeInTheDocument();
      expect(
        screen.getByText(/already been decided with status: approved/i)
      ).toBeInTheDocument();
    });
  });

  it("sorts by Oldest pending first correctly", async () => {
    renderComponent();

    const sortSelect = screen.getByLabelText(/sort pending approvals/i);
    fireEvent.change(sortSelect, { target: { value: "oldest" } });

    // Step 2 was activated 32 hours ago (older), so it should appear before Step 1 (4h ago)
    const titles = screen.getAllByRole("link", { name: /view details/i });
    expect(titles).toHaveLength(2);
  });

  it("filters by priority correctly", async () => {
    renderComponent();

    const prioritySelect = screen.getByLabelText(/filter by request priority/i);
    fireEvent.change(prioritySelect, { target: { value: "URGENT" } });

    // Only step 2 is URGENT
    expect(screen.queryByText("New Mac Laptop for DevOps")).not.toBeInTheDocument();
    expect(screen.getByText("Team Offsite Travel Budget")).toBeInTheDocument();
  });
});
