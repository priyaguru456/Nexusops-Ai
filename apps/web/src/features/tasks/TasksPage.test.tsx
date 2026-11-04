import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { TasksPage } from "./TasksPage";
import * as AuthContextModule from "../auth/AuthContext";
import * as HooksModule from "./hooks";
import type { TaskItem } from "../../types/tasks";

// Mock the AuthContext
vi.mock("../auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

// Mock hooks
vi.mock("./hooks", () => ({
  useTasks: vi.fn(),
  useCreateTask: vi.fn(),
  useUpdateTask: vi.fn(),
}));

const mockCurrentUser = {
  id: "user-current-1",
  name: "Current User",
  email: "current@nexusops.com",
  role: "EMPLOYEE" as const,
  departmentId: "dept-1",
};

const mockTasks: TaskItem[] = [
  {
    id: "task-1",
    title: "Overdue Urgent Action",
    description: "- [ ] Step 1\n- [x] Step 2",
    status: "TODO",
    priority: "URGENT",
    dueDate: "2026-10-30T10:00:00Z", // Past due
    createdAt: "2026-10-25T00:00:00Z",
    updatedAt: "2026-10-25T00:00:00Z",
    requestId: null,
    assigneeId: "user-current-1",
    assignee: {
      id: "user-current-1",
      name: "Current User",
      email: "current@nexusops.com",
      role: "EMPLOYEE",
      departmentId: "dept-1",
    },
    assignedById: null,
  },
  {
    id: "task-2",
    title: "Due Today High Task",
    description: "No checklist here",
    status: "IN_PROGRESS",
    priority: "HIGH",
    // 2026-11-03 in Asia/Kolkata
    dueDate: "2026-11-03T10:00:00+05:30",
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    requestId: null,
    assigneeId: "user-other-2",
    assignee: {
      id: "user-other-2",
      name: "Other Colleague",
      email: "colleague@nexusops.com",
      role: "EMPLOYEE",
      departmentId: "dept-1",
    },
    assignedById: null,
  },
  {
    id: "task-3",
    title: "Upcoming Medium Task",
    description: "* [ ] Item A\n* [ ] Item B\n* [x] Item C",
    status: "TODO",
    priority: "MEDIUM",
    // 2 days ahead
    dueDate: "2026-11-05T12:00:00+05:30",
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    requestId: null,
    assigneeId: null, // Unassigned
    assignee: null,
    assignedById: null,
  },
  {
    id: "task-4",
    title: "Completed Done Task",
    description: "All done",
    status: "DONE",
    priority: "LOW",
    dueDate: "2026-10-20T10:00:00Z", // Past due, but status is DONE
    createdAt: "2026-10-15T00:00:00Z",
    updatedAt: "2026-10-20T00:00:00Z",
    requestId: null,
    assigneeId: "user-current-1",
    assignee: {
      id: "user-current-1",
      name: "Current User",
      email: "current@nexusops.com",
      role: "EMPLOYEE",
      departmentId: "dept-1",
    },
    assignedById: null,
  },
];

describe("React Testing Library: TasksPage Enhancements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    (AuthContextModule.useAuth as any).mockReturnValue({
      user: mockCurrentUser,
      role: "EMPLOYEE",
      isAuthenticated: true,
      isLoading: false,
    });

    (HooksModule.useTasks as any).mockReturnValue({
      data: {
        tasks: mockTasks,
        total: mockTasks.length,
        page: 1,
        limit: 100,
        totalPages: 1,
      },
      isLoading: false,
    });

    (HooksModule.useCreateTask as any).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    (HooksModule.useUpdateTask as any).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>
    );

  it("renders 'My Tasks' toggle button and respects localStorage", async () => {
    const user = userEvent.setup();
    renderComponent();

    const myTasksToggle = screen.getByRole("switch", { name: /toggle my tasks only/i });
    expect(myTasksToggle).toBeInTheDocument();
    expect(myTasksToggle).toHaveAttribute("aria-checked", "false");

    // Click My Tasks toggle
    await user.click(myTasksToggle);

    expect(myTasksToggle).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem("nexusops_tasks_my_tasks")).toBe("true");

    // Click again to turn off
    await user.click(myTasksToggle);
    expect(myTasksToggle).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem("nexusops_tasks_my_tasks")).toBe("false");
  });

  it("filters to only user's tasks when 'My Tasks' is enabled", async () => {
    const user = userEvent.setup();
    renderComponent();

    // Initially all tasks are shown
    expect(screen.getByText("Overdue Urgent Action")).toBeInTheDocument();
    expect(screen.getByText("Due Today High Task")).toBeInTheDocument();
    expect(screen.getByText("Upcoming Medium Task")).toBeInTheDocument();

    // Toggle "My Tasks"
    const myTasksToggle = screen.getByRole("switch", { name: /toggle my tasks only/i });
    await user.click(myTasksToggle);

    // Only user's tasks (task-1 and task-4) should be visible
    expect(screen.getByText("Overdue Urgent Action")).toBeInTheDocument();
    expect(screen.getByText("Completed Done Task")).toBeInTheDocument();
    expect(screen.queryByText("Due Today High Task")).not.toBeInTheDocument();
    expect(screen.queryByText("Upcoming Medium Task")).not.toBeInTheDocument();
  });

  it("renders due-date badges only when status is not DONE", () => {
    renderComponent();

    // task-1 is overdue
    expect(screen.getByLabelText(/due date status: overdue by/i)).toBeInTheDocument();

    // task-2 is due today
    expect(screen.getByLabelText(/due date status: due today/i)).toBeInTheDocument();

    // task-3 is due in 2 days
    expect(screen.getByLabelText(/due date status: due in 2 days/i)).toBeInTheDocument();

    // task-4 is DONE, so it should not render any relative overdue/due badge
    const overdueBadges = screen.getAllByLabelText(/due date status: overdue by/i);
    // Only 1 task is overdue and not DONE
    expect(overdueBadges.length).toBe(1);
  });

  it("renders checklist badge '✓ X/Y' with mini progress bar only when markdown checklist items exist", () => {
    renderComponent();

    // task-1 has: "- [ ] Step 1\n- [x] Step 2" -> ✓ 1/2
    expect(screen.getByText("✓ 1/2")).toBeInTheDocument();

    // task-3 has: "* [ ] Item A\n* [ ] Item B\n* [x] Item C" -> ✓ 1/3
    expect(screen.getByText("✓ 1/3")).toBeInTheDocument();

    // task-2 and task-4 have no checklists -> neither should render checklist badges
    expect(screen.queryByText("✓ 0/0")).not.toBeInTheDocument();
  });

  it("renders quick filter chips and combines filters", async () => {
    const user = userEvent.setup();
    renderComponent();

    // Filter by Urgent priority chip
    const urgentChip = screen.getByRole("button", { name: /urgent/i });
    await user.click(urgentChip);

    // Only task-1 is URGENT
    expect(screen.getByText("Overdue Urgent Action")).toBeInTheDocument();
    expect(screen.queryByText("Due Today High Task")).not.toBeInTheDocument();
    expect(screen.queryByText("Upcoming Medium Task")).not.toBeInTheDocument();

    // Deselect Urgent chip
    await user.click(urgentChip);
    expect(screen.getByText("Due Today High Task")).toBeInTheDocument();
  });

  it("filters tasks by Due Date quick chips (Overdue, Due today, This week)", async () => {
    const user = userEvent.setup();
    renderComponent();

    // Filter by 'Due today' chip
    const dueTodayChip = screen.getByRole("button", { name: /due today/i });
    await user.click(dueTodayChip);

    expect(screen.getByText("Due Today High Task")).toBeInTheDocument();
    expect(screen.queryByText("Overdue Urgent Action")).not.toBeInTheDocument();
    expect(screen.queryByText("Upcoming Medium Task")).not.toBeInTheDocument();
  });

  it("resets all active filters with one click on 'Clear all'", async () => {
    const user = userEvent.setup();
    renderComponent();

    // Activate multiple filters
    const searchInput = screen.getByPlaceholderText(/search tasks/i);
    await user.type(searchInput, "Overdue");

    const urgentChip = screen.getByRole("button", { name: /urgent/i });
    await user.click(urgentChip);

    const overdueChip = screen.getByRole("button", { name: /overdue/i });
    await user.click(overdueChip);

    // The 'Clear all' button must now be visible
    const clearAllBtn = screen.getByRole("button", { name: /clear all/i });
    expect(clearAllBtn).toBeInTheDocument();

    // Click 'Clear all'
    await user.click(clearAllBtn);

    // All tasks should be back
    expect(screen.getByText("Overdue Urgent Action")).toBeInTheDocument();
    expect(screen.getByText("Due Today High Task")).toBeInTheDocument();
    expect(screen.getByText("Upcoming Medium Task")).toBeInTheDocument();
    expect(searchInput).toHaveValue("");
    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });

  it("switches smoothly between Kanban and List views with badges preserved", async () => {
    const user = userEvent.setup();
    renderComponent();

    const listToggleBtn = screen.getByRole("button", { name: /list/i });
    await user.click(listToggleBtn);

    // In List view, rows should still render checklist and due-date badges
    expect(screen.getByText("✓ 1/2")).toBeInTheDocument();
    expect(screen.getByLabelText(/due date status: due today/i)).toBeInTheDocument();
  });
});
