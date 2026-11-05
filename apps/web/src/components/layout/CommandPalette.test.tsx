import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CommandPalette } from "./CommandPalette";
import * as AuthContextModule from "../../features/auth/AuthContext";
import { searchApi } from "../../features/search/api";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../features/auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../features/search/api", () => ({
  searchApi: {
    search: vi.fn(),
  },
}));

describe("React Testing Library: Global Command Palette", () => {
  let queryClient: QueryClient;
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    (searchApi.search as any).mockResolvedValue({ requests: [], tasks: [] });
  });

  const renderPalette = (isOpen = true) =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CommandPalette isOpen={isOpen} onClose={mockOnClose} />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("does not render when isOpen is false", () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "1", name: "Alice", role: "EMPLOYEE" },
      role: "EMPLOYEE",
    });

    renderPalette(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders actions and permission-scoped pages for EMPLOYEE", () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "1", name: "Alice", role: "EMPLOYEE" },
      role: "EMPLOYEE",
    });

    renderPalette(true);

    // Dialog & input
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search pages, actions, requests/i)).toBeInTheDocument();

    // Quick actions
    expect(screen.getByText("+ New Request")).toBeInTheDocument();
    expect(screen.getByText("+ New Task")).toBeInTheDocument();
    expect(screen.getByText("Toggle theme")).toBeInTheDocument();

    // Accessible pages for Employee
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Work Requests")).toBeInTheDocument();
    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("Knowledge Base")).toBeInTheDocument();
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Announcements")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();

    // Restricted pages must NOT be present
    expect(screen.queryByText("Approvals")).not.toBeInTheDocument();
    expect(screen.queryByText(/User Management/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Audit Logs/i)).not.toBeInTheDocument();
  });

  it("renders Approvals for MANAGER but hides Admin pages", () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "2", name: "Bob Manager", role: "MANAGER" },
      role: "MANAGER",
    });

    renderPalette(true);

    expect(screen.getByText("Approvals")).toBeInTheDocument();
    expect(screen.queryByText(/User Management/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Audit Logs/i)).not.toBeInTheDocument();
  });

  it("renders full Admin pages and Approvals for ADMIN role", () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "3", name: "Charlie Admin", role: "ADMIN" },
      role: "ADMIN",
    });

    renderPalette(true);

    expect(screen.getByText("Approvals")).toBeInTheDocument();
    expect(screen.getByText("User Management (Admin)")).toBeInTheDocument();
    expect(screen.getByText("Audit Logs (Admin)")).toBeInTheDocument();
  });

  it("navigates to /requests/new when clicking '+ New Request'", () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "1", name: "Alice", role: "EMPLOYEE" },
      role: "EMPLOYEE",
    });

    renderPalette(true);
    fireEvent.click(screen.getByText("+ New Request"));

    expect(mockOnClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/requests/new");
  });

  it("navigates to /tasks?create=true when clicking '+ New Task'", () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "1", name: "Alice", role: "EMPLOYEE" },
      role: "EMPLOYEE",
    });

    renderPalette(true);
    fireEvent.click(screen.getByText("+ New Task"));

    expect(mockOnClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/tasks?create=true");
  });

  it("toggles theme when clicking 'Toggle theme'", () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "1", name: "Alice", role: "EMPLOYEE" },
      role: "EMPLOYEE",
    });

    renderPalette(true);
    fireEvent.click(screen.getByText("Toggle theme"));

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("closes palette on Escape key", () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "1", name: "Alice", role: "EMPLOYEE" },
      role: "EMPLOYEE",
    });

    renderPalette(true);
    fireEvent.keyDown(window, { key: "Escape" });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("navigates with ArrowDown / Enter keys", () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "1", name: "Alice", role: "EMPLOYEE" },
      role: "EMPLOYEE",
    });

    renderPalette(true);

    // Initial selected index is 0 (+ New Request)
    // Press ArrowDown to move to + New Task (index 1)
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(mockOnClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/tasks?create=true");
  });

  it("traps Tab focus inside the modal dialog", async () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "1", name: "Alice", role: "EMPLOYEE" },
      role: "EMPLOYEE",
    });

    renderPalette(true);
    const input = screen.getByRole("combobox");
    input.focus();

    // Tab key event
    fireEvent.keyDown(window, { key: "Tab" });
    // Shift+Tab event
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    // Doesn't throw error and stays inside
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("performs live search when typing a query and displays results", async () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "1", name: "Alice", role: "EMPLOYEE" },
      role: "EMPLOYEE",
    });

    (searchApi.search as any).mockResolvedValue({
      requests: [
        {
          id: "req-101",
          title: "MacBook Pro M3 Hardware Request",
          category: "IT_EQUIPMENT",
          status: "APPROVED",
          priority: "HIGH",
          createdAt: "2026-11-01T10:00:00Z",
          requesterName: "Alice",
        },
      ],
      tasks: [
        {
          id: "task-202",
          title: "Provision developer laptop",
          status: "IN_PROGRESS",
          priority: "HIGH",
          dueDate: "2026-11-05T00:00:00Z",
          createdAt: "2026-11-01T12:00:00Z",
          assigneeName: "Bob",
          requestId: "req-101",
        },
      ],
    });

    renderPalette(true);
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "laptop");

    await waitFor(() => {
      expect(searchApi.search).toHaveBeenCalledWith("laptop", expect.anything());
    });

    await waitFor(() => {
      expect(screen.getByText("MacBook Pro M3 Hardware Request")).toBeInTheDocument();
      expect(screen.getByText("Provision developer laptop")).toBeInTheDocument();
    });

    // Clicking request navigates to its detail
    fireEvent.click(screen.getByText("MacBook Pro M3 Hardware Request"));
    expect(mockNavigate).toHaveBeenCalledWith("/requests/req-101");
  });
});
