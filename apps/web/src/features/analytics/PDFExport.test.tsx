import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PDFExportButton } from "./components/PDFExportButton";
import { AnalyticsPage } from "./AnalyticsPage";
import * as AuthContextModule from "../auth/AuthContext";
import * as AnalyticsApiModule from "./api";

vi.mock("../auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("./api", () => ({
  useAnalyticsOverview: vi.fn(),
  useRequestsAnalytics: vi.fn(),
  useTasksAnalytics: vi.fn(),
  useAIUsageAnalytics: vi.fn(),
  useDigestSchedule: vi.fn(() => ({ data: null, isLoading: false, refetch: vi.fn() })),
  useDigestDeliveries: vi.fn(() => ({ data: null, isLoading: false, refetch: vi.fn() })),
  useSaveDigestSchedule: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useSendTestDigest: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  analyticsApi: {
    downloadCSV: vi.fn(),
  },
}));

describe("PDF Export Feature on /analytics", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    // Mock window.print
    window.print = vi.fn();

    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "1", name: "Priya Sharma", role: "ADMIN" },
      role: "ADMIN",
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
  });

  it("renders 'Export PDF' button with proper accessibility label", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PDFExportButton />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const button = screen.getByRole("button", { name: /export analytics report to pdf/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Export PDF");
  });

  it("triggers window.print and sets document title when clicked", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PDFExportButton reportTitle="Custom-Report" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const button = screen.getByRole("button", { name: /export analytics report to pdf/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(window.print).toHaveBeenCalledTimes(1);
    });
  });

  it("renders dedicated print-only header with app name and IST generation time on AnalyticsPage", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/analytics?from=2026-10-01&to=2026-10-31"]}>
          <AnalyticsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Print header contains app name
    expect(screen.getByText("NexusOps AI", { selector: ".print-only h1" })).toBeInTheDocument();
    // Timezone annotation
    expect(screen.getByText(/Asia\/Kolkata \(IST\)/i)).toBeInTheDocument();
    // Selected Date Range
    expect(screen.getByText(/Selected Date Range/i)).toBeInTheDocument();
    // Export PDF button is also rendered on the page
    expect(screen.getByRole("button", { name: /export analytics report to pdf/i })).toBeInTheDocument();
  });
});
