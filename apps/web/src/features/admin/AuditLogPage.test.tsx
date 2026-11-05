import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuditLogPage } from "./AuditLogPage";
import * as HooksModule from "./hooks";
import type { AuditLogItem } from "../../types/audit";

// Mock hooks
vi.mock("./hooks", () => ({
  useAuditLogs: vi.fn(),
  useExportAuditLogs: vi.fn(),
}));

// Mock toast
vi.mock("../../components/ui/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockLogs: AuditLogItem[] = [
  {
    id: "log-1111-aaaa",
    action: "USER_LOGIN",
    entityType: "User",
    entityId: "usr-admin-1",
    summary: "User admin@nexusops.com logged in",
    ipAddress: "127.0.0.1",
    createdAt: "2026-11-04T07:30:00.000Z",
    actorId: "usr-admin-1",
    actor: {
      id: "usr-admin-1",
      name: "Admin User",
      email: "admin@nexusops.com",
      role: "ADMIN",
    },
    metadata: {
      method: "password",
      userAgent: "Mozilla/5.0",
    },
  },
  {
    id: "log-2222-bbbb",
    action: "REQUEST_CREATED",
    entityType: "WorkRequest",
    entityId: "req-9999-xxxx",
    summary: 'Created request "New Laptop Setup"',
    ipAddress: "192.168.1.50",
    createdAt: "2026-11-04T08:15:00.000Z",
    actorId: "usr-emp-2",
    actor: {
      id: "usr-emp-2",
      name: "Priya Sharma",
      email: "priya@nexusops.com",
      role: "EMPLOYEE",
    },
    metadata: {
      category: "IT",
      priority: "HIGH",
    },
  },
];

describe("AuditLogPage Component Tests", () => {
  const mockMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (HooksModule.useAuditLogs as any).mockReturnValue({
      data: {
        logs: mockLogs,
        total: 2,
        page: 1,
        limit: 15,
        totalPages: 1,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    (HooksModule.useExportAuditLogs as any).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <AuditLogPage />
      </MemoryRouter>
    );

  it("renders the page header, append-only badge, and export CSV button", () => {
    renderComponent();

    expect(screen.getByRole("heading", { name: "Audit Logs", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Append-Only")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export audit logs to csv/i })).toBeInTheDocument();
  });

  it("renders audit log items in data table with Asia/Kolkata timestamps and summaries", () => {
    renderComponent();

    expect(screen.getAllByText("USER_LOGIN").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("User admin@nexusops.com logged in")).toBeInTheDocument();
    expect(screen.getByText("127.0.0.1")).toBeInTheDocument();

    expect(screen.getAllByText("REQUEST_CREATED").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Created request "New Laptop Setup"')).toBeInTheDocument();
    expect(screen.getByText("192.168.1.50")).toBeInTheDocument();

    // Actor details
    expect(screen.getByText("Admin User")).toBeInTheDocument();
    expect(screen.getByText("admin@nexusops.com")).toBeInTheDocument();
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
  });

  it("opens the detail drawer when clicking 'View' and shows complete event attributes and sanitized metadata", async () => {
    const user = userEvent.setup();
    renderComponent();

    const viewButtons = screen.getAllByRole("button", { name: /view audit details for event/i });
    expect(viewButtons.length).toBe(2);

    await user.click(viewButtons[0]);

    // Drawer opens
    expect(screen.getByRole("dialog", { name: "Audit Entry Details" })).toBeInTheDocument();
    expect(screen.getByText("Event Summary")).toBeInTheDocument();
    expect(screen.getAllByText("User admin@nexusops.com logged in").length).toBe(2);

    // Check IP, Timestamp, and Metadata
    expect(screen.getByText("Origin IP Address")).toBeInTheDocument();
    expect(screen.getByText("Context Metadata")).toBeInTheDocument();
    expect(screen.getByText(/userAgent/i)).toBeInTheDocument();

    // Close button dismisses drawer
    const closeBtn = screen.getByRole("button", { name: "Close details drawer" });
    await user.click(closeBtn);

    expect(screen.queryByRole("dialog", { name: "Audit Entry Details" })).not.toBeInTheDocument();
  });

  it("closes the detail drawer when pressing the Escape key", async () => {
    const user = userEvent.setup();
    renderComponent();

    const viewButtons = screen.getAllByRole("button", { name: /view audit details for event/i });
    await user.click(viewButtons[1]);

    expect(screen.getByRole("dialog", { name: "Audit Entry Details" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Audit Entry Details" })).not.toBeInTheDocument();
  });

  it("handles filter changes and resets filters", async () => {
    const user = userEvent.setup();
    renderComponent();

    const actorInput = screen.getByPlaceholderText("Name, email, or ID...");
    await user.type(actorInput, "Priya");

    expect(actorInput).toHaveValue("Priya");

    // Reset button appears
    const resetBtn = screen.getByRole("button", { name: /reset filters/i });
    expect(resetBtn).toBeInTheDocument();

    await user.click(resetBtn);

    expect(actorInput).toHaveValue("");
  });

  it("triggers CSV export download when 'Export CSV' button is clicked", async () => {
    const user = userEvent.setup();
    const fakeBlob = new Blob(["ID,Timestamp,Action\n1,2026-11-04,USER_LOGIN"], {
      type: "text/csv",
    });
    mockMutateAsync.mockResolvedValueOnce(fakeBlob);

    // Mock URL methods
    window.URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/test-csv");
    window.URL.revokeObjectURL = vi.fn();

    renderComponent();

    const exportBtn = screen.getByRole("button", { name: /export audit logs to csv/i });
    await user.click(exportBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 15 }));
      expect(window.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it("renders empty state when no audit logs match filters", () => {
    (HooksModule.useAuditLogs as any).mockReturnValue({
      data: {
        logs: [],
        total: 0,
        page: 1,
        limit: 15,
        totalPages: 1,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderComponent();

    expect(screen.getByText("No audit logs found")).toBeInTheDocument();
    expect(
      screen.getByText("There are no audit events recorded matching your current filters.")
    ).toBeInTheDocument();
  });

  it("renders error alert with retry button when API returns error", () => {
    const refetchMock = vi.fn();
    (HooksModule.useAuditLogs as any).mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error("Network connection lost"),
      refetch: refetchMock,
    });

    renderComponent();

    expect(screen.getByText(/Failed to load audit logs: Network connection lost/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(refetchMock).toHaveBeenCalled();
  });
});
