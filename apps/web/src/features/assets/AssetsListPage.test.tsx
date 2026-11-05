import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "../../components/ui/toast";
import { AssetsListPage } from "./AssetsListPage";
import { MyAssignedAssetsTab } from "./MyAssignedAssetsTab";
import * as AuthContextModule from "../auth/AuthContext";
import { assetsApi } from "./api";
import type { Asset } from "./types";

vi.mock("../auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("./api", () => ({
  assetsApi: {
    list: vi.fn(),
    getMyAssets: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    assign: vi.fn(),
    returnAsset: vi.fn(),
    retire: vi.fn(),
    getAssignableUsers: vi.fn(),
  },
}));

const mockAssets: Asset[] = [
  {
    id: "asset-1",
    name: "MacBook Pro 16 M3 Max",
    type: "LAPTOP",
    serialNumber: "MBP-2026-001",
    status: "ASSIGNED",
    purchaseDate: "2024-01-15T00:00:00.000Z",
    warrantyExpiresAt: new Date(Date.now() + 15 * 86400 * 1000).toISOString(), // Expiring in 15 days
    notes: "Assigned for development work",
    createdAt: "2024-01-15T00:00:00.000Z",
    updatedAt: "2024-01-15T00:00:00.000Z",
    currentAssignment: {
      id: "asgn-1",
      assetId: "asset-1",
      userId: "user-1",
      assignedById: "admin-1",
      assignedAt: "2024-01-20T00:00:00.000Z",
      returnedAt: null,
      requestId: "req-1",
      notes: "Dev assignment",
      createdAt: "2024-01-20T00:00:00.000Z",
      updatedAt: "2024-01-20T00:00:00.000Z",
      user: {
        id: "user-1",
        name: "Alice Developer",
        email: "alice@company.com",
        role: "EMPLOYEE",
        department: { id: "dept-1", name: "Engineering" },
      },
      assignedBy: {
        id: "admin-1",
        name: "Admin User",
        email: "admin@company.com",
      },
    },
    assignments: [
      {
        id: "asgn-1",
        assetId: "asset-1",
        userId: "user-1",
        assignedById: "admin-1",
        assignedAt: "2024-01-20T00:00:00.000Z",
        returnedAt: null,
        requestId: "req-1",
        notes: "Dev assignment",
        createdAt: "2024-01-20T00:00:00.000Z",
        updatedAt: "2024-01-20T00:00:00.000Z",
        user: {
          id: "user-1",
          name: "Alice Developer",
          email: "alice@company.com",
          role: "EMPLOYEE",
        },
        assignedBy: {
          id: "admin-1",
          name: "Admin User",
          email: "admin@company.com",
        },
      },
    ],
  },
  {
    id: "asset-2",
    name: 'Dell UltraSharp 27" 4K',
    type: "MONITOR",
    serialNumber: "DELL-MON-442",
    status: "AVAILABLE",
    purchaseDate: "2024-02-10T00:00:00.000Z",
    warrantyExpiresAt: "2027-02-10T00:00:00.000Z", // Valid
    notes: "Spare desk monitor",
    createdAt: "2024-02-10T00:00:00.000Z",
    updatedAt: "2024-02-10T00:00:00.000Z",
    currentAssignment: null,
    assignments: [],
  },
  {
    id: "asset-3",
    name: "Apple Magic Keyboard",
    type: "ACCESSORY",
    serialNumber: null,
    status: "RETIRED",
    purchaseDate: "2022-01-10T00:00:00.000Z",
    warrantyExpiresAt: "2023-01-10T00:00:00.000Z", // Expired
    notes: "Key switches damaged",
    createdAt: "2022-01-10T00:00:00.000Z",
    updatedAt: "2024-03-01T00:00:00.000Z",
    currentAssignment: null,
    assignments: [],
  },
];

