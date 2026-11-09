import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "../../components/ui/toast";
import { CalendarPage } from "./CalendarPage";
import { calendarApi } from "./calendarApi";
import * as AuthContextModule from "../auth/AuthContext";
import type { CalendarEventsResponse } from "../../types/calendar";

vi.mock("./calendarApi", () => ({
  calendarApi: {
    getEvents: vi.fn(),
    addHoliday: vi.fn(),
    updateHoliday: vi.fn(),
    deleteHoliday: vi.fn(),
  },
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const mockCalendarData: CalendarEventsResponse = {
  events: [
    {
      id: "task-1",
      rawId: "task-1",
      title: "Quarterly Tax Audit Task",
      type: "TASK",
      start: "2026-11-05T10:00:00.000Z",
      end: "2026-11-05T10:00:00.000Z",
      allDay: false,
      colorKey: "tasks",
      details: {
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeName: "Priya Sharma",
        link: "/tasks",
      },
    },
    {
      id: "request-1",
      rawId: "request-1",
      title: "Ergonomic Chairs Request",
      type: "REQUEST",
      start: "2026-11-06T15:00:00.000Z",
      end: "2026-11-06T15:00:00.000Z",
      allDay: false,
      colorKey: "requests",
      details: {
        status: "SUBMITTED",
        priority: "MEDIUM",
        category: "FACILITIES",
        requesterName: "Ananya Sen",
        amount: 25000,
        link: "/requests/request-1",
      },
    },
    {
      id: "leave-1",
      rawId: "leave-1",
      title: "Rahul Verma - Casual Leave (2d)",
      type: "LEAVE",
      start: "2026-11-10T00:00:00.000Z",
      end: "2026-11-11T00:00:00.000Z",
      allDay: true,
      colorKey: "leaves",
      details: {
        userName: "Rahul Verma",
        leaveType: "CASUAL",
        daysCount: 2,
        reason: "Family wedding",
        status: "APPROVED",
        link: "/approvals",
      },
    },
    {
      id: "holiday-1",
      rawId: "holiday-1",
      title: "Diwali Observance",
      type: "HOLIDAY",
      start: "2026-11-08T00:00:00.000Z",
      end: "2026-11-08T00:00:00.000Z",
      allDay: true,
      colorKey: "holidays",
      details: {
        status: "COMPANY_HOLIDAY",
        link: "/calendar",
      },
    },
  ],
  range: {
    start: "2026-11-01T00:00:00.000Z",
    end: "2026-11-30T23:59:59.999Z",
  },
};

describe("CalendarPage Component & Feature Tests (/calendar)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "u-1", name: "Eve Employee", email: "eve@test.com", role: "EMPLOYEE" },
      role: "EMPLOYEE",
    });

    (calendarApi.getEvents as any).mockResolvedValue(mockCalendarData);
  });

  const renderComponent = () =>
    render(
      <ToastProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <CalendarPage />
          </MemoryRouter>
        </QueryClientProvider>
      </ToastProvider>
    );

  it("renders the page header, view mode switchers, and sidebar toggles with non-color indicators", async () => {
    renderComponent();

    expect(screen.getByRole("heading", { name: /operations calendar/i })).toBeInTheDocument();

    // View modes
    expect(screen.getByRole("tab", { name: /month/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /week/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /day/i })).toBeInTheDocument();

    // Sidebar toggles with labels and non-color icons
    expect(screen.getByRole("button", { name: /toggle tasks/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /toggle work requests/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /toggle approved leaves/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /toggle company holidays/i })).toBeInTheDocument();
  });

  it("toggles categories and persists state in localStorage", async () => {
    const user = userEvent.setup();
    renderComponent();

    const tasksToggle = screen.getByRole("button", { name: /toggle tasks/i });
    expect(tasksToggle).toHaveAttribute("aria-pressed", "true");

    // Click toggle to disable tasks
    await user.click(tasksToggle);
    expect(tasksToggle).toHaveAttribute("aria-pressed", "false");

    // Check localStorage persistence
    const saved = JSON.parse(localStorage.getItem("nexusops_calendar_toggles") || "{}");
    expect(saved.tasks).toBe(false);
  });

  it("switches smoothly between Month, Week, and Day views", async () => {
    const user = userEvent.setup();
    renderComponent();

    // Switch to Week view
    const weekTab = screen.getByRole("tab", { name: /week/i });
    await user.click(weekTab);
    expect(weekTab).toHaveAttribute("aria-selected", "true");

    // Switch to Day view
    const dayTab = screen.getByRole("tab", { name: /day/i });
    await user.click(dayTab);
    expect(dayTab).toHaveAttribute("aria-selected", "true");
  });

  it("opens EventDetailDrawer when an event pill is clicked, displaying attributes and link", async () => {
    const user = userEvent.setup();
    renderComponent();

    // Wait for events to load and find the task pill
    const taskPill = await screen.findByRole("button", { name: /task: quarterly tax audit task/i });
    expect(taskPill).toBeInTheDocument();

    // Click event pill
    await user.click(taskPill);

    // Verify detail drawer opened with metadata and action link
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Quarterly Tax Audit Task" })).toBeInTheDocument();
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view full task details/i })).toHaveAttribute(
      "href",
      "/tasks"
    );
  });

  it("restricts holiday Add/Edit/Delete actions for EMPLOYEE role", async () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "u-1", name: "Eve Employee", email: "eve@test.com", role: "EMPLOYEE" },
      role: "EMPLOYEE",
    });

    renderComponent();

    // Add Holiday button should NOT be present for employee
    expect(screen.queryByRole("button", { name: /add holiday/i })).not.toBeInTheDocument();
  });

  it("surfaces Add Holiday button for ADMIN role and opens HolidayModal", async () => {
    const user = userEvent.setup();
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "u-admin", name: "Adam Admin", email: "admin@test.com", role: "ADMIN" },
      role: "ADMIN",
    });

    renderComponent();

    const addHolidayBtn = await screen.findByRole("button", { name: /add holiday/i });
    expect(addHolidayBtn).toBeInTheDocument();

    await user.click(addHolidayBtn);

    // Verify Holiday Modal opens
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /add company holiday/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/holiday name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date \(asia\/kolkata\)/i)).toBeInTheDocument();
  });

  it("allows ADMIN to trigger holiday deletion from the event drawer", async () => {
    const user = userEvent.setup();
    (AuthContextModule.useAuth as any).mockReturnValue({
      user: { id: "u-admin", name: "Adam Admin", email: "admin@test.com", role: "ADMIN" },
      role: "ADMIN",
    });

    renderComponent();

    const holidayPill = await screen.findByRole("button", {
      name: /holiday: diwali observance/i,
    });
    await user.click(holidayPill);

    // Verify Admin buttons in drawer
    const deleteBtn = await screen.findByRole("button", { name: /delete holiday diwali observance/i });
    expect(deleteBtn).toBeInTheDocument();

    await user.click(deleteBtn);

    // Confirm dialog should open
    expect(await screen.findByText(/are you sure you want to delete "diwali observance"\?/i)).toBeInTheDocument();
  });
});
