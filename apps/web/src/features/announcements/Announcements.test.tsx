import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnnouncementsPage } from "./AnnouncementsPage";
import { SafeMarkdown } from "./SafeMarkdown";
import { NewAnnouncementModal } from "./NewAnnouncementModal";
import { CompanyNewsWidget } from "./CompanyNewsWidget";
import { announcementsApi } from "./api";
import * as AuthContextModule from "../auth/AuthContext";
import type { Announcement } from "../../types/announcements";

vi.mock("../auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("./api", () => ({
  announcementsApi: {
    getAnnouncements: vi.fn(),
    getUnreadAnnouncements: vi.fn(),
    getAnnouncementById: vi.fn(),
    createAnnouncement: vi.fn(),
    updateAnnouncement: vi.fn(),
    deleteAnnouncement: vi.fn(),
    markAsRead: vi.fn(),
    getReadStats: vi.fn(),
    getDepartments: vi.fn(),
  },
}));

describe("Announcements Feature Tests", () => {
  let queryClient: QueryClient;

  const sampleAnnouncements: Announcement[] = [
    {
      id: "ann-pinned-1",
      title: "Pinned Urgent Operations Alert",
      content: "### System Patch\nCritical security maintenance tonight at midnight.",
      priority: "URGENT",
      targetDepartmentId: null,
      targetDepartment: null,
      authorId: "usr-admin-1",
      author: { id: "usr-admin-1", name: "Adam Admin", email: "admin@test.com", role: "ADMIN" },
      isPinned: true,
      expiresAt: null,
      createdAt: "2026-11-04T05:00:00Z",
      updatedAt: "2026-11-04T05:00:00Z",
      isRead: false,
      readAt: null,
      readCount: 15,
      totalTargetUsers: 50,
    },
    {
      id: "ann-regular-2",
      title: "Quarterly Town Hall Notes",
      content: "Regular quarterly meeting summary and Q4 goals.",
      priority: "NORMAL",
      targetDepartmentId: "dept-it",
      targetDepartment: { id: "dept-it", name: "IT" },
      authorId: "usr-mgr-it",
      author: { id: "usr-mgr-it", name: "Mike Manager", email: "mike@test.com", role: "MANAGER" },
      isPinned: false,
      expiresAt: null,
      createdAt: "2026-11-03T10:00:00Z",
      updatedAt: "2026-11-03T10:00:00Z",
      isRead: true,
      readAt: "2026-11-03T11:00:00Z",
      readCount: 8,
      totalTargetUsers: 10,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    (announcementsApi.getAnnouncements as any).mockResolvedValue({
      items: sampleAnnouncements,
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
      unreadCount: 1,
    });

    (announcementsApi.getUnreadAnnouncements as any).mockResolvedValue({
      items: [sampleAnnouncements[0]],
    });

    (announcementsApi.getDepartments as any).mockResolvedValue({
      departments: [
        { id: "dept-it", name: "IT" },
        { id: "dept-hr", name: "HR" },
      ],
    });

    (announcementsApi.markAsRead as any).mockResolvedValue({
      success: true,
      readAt: new Date().toISOString(),
    });

    (announcementsApi.getReadStats as any).mockResolvedValue({
      readCount: 15,
      totalTargetUsers: 50,
      percentage: 30,
      readers: [
        {
          id: "r-1",
          userId: "usr-1",
          name: "Alice Reader",
          email: "alice@test.com",
          role: "EMPLOYEE",
          departmentName: "IT",
          readAt: "2026-11-04T06:00:00Z",
        },
      ],
    });
  });

  const renderWithProviders = (ui: React.ReactElement) =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    );

  describe("SafeMarkdown Component", () => {
    it("renders markdown headings, lists, bold text and quotes safely", () => {
      const markdown = "# Heading 1\n\n- Bullet 1\n- Bullet 2\n\n**Bold statement**\n\n> Blockquote text";
      const { container } = render(<SafeMarkdown content={markdown} />);

      expect(container.querySelector("h1")).toHaveTextContent("Heading 1");
      expect(container.querySelector("ul")).toBeInTheDocument();
      expect(container.querySelectorAll("li")).toHaveLength(2);
      expect(container.querySelector("strong")).toHaveTextContent("Bold statement");
      expect(container.querySelector("blockquote")).toHaveTextContent("Blockquote text");
    });

    it("sanitizes dangerous javascript links and raw script tags", () => {
      const dangerousMarkdown = '[Malicious Link](javascript:alert("XSS"))\n\n<script>alert("hacked")</script>';
      const { container } = render(<SafeMarkdown content={dangerousMarkdown} />);

      // Script tag must not execute as HTML
      expect(container.querySelector("script")).toBeNull();

      // Anchor with javascript: URL must have href stripped to empty string
      const link = container.querySelector("a");
      expect(link).toBeInTheDocument();
      expect(link?.getAttribute("href")).toBe("");
    });
  });

  describe("Announcements Feed UI (/announcements)", () => {
    it("renders announcements with pinned items first, URGENT badges, and unread dot", async () => {
      (AuthContextModule.useAuth as any).mockReturnValue({
        user: { id: "usr-emp-1", name: "Eve Employee", role: "EMPLOYEE", departmentId: "dept-it" },
        role: "EMPLOYEE",
      });

      renderWithProviders(<AnnouncementsPage />);

      // Pinned urgent announcement
      expect(await screen.findByText(/Pinned Urgent Operations Alert/i)).toBeInTheDocument();
      expect(screen.getByText("URGENT")).toBeInTheDocument();
      expect(screen.getAllByText("Pinned").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText("Unread")).toBeInTheDocument();

      // Regular announcement
      expect(screen.getByText(/Quarterly Town Hall Notes/i)).toBeInTheDocument();
    });

    it("hides '+ New Announcement' button for EMPLOYEE role", async () => {
      (AuthContextModule.useAuth as any).mockReturnValue({
        user: { id: "usr-emp-1", name: "Eve Employee", role: "EMPLOYEE" },
        role: "EMPLOYEE",
      });

      renderWithProviders(<AnnouncementsPage />);
      await screen.findByText(/Pinned Urgent Operations Alert/i);

      expect(screen.queryByText(/\+ New Announcement/i)).not.toBeInTheDocument();
    });

    it("displays '+ New Announcement' button for ADMIN and MANAGER roles", async () => {
      (AuthContextModule.useAuth as any).mockReturnValue({
        user: { id: "usr-mgr-1", name: "Mike Manager", role: "MANAGER", departmentId: "dept-it" },
        role: "MANAGER",
      });

      renderWithProviders(<AnnouncementsPage />);
      expect(await screen.findByText(/\+ New Announcement/i)).toBeInTheDocument();
    });

    it("displays 'Read by X of Y' stats for the author", async () => {
      (AuthContextModule.useAuth as any).mockReturnValue({
        user: { id: "usr-mgr-it", name: "Mike Manager", role: "MANAGER", departmentId: "dept-it" },
        role: "MANAGER",
      });

      renderWithProviders(<AnnouncementsPage />);

      // Author of regular-2 is usr-mgr-it (8 of 10)
      expect(await screen.findByText(/Read by 8 of 10 \(80%\)/i)).toBeInTheDocument();
    });

    it("marks announcement as read when clicked and opens detail modal", async () => {
      (AuthContextModule.useAuth as any).mockReturnValue({
        user: { id: "usr-emp-1", name: "Eve Employee", role: "EMPLOYEE" },
        role: "EMPLOYEE",
      });

      renderWithProviders(<AnnouncementsPage />);

      const article = await screen.findByRole("article", {
        name: /Announcement: Pinned Urgent Operations Alert/i,
      });

      fireEvent.click(article);

      // Detail dialog opens
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveTextContent(/Critical security maintenance tonight at midnight/i);

      // markAsRead API called on open
      expect(announcementsApi.markAsRead).toHaveBeenCalledWith("ann-pinned-1");
    });
  });

  describe("NewAnnouncementModal Role Restrictions", () => {
    it("locks department targeting to manager's own department", async () => {
      (AuthContextModule.useAuth as any).mockReturnValue({
        user: {
          id: "usr-mgr-it",
          name: "Mike Manager",
          role: "MANAGER",
          departmentId: "dept-it",
          department: { name: "Information Technology" },
        },
        role: "MANAGER",
      });

      renderWithProviders(
        <NewAnnouncementModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />
      );

      expect(screen.getByText(/Your Department: Information Technology/i)).toBeInTheDocument();
      // Dropdown selector should NOT be rendered for Manager
      expect(screen.queryByRole("combobox", { name: /Target Audience/i })).not.toBeInTheDocument();
    });

    it("allows ADMIN to target All Departments or specific department", async () => {
      (AuthContextModule.useAuth as any).mockReturnValue({
        user: { id: "usr-admin-1", name: "Adam Admin", role: "ADMIN" },
        role: "ADMIN",
      });

      renderWithProviders(
        <NewAnnouncementModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />
      );

      expect(screen.getByText("All Departments (Company-Wide)")).toBeInTheDocument();
      expect(await screen.findByText("IT Department")).toBeInTheDocument();
      expect(await screen.findByText("HR Department")).toBeInTheDocument();
    });

    it("supports markdown live preview tab", async () => {
      (AuthContextModule.useAuth as any).mockReturnValue({
        user: { id: "usr-admin-1", name: "Adam Admin", role: "ADMIN" },
        role: "ADMIN",
      });

      renderWithProviders(
        <NewAnnouncementModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />
      );

      const textarea = screen.getByPlaceholderText(/Write your announcement in markdown/i);
      fireEvent.change(textarea, { target: { value: "## Live Heading Test" } });

      // Switch to preview tab
      const previewTab = screen.getByRole("button", { name: /Preview/i });
      fireEvent.click(previewTab);

      // Verify heading is rendered in preview
      expect(await screen.findByRole("heading", { name: "Live Heading Test" })).toBeInTheDocument();
    });
  });

  describe("Company News Dashboard Widget", () => {
    it("renders unread announcements in widget with link to /announcements", async () => {
      renderWithProviders(<CompanyNewsWidget />);

      expect(await screen.findByText("Company News & Updates")).toBeInTheDocument();
      expect(await screen.findByText(/Pinned Urgent Operations Alert/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /View all/i })).toHaveAttribute(
        "href",
        "/announcements"
      );
    });

    it("renders empty state when there are 0 unread announcements", async () => {
      (announcementsApi.getUnreadAnnouncements as any).mockResolvedValue({ items: [] });

      renderWithProviders(<CompanyNewsWidget />);

      expect(await screen.findByText(/You're all caught up!/i)).toBeInTheDocument();
      expect(screen.getByText(/No unread announcements/i)).toBeInTheDocument();
    });
  });
});
