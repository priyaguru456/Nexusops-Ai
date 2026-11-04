import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardPage, getKolkataGreeting } from "./DashboardPage";
import * as AuthContextModule from "../features/auth/AuthContext";
import * as TasksHooksModule from "../features/tasks/hooks";
import * as ApprovalsApiModule from "../features/approvals/api";
import * as AnalyticsApiModule from "../features/analytics/api";
import * as NotificationsHooksModule from "../features/notifications/hooks";

vi.mock("../features/auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../features/tasks/hooks", () => ({
  useTasks: vi.fn(),
}));

vi.mock("../features/approvals/api", () => ({
  approvalsApi: {
    getPending: vi.fn(),
  },
}));

vi.mock("../features/analytics/api", () => ({
  useAnalyticsOverview: vi.fn(),
}));

vi.mock("../features/notifications/hooks", () => ({
  useNotifications: vi.fn(),
  useMarkNotificationAsRead: () => ({ mutateAsync: vi.fn() }),
  useMarkAllNotificationsAsRead: () => ({ mutateAsync: vi.fn() }),
}));

describe("Dashboard Greeting and Real Metric Badges", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    (AnalyticsApiModule.useAnalyticsOverview as any).mockReturnValue({
      data: {
        totals: { totalRequests: 10, open: 2, completed: 8 },
        tasks: { total: 5, done: 3, overdue: 0 },
        performance: { avgApprovalTimeHours: 2, avgCompletionTimeHours: 5 },
        requestsByCategory: [],
        requestsOverTime: [],
      },
      isLoading: false,
      isError: false,
    });

    (NotificationsHooksModule.useNotifications as any).mockReturnValue({
      data: { notifications: [], unreadCount: 0 },
      isLoading: false,
    });
  });

  describe("getKolkataGreeting (Asia/Kolkata timezone)", () => {
    it("returns 'Good morning' between 05:00 and 11:59 IST", () => {
      // 09:30 AM IST is 04:00 UTC
      const morningDate = new Date("2026-11-03T04:00:00Z");
      expect(getKolkataGreeting(morningDate)).toBe("Good morning");

      // 05:01 AM IST is 23:31 UTC previous day
      const earlyMorning = new Date("2026-11-02T23:31:00Z");
      expect(getKolkataGreeting(earlyMorning)).toBe("Good morning");
    });

    it("returns 'Good afternoon' between 12:00 and 16:59 IST", () => {
      // 02:00 PM (14:00) IST is 08:30 UTC
      const afternoonDate = new Date("2026-11-03T08:30:00Z");
      expect(getKolkataGreeting(afternoonDate)).toBe("Good afternoon");

      // 04:59 PM (16:59) IST is 11:29 UTC
      const lateAfternoon = new Date("2026-11-03T11:29:00Z");
      expect(getKolkataGreeting(lateAfternoon)).toBe("Good afternoon");
    });

    it("returns 'Good evening' from 17:00 IST onwards or night", () => {
      // 05:30 PM (17:30) IST is 12:00 UTC
      const eveningDate = new Date("2026-11-03T12:00:00Z");
      expect(getKolkataGreeting(eveningDate)).toBe("Good evening");

      // 10:00 PM (22:00) IST is 16:30 UTC
      const nightDate = new Date("2026-11-03T16:30:00Z");
      expect(getKolkataGreeting(nightDate)).toBe("Good evening");

      // 02:00 AM IST is 20:30 UTC previous day
      const lateNightDate = new Date("2026-11-02T20:30:00Z");
      expect(getKolkataGreeting(lateNightDate)).toBe("Good evening");
    });
  });

  describe("DashboardPage component rendering", () => {
    it("renders greeting with user's name", () => {
      (AuthContextModule.useAuth as any).mockReturnValue({
        user: { id: "u-1", name: "Priya Sharma", role: "EMPLOYEE" },
        role: "EMPLOYEE",
      });
      (TasksHooksModule.useTasks as any).mockReturnValue({
        data: { tasks: [] },
        isLoading: false,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DashboardPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Priya Sharma/i);
    });

    it("shows tasks due today badge when user has tasks due today", () => {
      (AuthContextModule.useAuth as any).mockReturnValue({
        user: { id: "u-1", name: "Priya Sharma", role: "EMPLOYEE" },
        role: "EMPLOYEE",
      });

      // Today in Kolkata
      const now = new Date();
      const todayIso = now.toISOString();

      (TasksHooksModule.useTasks as any).mockReturnValue({
        data: {
          tasks: [
            {
              id: "t-1",
              title: "Complete security compliance check",
              status: "IN_PROGRESS",
              dueDate: todayIso,
            },
          ],
        },
        isLoading: false,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DashboardPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText(/1 task due today/i)).toBeInTheDocument();
    });

    it("hides tasks due today badge when count is 0", () => {
      (AuthContextModule.useAuth as any).mockReturnValue({
        user: { id: "u-1", name: "Priya Sharma", role: "EMPLOYEE" },
        role: "EMPLOYEE",
      });

      (TasksHooksModule.useTasks as any).mockReturnValue({
        data: {
          tasks: [
            {
              id: "t-1",
              title: "Future task",
              status: "TODO",
              dueDate: "2030-01-01T00:00:00Z",
            },
          ],
        },
        isLoading: false,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DashboardPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.queryByText(/due today/i)).not.toBeInTheDocument();
    });

    it("shows 'requests awaiting my approval' badge for MANAGER when pending steps > 0", async () => {
      (AuthContextModule.useAuth as any).mockReturnValue({
        user: { id: "m-1", name: "Rajesh Kumar", role: "MANAGER" },
        role: "MANAGER",
      });
      (TasksHooksModule.useTasks as any).mockReturnValue({
        data: { tasks: [] },
        isLoading: false,
      });

      (ApprovalsApiModule.approvalsApi.getPending as any).mockResolvedValue({
        steps: [
          { id: "step-1", status: "PENDING" },
          { id: "step-2", status: "PENDING" },
        ],
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DashboardPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(await screen.findByText(/2 requests awaiting my approval/i)).toBeInTheDocument();
    });

    it("hides 'requests awaiting my approval' badge for EMPLOYEE even if pending steps exist", () => {
      (AuthContextModule.useAuth as any).mockReturnValue({
        user: { id: "e-1", name: "Employee User", role: "EMPLOYEE" },
        role: "EMPLOYEE",
      });
      (TasksHooksModule.useTasks as any).mockReturnValue({
        data: { tasks: [] },
        isLoading: false,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DashboardPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.queryByText(/awaiting my approval/i)).not.toBeInTheDocument();
      expect(ApprovalsApiModule.approvalsApi.getPending).not.toHaveBeenCalled();
    });
  });
});
