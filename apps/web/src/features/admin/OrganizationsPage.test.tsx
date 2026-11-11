import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { OrganizationsPage } from "./OrganizationsPage";
import * as HooksModule from "./hooks";
import type { OrganizationRecord } from "./organizations.api";

vi.mock("./hooks", () => ({
  useOrganizations: vi.fn(),
  useCreateOrganization: vi.fn(),
  useUpdateOrganization: vi.fn(),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

const mockOrgs: OrganizationRecord[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "NexusOps Default",
    slug: "default",
    isActive: true,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    _count: { users: 12, departments: 5, workRequests: 24, documents: 8 },
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Beta Labs",
    slug: "beta-labs",
    isActive: false,
    createdAt: "2026-11-05T00:00:00.000Z",
    updatedAt: "2026-11-05T00:00:00.000Z",
    _count: { users: 3, departments: 1, workRequests: 4, documents: 1 },
  },
];

describe("OrganizationsPage", () => {
  const createMutateAsync = vi.fn();
  const updateMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(HooksModule.useOrganizations).mockReturnValue({
      data: {
        items: mockOrgs,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof HooksModule.useOrganizations>);

    vi.mocked(HooksModule.useCreateOrganization).mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof HooksModule.useCreateOrganization>);

    vi.mocked(HooksModule.useUpdateOrganization).mockReturnValue({
      mutateAsync: updateMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof HooksModule.useUpdateOrganization>);
  });

  it("renders organization list with usage counts and status badges", () => {
    render(
      <MemoryRouter>
        <OrganizationsPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Organizations")).toBeInTheDocument();
    expect(screen.getByText("NexusOps Default")).toBeInTheDocument();
    expect(screen.getByText("@default")).toBeInTheDocument();
    expect(screen.getByText("Beta Labs")).toBeInTheDocument();
    expect(screen.getByText("@beta-labs")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Suspended")).toBeInTheDocument();
  });

  it("auto-generates slug and submits new organization with optional initial admin", async () => {
    const user = userEvent.setup();
    createMutateAsync.mockResolvedValueOnce({
      organization: { id: "org-3", name: "Acme Corp", slug: "acme-corp", isActive: true },
      initialAdmin: { id: "u-9", name: "Jane Doe", email: "jane@acme.com", role: "ADMIN" },
    });

    render(
      <MemoryRouter>
        <OrganizationsPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /new organization/i }));

    await user.type(screen.getByLabelText(/organization name/i), "Acme Corp");
    expect(screen.getByLabelText(/workspace slug/i)).toHaveValue("acme-corp");

    await user.click(screen.getByLabelText(/provision an initial organization admin user/i));
    await user.type(screen.getByLabelText(/admin name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/admin email/i), "jane@acme.com");
    await user.type(screen.getByLabelText(/temporary password/i), "SecurePass123!");

    await user.click(screen.getByRole("button", { name: /create organization/i }));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith({
        name: "Acme Corp",
        slug: "acme-corp",
        adminName: "Jane Doe",
        adminEmail: "jane@acme.com",
        adminPassword: "SecurePass123!",
      });
    });
  });

  it("confirms and suspends an active organization", async () => {
    const user = userEvent.setup();
    updateMutateAsync.mockResolvedValueOnce({
      organization: { ...mockOrgs[0], isActive: false },
    });

    render(
      <MemoryRouter>
        <OrganizationsPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /suspend nexusops default/i }));
    expect(screen.getByText(/suspend organization/i)).toBeInTheDocument();

    const confirmButtons = screen.getAllByRole("button", { name: /^suspend$/i });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalledWith({
        id: "00000000-0000-4000-8000-000000000001",
        payload: { isActive: false },
      });
    });
  });
});
