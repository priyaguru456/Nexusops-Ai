import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnalyticsPage } from "./AnalyticsPage";
import { DigestScheduleModal } from "./components/DigestScheduleModal";
import * as AuthContextModule from "../auth/AuthContext";
import * as AnalyticsApiModule from "./api";

vi.mock("../auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("./components/Charts", () => ({
  TimeSeriesChart: () => <div data-testid="chart-timeseries" />,
  CategoryPieChart: () => <div data-testid="chart-pie" />,
  SimpleBarChart: () => <div data-testid="chart-bar" />,
  TopDocumentsChart: () => <div data-testid="chart-docs" />,
  EmptyChartState: () => <div data-testid="chart-empty" />,
}));

vi.mock("./api", () => ({
  useAnalyticsOverview: vi.fn(),
  useRequestsAnalytics: vi.fn(),
  useTasksAnalytics: vi.fn(),
  useAIUsageAnalytics: vi.fn(),
  useDigestSchedule: vi.fn(),
  useDigestDeliveries: vi.fn(),
  useSaveDigestSchedule: vi.fn(),
  useSendTestDigest: vi.fn(),
  analyticsApi: {
    downloadCSV: vi.fn(),
  },
}));

describe("Weekly Email Digest Feature", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    (AnalyticsApiModule.useAnalyticsOverview as any).mockReturnValue({
      data: {
        totals: { totalRequests: 42, open: 12, approved: 20, completed: 18 },
        tasks: { total: 30, todo: 5, inProgress: 10, blocked: 2, done: 13, overdue: 1 },
        performance: { avgApprovalTimeHours: 3.5, avgCompletionTimeHours: 12.0 },
        requestsByCategory: [{ category: "IT_EQUIPMENT", count: 20 }],
        requestsOverTime: [{ date: "2026-11-01", count: 5 }],
      },
      isLoading: false,
      isError: false,
    });

    (AnalyticsApiModule.useRequestsAnalytics as any).mockReturnValue({
      data: null,
      isLoading: false,
    });

    (AnalyticsApiModule.useTasksAnalytics as any).mockReturnValue({
      data: null,
      isLoading: false,
    });

    (AnalyticsApiModule.useAIUsageAnalytics as any).mockReturnValue({
      data: null,
      isLoading: false,
    });

    (AnalyticsApiModule.useDigestSchedule as any).mockReturnValue({
      data: {
        id: "sched-101",
        recipients: ["admin@nexusops.com", "lead@nexusops.com"],
        frequency: "WEEKLY",
        dayOfWeek: 1,
        hour: 9,
        timezone: "Asia/Kolkata",
        isActive: true,
        lastRunAt: "2026-10-26T03:30:00.000Z",
      },
      isLoading: false,
      refetch: vi.fn(),
    });

    (AnalyticsApiModule.useDigestDeliveries as any).mockReturnValue({
      data: {
        deliveries: [
          {
            id: "deliv-1",
            scheduleId: "sched-101",
            sentAt: "2026-10-26T03:30:00.000Z",
            status: "SUCCESS",
            error: null,
            recipientCount: 2,
            createdAt: "2026-10-26T03:30:00.000Z",
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      },
      isLoading: false,
      refetch: vi.fn(),
    });

    (AnalyticsApiModule.useSaveDigestSchedule as any).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ success: true }),
      isPending: false,
    });

    (AnalyticsApiModule.useSendTestDigest as any).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ success: true, deliveryId: "deliv-test-1" }),
      isPending: false,
    });
  });

  describe("Role-Based Visibility on /analytics", () => {
    it("renders 'Schedule Weekly Digest' button when authenticated as ADMIN", () => {
      (AuthContextModule.useAuth as any).mockReturnValue({
        user: { id: "usr-admin", name: "Admin User", role: "ADMIN", email: "admin@nexusops.com" },
        role: "ADMIN",
        isAuthenticated: true,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AnalyticsPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const digestBtn = screen.getByRole("button", { name: /schedule weekly digest/i });
      expect(digestBtn).toBeInTheDocument();
    });

    it("hides 'Schedule Weekly Digest' button when user is EMPLOYEE", () => {
      (AuthContextModule.useAuth as any).mockReturnValue({
        user: { id: "usr-emp", name: "Employee User", role: "EMPLOYEE", email: "emp@nexusops.com" },
        role: "EMPLOYEE",
        isAuthenticated: true,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AnalyticsPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const digestBtn = screen.queryByRole("button", { name: /schedule weekly digest/i });
      expect(digestBtn).not.toBeInTheDocument();
    });

    it("hides 'Schedule Weekly Digest' button when user is MANAGER", () => {
      (AuthContextModule.useAuth as any).mockReturnValue({
        user: { id: "usr-mgr", name: "Manager User", role: "MANAGER", email: "mgr@nexusops.com" },
        role: "MANAGER",
        isAuthenticated: true,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AnalyticsPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const digestBtn = screen.queryByRole("button", { name: /schedule weekly digest/i });
      expect(digestBtn).not.toBeInTheDocument();
    });
  });

  describe("DigestScheduleModal Component", () => {
    it("renders modal with recipients chips, day selector, hour selector, and send test email button", () => {
      const handleClose = vi.fn();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DigestScheduleModal isOpen={true} onClose={handleClose} />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText("Weekly Analytics Email Digest")).toBeInTheDocument();
      expect(screen.getByLabelText(/day of the week/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/delivery time/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /send test email now/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /save schedule/i })).toBeInTheDocument();

      // Check recipient chips
      expect(screen.getByText("admin@nexusops.com")).toBeInTheDocument();
      expect(screen.getByText("lead@nexusops.com")).toBeInTheDocument();
    });

    it("validates recipient email and shows error when adding invalid email", () => {
      const handleClose = vi.fn();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DigestScheduleModal isOpen={true} onClose={handleClose} />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const emailInput = screen.getByPlaceholderText(/director@nexusops.com/i);
      const addBtn = screen.getByRole("button", { name: /add/i });

      fireEvent.change(emailInput, { target: { value: "invalid-email-format" } });
      fireEvent.click(addBtn);

      expect(screen.getByText("Please enter a valid email address.")).toBeInTheDocument();
    });

    it("adds a valid recipient and clears error", () => {
      const handleClose = vi.fn();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DigestScheduleModal isOpen={true} onClose={handleClose} />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const emailInput = screen.getByPlaceholderText(/director@nexusops.com/i);
      const addBtn = screen.getByRole("button", { name: /add/i });

      fireEvent.change(emailInput, { target: { value: "new.executive@nexusops.com" } });
      fireEvent.click(addBtn);

      expect(screen.getByText("new.executive@nexusops.com")).toBeInTheDocument();
    });

    it("switches to Delivery History tab and renders past deliveries table", () => {
      const handleClose = vi.fn();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DigestScheduleModal isOpen={true} onClose={handleClose} />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const historyTab = screen.getByRole("tab", { name: /delivery history/i });
      fireEvent.click(historyTab);

      expect(screen.getByText("Log of automated and manual test digest dispatches.")).toBeInTheDocument();
      expect(screen.getByText("Success")).toBeInTheDocument();
      expect(screen.getByText("2 recipients")).toBeInTheDocument();
    });

    it("closes modal when pressing Escape key", () => {
      const handleClose = vi.fn();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DigestScheduleModal isOpen={true} onClose={handleClose} />
          </MemoryRouter>
        </QueryClientProvider>
      );

      fireEvent.keyDown(window, { key: "Escape" });
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