describe("AssetsListPage and MyAssignedAssetsTab Features", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    (assetsApi.list as any).mockResolvedValue({
      data: mockAssets,
      pagination: {
        total: mockAssets.length,
        page: 1,
        limit: 25,
        totalPages: 1,
      },
    });

    (assetsApi.getMyAssets as any).mockResolvedValue([mockAssets[0]]);
    (assetsApi.getAssignableUsers as any).mockResolvedValue([
      { id: "user-1", name: "Alice Developer", email: "alice@company.com" },
    ]);
  });

  const renderListPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <AssetsListPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

  const renderMyAssetsTab = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <MyAssignedAssetsTab />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

  it("renders page header, search input, and assets inventory table for Admin", async () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "admin-1", name: "Admin IT", email: "admin@company.com", role: "ADMIN" },
      role: "ADMIN",
    });

    renderListPage();

    expect(screen.getByText("Hardware & Asset Inventory")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search serial, name, assignee/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add asset/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("MacBook Pro 16 M3 Max")).toBeInTheDocument();
      expect(screen.getByText('Dell UltraSharp 27" 4K')).toBeInTheDocument();
      expect(screen.getByText("Apple Magic Keyboard")).toBeInTheDocument();
    });

    // Check serial numbers
    expect(screen.getByText("MBP-2026-001")).toBeInTheDocument();
    expect(screen.getByText("DELL-MON-442")).toBeInTheDocument();

    // Check status chips
    expect(screen.getAllByText("Assigned").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Available").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Retired").length).toBeGreaterThanOrEqual(1);

    // Check warranty badges
    expect(screen.getAllByText(/Expiring/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Expired/i).length).toBeGreaterThanOrEqual(1);
  });

  it("hides 'Add Asset' button when user is an Employee", async () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "user-1", name: "Alice Developer", email: "alice@company.com", role: "EMPLOYEE" },
      role: "EMPLOYEE",
    });

    renderListPage();

    await waitFor(() => {
      expect(screen.getByText("MacBook Pro 16 M3 Max")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /add asset/i })).not.toBeInTheDocument();
  });

  it("filters assets by type selection", async () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "admin-1", name: "Admin IT", email: "admin@company.com", role: "ADMIN" },
      role: "ADMIN",
    });

    renderListPage();

    await waitFor(() => {
      expect(screen.getByText("MacBook Pro 16 M3 Max")).toBeInTheDocument();
    });

    const typeSelect = screen.getByLabelText(/filter by type/i);
    fireEvent.change(typeSelect, { target: { value: "MONITOR" } });

    await waitFor(() => {
      expect(assetsApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ type: "MONITOR" })
      );
    });
  });

  it("filters assets by status selection", async () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "admin-1", name: "Admin IT", email: "admin@company.com", role: "ADMIN" },
      role: "ADMIN",
    });

    renderListPage();

    await waitFor(() => {
      expect(screen.getByText("MacBook Pro 16 M3 Max")).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText(/filter by status/i);
    fireEvent.change(statusSelect, { target: { value: "AVAILABLE" } });

    await waitFor(() => {
      expect(assetsApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: "AVAILABLE" })
      );
    });
  });

  it("opens AssetDetailDrawer slide-over upon clicking a row and shows full details and assignment history", async () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "admin-1", name: "Admin IT", email: "admin@company.com", role: "ADMIN" },
      role: "ADMIN",
    });

    renderListPage();

    await waitFor(() => {
      expect(screen.getByText("MacBook Pro 16 M3 Max")).toBeInTheDocument();
    });

    // Click on the row
    const row = screen.getByText("MacBook Pro 16 M3 Max").closest("tr");
    expect(row).toBeInTheDocument();
    fireEvent.click(row!);

    // Slide over drawer opens
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Verify detail drawer elements
    expect(within(dialog).getByText(/Current Assignee/i)).toBeInTheDocument();
    expect(within(dialog).getAllByText(/Alice Developer/i).length).toBeGreaterThanOrEqual(1);
    expect(within(dialog).getByText(/Assignment History/i)).toBeInTheDocument();

    // Verify action buttons for Admin (since status is ASSIGNED: Return Asset button should be present)
    expect(within(dialog).getByRole("button", { name: /return/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
  });

  it("renders 'My Assigned Assets' tab correctly with assigned items", async () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "user-1", name: "Alice Developer", email: "alice@company.com", role: "EMPLOYEE" },
      role: "EMPLOYEE",
    });

    renderMyAssetsTab();

    await waitFor(() => {
      expect(screen.getByText("MacBook Pro 16 M3 Max")).toBeInTheDocument();
    });

    expect(screen.getByText(/Serial: MBP-2026-001/i)).toBeInTheDocument();
    expect(screen.getByText(/Expiring/i)).toBeInTheDocument();
    expect(screen.getByText(/Dev assignment/i)).toBeInTheDocument();
  });

  it("renders empty state in 'My Assigned Assets' when user has no assigned hardware", async () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "user-2", name: "Bob Newhire", email: "bob@company.com", role: "EMPLOYEE" },
      role: "EMPLOYEE",
    });

    (assetsApi.getMyAssets as any).mockResolvedValue([]);

    renderMyAssetsTab();

    await waitFor(() => {
      expect(screen.getByText("No Assets Assigned")).toBeInTheDocument();
      expect(
        screen.getByText("You do not currently have any IT hardware, displays, or software licenses assigned to your account.")
      ).toBeInTheDocument();
    });
  });
});
