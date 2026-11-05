import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DirectoryPage } from "./DirectoryPage";
import * as AuthContextModule from "../auth/AuthContext";
import * as DirectoryHooksModule from "./hooks";
import * as DirectoryApiModule from "./api";
import type { DirectoryUser, DepartmentSummary, TeamData } from "../../types/directory";

vi.mock("../auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("./hooks", () => ({
  useDirectory: vi.fn(),
  useDirectoryDepartments: vi.fn(),
  useOrgRoots: vi.fn(),
  useDirectReports: vi.fn(),
  useUserTeam: vi.fn(),
}));

vi.mock("./api", () => ({
  fetchDirectory: vi.fn(),
  fetchDepartments: vi.fn(),
  fetchOrgRoots: vi.fn(),
  fetchDirectReports: vi.fn(),
  fetchUserTeam: vi.fn(),
}));

describe("React Testing Library: DirectoryPage & Org Chart Feature", () => {
  let queryClient: QueryClient;

  const mockCurrentUser = {
    id: "usr-emp-1",
    name: "John Employee",
    email: "john@nexusops.ai",
    role: "EMPLOYEE" as const,
  };

  const mockDepartments: DepartmentSummary[] = [
    { id: "dept-eng", name: "Engineering", userCount: 4 },
    { id: "dept-ops", name: "Operations", userCount: 2 },
  ];

  const mockDirectoryUsers: DirectoryUser[] = [
    {
      id: "u-1",
      name: "Alice Head",
      email: "alice.head@nexusops.ai",
      role: "ADMIN",
      isActive: true,
      departmentId: "dept-eng",
      department: { id: "dept-eng", name: "Engineering" },
      managerId: null,
      manager: null,
      directReportsCount: 2,
      createdAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "u-2",
      name: "Bob Manager",
      email: "bob.mgr@nexusops.ai",
      role: "MANAGER",
      isActive: true,
      departmentId: "dept-eng",
      department: { id: "dept-eng", name: "Engineering" },
      managerId: "u-1",
      manager: {
        id: "u-1",
        name: "Alice Head",
        email: "alice.head@nexusops.ai",
        role: "ADMIN",
      },
      directReportsCount: 1,
      createdAt: "2026-02-01T00:00:00Z",
    },
    {
      id: "u-3",
      name: "Charlie Solo",
      email: "charlie@nexusops.ai",
      role: "EMPLOYEE",
      isActive: true,
      departmentId: "dept-ops",
      department: { id: "dept-ops", name: "Operations" },
      managerId: null, // User without a manager
      manager: null,
      directReportsCount: 0,
      createdAt: "2026-03-01T00:00:00Z",
    },
  ];

  const mockTeamBob: TeamData = {
    user: mockDirectoryUsers[1],
    manager: mockDirectoryUsers[0],
    peers: [],
    directReports: [
      {
        id: "u-4",
        name: "Dave Dev",
        email: "dave.dev@nexusops.ai",
        role: "EMPLOYEE",
        isActive: true,
        departmentId: "dept-eng",
        department: { id: "dept-eng", name: "Engineering" },
        managerId: "u-2",
        manager: {
          id: "u-2",
          name: "Bob Manager",
          email: "bob.mgr@nexusops.ai",
          role: "MANAGER",
        },
        directReportsCount: 0,
        createdAt: "2026-04-01T00:00:00Z",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    (AuthContextModule.useAuth as any).mockReturnValue({
      user: mockCurrentUser,
      role: "EMPLOYEE",
      isAuthenticated: true,
      isLoading: false,
    });

    (DirectoryHooksModule.useDirectoryDepartments as any).mockReturnValue({
      data: mockDepartments,
      isLoading: false,
    });

    (DirectoryHooksModule.useDirectory as any).mockReturnValue({
      data: {
        users: mockDirectoryUsers,
        total: mockDirectoryUsers.length,
        page: 1,
        limit: 12,
        totalPages: 1,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isFetching: false,
    });

    (DirectoryHooksModule.useUserTeam as any).mockImplementation((userId: string | null) => {
      if (userId === "u-2") {
        return { data: mockTeamBob, isLoading: false, isError: false };
      }
      return {
        data: {
          user: mockDirectoryUsers[0],
          manager: null,
          peers: [],
          directReports: [mockDirectoryUsers[1]],
        },
        isLoading: false,
        isError: false,
      };
    });

    (DirectoryApiModule.fetchOrgRoots as any).mockResolvedValue([
      mockDirectoryUsers[0], // Alice (has reports)
      mockDirectoryUsers[2], // Charlie (no manager, 0 reports)
    ]);

    (DirectoryApiModule.fetchDirectReports as any).mockResolvedValue([
      mockDirectoryUsers[1], // Bob
    ]);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DirectoryPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("renders page title, search bar, filters, and profile cards in Grid View", () => {
    renderComponent();

    expect(screen.getByRole("heading", { name: /company directory/i })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/search by name, email, department or role/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/filter by department/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filter by role/i)).toBeInTheDocument();

    // Verify all 3 users rendered in profile cards
    expect(screen.getByRole("heading", { name: "Alice Head" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bob Manager" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Charlie Solo" })).toBeInTheDocument();

    // Verify department and manager details on cards
    expect(screen.getAllByText("Engineering").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.queryByText("Reports to Bob Manager")).toBeNull();
    expect(screen.getByText(/reports to/i)).toBeInTheDocument();
  });

  it("toggles smoothly between Grid View and Table View", async () => {
    const user = userEvent.setup();
    renderComponent();

    // Switch to Table view
    const tableToggleBtn = screen.getByRole("button", { name: /switch to table view/i });
    await user.click(tableToggleBtn);

    // Verify table headers exist
    expect(screen.getByRole("columnheader", { name: /employee/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /role/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /department/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /reporting manager/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /direct reports/i })).toBeInTheDocument();

    // Switch back to Grid view
    const gridToggleBtn = screen.getByRole("button", { name: /switch to grid view/i });
    await user.click(gridToggleBtn);

    // Profile card element exists
    expect(screen.getByLabelText(/profile card for alice head/i)).toBeInTheDocument();
  });

  it("copies email to clipboard and displays feedback", async () => {
    const user = userEvent.setup();
    const clipboardSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();

    renderComponent();

    const copyBtn = screen.getByLabelText(/copy email address for bob manager/i);
    await user.click(copyBtn);

    expect(clipboardSpy).toHaveBeenCalledWith("bob.mgr@nexusops.ai");
    expect(screen.getByLabelText(/copied email/i)).toBeInTheDocument();
  });

  it("clicking 'View Team' opens the Team Members popover with reporting lines", async () => {
    const user = userEvent.setup();
    renderComponent();

    const viewTeamBtn = screen.getByLabelText(/view team of bob manager/i);
    await user.click(viewTeamBtn);

    // Dialog opens
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Team Members & Reporting Line")).toBeInTheDocument();
    expect(screen.getByText(/organizational team context for bob manager/i)).toBeInTheDocument();

    // Shows Reporting Manager (Alice Head)
    expect(screen.getAllByText("Alice Head").length).toBeGreaterThanOrEqual(1);

    // Shows Direct Report (Dave Dev)
    expect(screen.getByText("Dave Dev")).toBeInTheDocument();

    // Close button dismisses dialog
    const closeBtn = screen.getByRole("button", { name: /^close$/i });
    await user.click(closeBtn);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("switches to Org Chart tab, renders leadership branches, and lazy-loads children on expand", async () => {
    const user = userEvent.setup();
    renderComponent();

    // Switch to Org Chart tab
    const orgTab = screen.getByRole("tab", { name: /org chart/i });
    await user.click(orgTab);

    // Verify Org Chart sections
    await waitFor(() => {
      expect(screen.getByText(/department heads & leadership trees/i)).toBeInTheDocument();
      expect(screen.getByText(/individual members without a reporting manager/i)).toBeInTheDocument();
    });

    // Alice is in leaders section
    expect(screen.getByText("Alice Head")).toBeInTheDocument();
    // Charlie (no manager, 0 reports) is in individual members section
    expect(screen.getByText("Charlie Solo")).toBeInTheDocument();

    // Expand Alice to lazy-load reports
    const expandBtn = screen.getByRole("button", {
      name: /expand 2 reports for alice head/i,
    });
    await user.click(expandBtn);

    // Calls fetchDirectReports API with Alice's ID
    expect(DirectoryApiModule.fetchDirectReports).toHaveBeenCalledWith("u-1");

    // Child Bob Manager is now rendered under Alice
    await waitFor(() => {
      expect(screen.getAllByText("Bob Manager").length).toBeGreaterThan(0);
    });
  });

  it("handles empty search results state with reset filter action", async () => {
    (DirectoryHooksModule.useDirectory as any).mockReturnValue({
      data: {
        users: [],
        total: 0,
        page: 1,
        limit: 12,
        totalPages: 0,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isFetching: false,
    });

    renderComponent();

    expect(screen.getByText("No employees found")).toBeInTheDocument();
  });

  it("handles error state and provides a retry button", async () => {
    const mockRefetch = vi.fn();
    (DirectoryHooksModule.useDirectory as any).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
      isFetching: false,
    });

    const user = userEvent.setup();
    renderComponent();

    expect(screen.getByText(/failed to load directory members/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    await user.click(retryBtn);

    expect(mockRefetch).toHaveBeenCalled();
  });
});
