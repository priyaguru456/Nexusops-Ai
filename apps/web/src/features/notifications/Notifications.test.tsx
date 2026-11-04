import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationBell } from "./NotificationBell";
import { NotificationsPage } from "./NotificationsPage";
import * as NotificationsHooksModule from "./hooks";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("./hooks", () => ({
  useNotifications: vi.fn(),
  useUnreadNotificationCount: vi.fn(),
  useMarkNotificationAsRead: vi.fn(),
  useMarkAllNotificationsAsRead: vi.fn(),
}));

describe("Notification Center Components: NotificationBell and NotificationsPage", () => {
  let queryClient: QueryClient;
  const mockMarkAsRead = vi.fn().mockResolvedValue({});
  const mockMarkAllAsRead = vi.fn().mockResolvedValue({});

  const sampleNotifications = [
    {
      id: "notif-1",
      userId: "user-1",
      type: "TASK_ASSIGNED",
      title: "Task Assigned",
      message: "You have been assigned to task 'Fix Authentication Bug'",
      link: "/tasks",
      entityType: "Task",
      entityId: "task-101",
      isRead: false,
      readAt: null,
      createdAt: "2026-11-03T10:00:00.000Z",
    },
    {
      id: "notif-2",
      userId: "user-1",
      type: "APPROVAL_REQUESTED",
      title: "Approval Requested",
      message: "Approval needed for request 'MacBook Pro Order'",
      link: "/requests/req-202",
      entityType: "WorkRequest",
      entityId: "req-202",
      isRead: true,
      readAt: "2026-11-03T11:00:00.000Z",
      createdAt: "2026-11-03T09:30:00.000Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    (NotificationsHooksModule.useMarkNotificationAsRead as any).mockReturnValue({
      mutateAsync: mockMarkAsRead,
      isPending: false,
    });

    (NotificationsHooksModule.useMarkAllNotificationsAsRead as any).mockReturnValue({
      mutateAsync: mockMarkAllAsRead,
      isPending: false,
    });
  });

  const renderWithProviders = (ui: React.ReactElement) =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    );

  describe("NotificationBell Component", () => {
    it("renders bell icon and unread badge with correct count", () => {
      (NotificationsHooksModule.useNotifications as any).mockReturnValue({
        data: {
          notifications: sampleNotifications,
          unreadCount: 1,
        },
        isLoading: false,
      });

      renderWithProviders(<NotificationBell />);

      const bellButton = screen.getByRole("button", { name: /notifications/i });
      expect(bellButton).toBeInTheDocument();

      const badge = screen.getByTestId("notification-unread-badge");
      expect(badge).toHaveTextContent("1");
    });

    it("opens dropdown on click, displays notifications with title and message, and closes on escape", async () => {
      (NotificationsHooksModule.useNotifications as any).mockReturnValue({
        data: {
          notifications: sampleNotifications,
          unreadCount: 1,
        },
        isLoading: false,
      });

      renderWithProviders(<NotificationBell />);

      const bellButton = screen.getByRole("button", { name: /notifications/i });
      fireEvent.click(bellButton);

      expect(screen.getByText("Notifications")).toBeInTheDocument();
      expect(screen.getByText("Task Assigned")).toBeInTheDocument();
      expect(
        screen.getByText("You have been assigned to task 'Fix Authentication Bug'")
      ).toBeInTheDocument();
      expect(screen.getByText("View all notifications")).toBeInTheDocument();

      // Press Escape to close
      fireEvent.keyDown(window, { key: "Escape" });
      await waitFor(() => {
        expect(screen.queryByText("View all notifications")).not.toBeInTheDocument();
      });
    });

    it("clicking 'Mark all read' in dropdown triggers markAllAsRead mutation", async () => {
      (NotificationsHooksModule.useNotifications as any).mockReturnValue({
        data: {
          notifications: sampleNotifications,
          unreadCount: 1,
        },
        isLoading: false,
      });

      renderWithProviders(<NotificationBell />);

      const bellButton = screen.getByRole("button", { name: /notifications/i });
      fireEvent.click(bellButton);

      const markAllBtn = screen.getByRole("button", {
        name: "Mark all notifications as read",
      });
      fireEvent.click(markAllBtn);

      expect(mockMarkAllAsRead).toHaveBeenCalled();
    });

    it("clicking an unread notification marks it as read and navigates to the linked page", async () => {
      (NotificationsHooksModule.useNotifications as any).mockReturnValue({
        data: {
          notifications: sampleNotifications,
          unreadCount: 1,
        },
        isLoading: false,
      });

      renderWithProviders(<NotificationBell />);

      const bellButton = screen.getByRole("button", { name: /notifications/i });
      fireEvent.click(bellButton);

      const notifItem = screen.getByText("Task Assigned");
      fireEvent.click(notifItem);

      await waitFor(() => {
        expect(mockMarkAsRead).toHaveBeenCalledWith("notif-1");
        expect(mockNavigate).toHaveBeenCalledWith("/tasks");
      });
    });

    it("displays empty state when there are no notifications", () => {
      (NotificationsHooksModule.useNotifications as any).mockReturnValue({
        data: {
          notifications: [],
          unreadCount: 0,
        },
        isLoading: false,
      });

      renderWithProviders(<NotificationBell />);

      const bellButton = screen.getByRole("button", { name: /notifications/i });
      fireEvent.click(bellButton);

      expect(screen.getByText("No notifications yet")).toBeInTheDocument();
    });
  });

  describe("NotificationsPage Component", () => {
    it("renders page header, unread badge, and notification list with details", () => {
      (NotificationsHooksModule.useNotifications as any).mockReturnValue({
        data: {
          notifications: sampleNotifications,
          total: 2,
          page: 1,
          limit: 15,
          totalPages: 1,
          unreadCount: 1,
        },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<NotificationsPage />);

      expect(screen.getByRole("heading", { name: "Notification Center" })).toBeInTheDocument();
      expect(screen.getByText("1 unread")).toBeInTheDocument();
      expect(screen.getByText("Task Assigned")).toBeInTheDocument();
      expect(screen.getByText("Approval Requested")).toBeInTheDocument();
      expect(screen.getByText("Task")).toBeInTheDocument();
      expect(screen.getByText("WorkRequest")).toBeInTheDocument();
    });

    it("filters notifications by switching tabs between All and Unread", () => {
      const mockUseNotifications = vi.fn().mockReturnValue({
        data: {
          notifications: sampleNotifications,
          total: 2,
          page: 1,
          totalPages: 1,
          unreadCount: 1,
        },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      (NotificationsHooksModule.useNotifications as any).mockImplementation(mockUseNotifications);

      renderWithProviders(<NotificationsPage />);

      const unreadTab = screen.getByRole("button", { name: /unread/i });
      fireEvent.click(unreadTab);

      // Verify hook called with unreadOnly = true
      expect(mockUseNotifications).toHaveBeenCalledWith(true, 15, 1);
    });

    it("allows marking a single notification as read", async () => {
      (NotificationsHooksModule.useNotifications as any).mockReturnValue({
        data: {
          notifications: sampleNotifications,
          total: 2,
          page: 1,
          totalPages: 1,
          unreadCount: 1,
        },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<NotificationsPage />);

      const markReadBtn = screen.getByRole("button", { name: "Mark notification as read" });
      fireEvent.click(markReadBtn);

      expect(mockMarkAsRead).toHaveBeenCalledWith("notif-1");
    });

    it("allows marking all notifications as read", async () => {
      (NotificationsHooksModule.useNotifications as any).mockReturnValue({
        data: {
          notifications: sampleNotifications,
          total: 2,
          page: 1,
          totalPages: 1,
          unreadCount: 1,
        },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<NotificationsPage />);

      const markAllBtn = screen.getByRole("button", {
        name: "Mark all notifications as read",
      });
      fireEvent.click(markAllBtn);

      expect(mockMarkAllAsRead).toHaveBeenCalled();
    });

    it("navigates to linked entity when Open button is clicked", async () => {
      (NotificationsHooksModule.useNotifications as any).mockReturnValue({
        data: {
          notifications: sampleNotifications,
          total: 2,
          page: 1,
          totalPages: 1,
          unreadCount: 1,
        },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<NotificationsPage />);

      const openButtons = screen.getAllByRole("button", { name: /open/i });
      fireEvent.click(openButtons[0]);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/tasks");
      });
    });

    it("renders loading skeletons while fetching data", () => {
      (NotificationsHooksModule.useNotifications as any).mockReturnValue({
        data: null,
        isLoading: true,
        isError: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<NotificationsPage />);

      expect(screen.getByTestId("notifications-loading")).toBeInTheDocument();
    });

    it("renders error alert with retry button when fetch fails", () => {
      const mockRefetch = vi.fn();
      (NotificationsHooksModule.useNotifications as any).mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: new Error("Network timeout"),
        refetch: mockRefetch,
      });

      renderWithProviders(<NotificationsPage />);

      expect(screen.getByText(/Failed to load notifications/i)).toBeInTheDocument();
      expect(screen.getByText(/Network timeout/i)).toBeInTheDocument();

      const retryBtn = screen.getByRole("button", { name: /retry/i });
      fireEvent.click(retryBtn);
      expect(mockRefetch).toHaveBeenCalled();
    });
  });
});
