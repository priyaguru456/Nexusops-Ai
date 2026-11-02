import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "./AppLayout";
import * as AuthContextModule from "../../features/auth/AuthContext";

vi.mock("../../features/auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

// Mock NotificationBell to avoid complex query fetching in layout test
vi.mock("../../features/notifications/NotificationBell", () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

describe("React Testing Library: Role-based Sidebar Navigation Menu", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const renderLayout = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("renders exact menu items for EMPLOYEE role", () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "1", name: "Eve Employee", email: "eve@test.com", role: "EMPLOYEE" },
      role: "EMPLOYEE",
      logout: vi.fn(),
    });

    renderLayout();

    // Exact expected items
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /work requests/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /tasks/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /knowledge base/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ai assistant/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /analytics/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();

    // Restricted items must NOT be rendered
    expect(screen.queryByRole("link", { name: /approvals/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /user management/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /audit logs/i })).not.toBeInTheDocument();
  });

  it("renders exact menu items for MANAGER role", () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "2", name: "Mike Manager", email: "mike@test.com", role: "MANAGER" },
      role: "MANAGER",
      logout: vi.fn(),
    });

    renderLayout();

    // Manager has Approvals in addition to employee items
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /work requests/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /tasks/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /knowledge base/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ai assistant/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /approvals/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /analytics/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();

    // Admin-only items must NOT be rendered
    expect(screen.queryByRole("link", { name: /user management/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /audit logs/i })).not.toBeInTheDocument();
  });

  it("renders exact full menu items for ADMIN role", () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "3", name: "Adam Admin", email: "adam@test.com", role: "ADMIN" },
      role: "ADMIN",
      logout: vi.fn(),
    });

    renderLayout();

    // Admin sees all 10 navigation items
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /work requests/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /tasks/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /knowledge base/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ai assistant/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /approvals/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /analytics/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /user management/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /audit logs/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });
});
