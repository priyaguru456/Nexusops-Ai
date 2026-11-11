import React, { useState, useEffect, useRef, useMemo, useId } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  FileText,
  CheckSquare,
  Loader2,
  CornerDownLeft,
  X,
  LayoutDashboard,
  FolderOpen,
  Bot,
  ClipboardCheck,
  BarChart3,
  Users,
  Shield,
  Contact,
  Megaphone,
  Settings,
  Plus,
  SunMoon,
  ArrowRight,
  CalendarDays,
  Receipt,
  Building2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { searchApi, type SearchResultRequest, type SearchResultTask } from "../../features/search/api";
import { useAuth } from "../../features/auth/AuthContext";
import { toggleAppTheme } from "./ThemeToggle";
import { Badge } from "../ui/badge";
import { hasRoleAccess, type Role } from "../../types/auth";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface NavigationCommand {
  id: string;
  type: "page";
  title: string;
  subtitle?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
  exactRoles?: boolean;
  keywords: string[];
}

export interface ActionCommand {
  id: string;
  type: "action";
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  perform: () => void;
  keywords: string[];
}

export interface SearchRequestCommand extends SearchResultRequest {
  type: "request";
}

export interface SearchTaskCommand extends SearchResultTask {
  type: "task";
}

export type PaletteItem =
  | ActionCommand
  | NavigationCommand
  | SearchRequestCommand
  | SearchTaskCommand;

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps): React.JSX.Element | null {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Navigation pages list with role-based access
  const allNavigationPages: NavigationCommand[] = useMemo(
    () => [
      {
        id: "nav-dashboard",
        type: "page",
        title: "Dashboard",
        subtitle: "Overview, quick metrics, activity",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
        keywords: ["dashboard", "home", "metrics", "overview"],
      },
      {
        id: "nav-requests",
        type: "page",
        title: "Work Requests",
        subtitle: "View, filter and track all requests",
        href: "/requests",
        icon: FileText,
        roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
        keywords: ["requests", "tickets", "work", "issues", "forms"],
      },
      {
        id: "nav-tasks",
        type: "page",
        title: "Tasks",
        subtitle: "Task board and assignments",
        href: "/tasks",
        icon: CheckSquare,
        roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
        keywords: ["tasks", "kanban", "todo", "assigned", "checklist"],
      },
      {
        id: "nav-calendar",
        type: "page",
        title: "Operations Calendar",
        subtitle: "Tasks, requests, approved leaves, and company holidays",
        href: "/calendar",
        icon: CalendarDays,
        roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
        keywords: ["calendar", "schedule", "events", "holidays", "leave", "due dates", "agenda"],
      },
      {
        id: "nav-expenses",
        type: "page",
        title: "Expenses & Reimbursements",
        subtitle: "Submit expense claims, receipt uploads, and finance payout queue",
        href: "/expenses",
        icon: Receipt,
        roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
        keywords: ["expenses", "reimbursement", "claims", "receipts", "payout", "finance", "money", "inr"],
      },
      {
        id: "nav-documents",
        type: "page",
        title: "Knowledge Base",
        subtitle: "Company documents and policies",
        href: "/documents",
        icon: FolderOpen,
        roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
        keywords: ["documents", "docs", "files", "knowledge", "kb", "policies"],
      },
      {
        id: "nav-ai",
        type: "page",
        title: "AI Assistant",
        subtitle: "Ask questions against verified documents",
        href: "/ai",
        icon: Bot,
        roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
        keywords: ["ai", "assistant", "chat", "ask", "bot", "rag"],
      },
      {
        id: "nav-approvals",
        type: "page",
        title: "Approvals",
        subtitle: "Review and decide on pending requests",
        href: "/approvals",
        icon: ClipboardCheck,
        roles: ["MANAGER", "ADMIN"],
        keywords: ["approvals", "pending", "review", "manager", "decision", "sla"],
      },
      {
        id: "nav-analytics",
        type: "page",
        title: "Analytics",
        subtitle: "Metrics, charts, and operational KPIs",
        href: "/analytics",
        icon: BarChart3,
        roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
        keywords: ["analytics", "charts", "kpi", "reports", "stats", "telemetry"],
      },
      {
        id: "nav-directory",
        type: "page",
        title: "Directory",
        subtitle: "Company employees, org chart and teams",
        href: "/directory",
        icon: Contact,
        roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
        keywords: ["directory", "employees", "people", "teams", "org", "chart", "hierarchy"],
      },
      {
        id: "nav-announcements",
        type: "page",
        title: "Announcements",
        subtitle: "Company news, urgent alerts and notices",
        href: "/announcements",
        icon: Megaphone,
        roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
        keywords: ["announcements", "news", "broadcast", "alerts", "updates"],
      },
      {
        id: "nav-admin-users",
        type: "page",
        title: "User Management (Admin)",
        subtitle: "Manage platform users and roles",
        href: "/admin/users",
        icon: Users,
        roles: ["ADMIN"],
        keywords: ["admin", "users", "roles", "employees", "permissions"],
      },
      {
        id: "nav-admin-audit",
        type: "page",
        title: "Audit Logs (Admin)",
        subtitle: "Security and compliance audit history",
        href: "/admin/audit",
        icon: Shield,
        roles: ["ADMIN"],
        keywords: ["admin", "audit", "security", "logs", "events", "compliance"],
      },
      {
        id: "nav-super-admin-orgs",
        type: "page",
        title: "Organizations (Super Admin)",
        subtitle: "Provision and govern multi-tenant workspaces",
        href: "/super-admin/organizations",
        icon: Building2,
        roles: ["SUPER_ADMIN"],
        exactRoles: true,
        keywords: ["super admin", "organizations", "tenants", "multi-tenant"],
      },
      {
        id: "nav-settings",
        type: "page",
        title: "Settings",
        subtitle: "Account preferences and profile",
        href: "/settings",
        icon: Settings,
        roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
        keywords: ["settings", "preferences", "profile", "account"],
      },
    ],
    []
  );

  // Available pages strictly filtered by user's role
  const allowedPages = useMemo(() => {
    if (!role) return [];
    return allNavigationPages.filter((page) =>
      hasRoleAccess(role, page.roles, page.exactRoles)
    );
  }, [allNavigationPages, role]);

  // Actions available
  const allActions: ActionCommand[] = useMemo(
    () => [
      {
        id: "act-new-request",
        type: "action",
        title: "+ New Request",
        subtitle: "Create and submit a new work request",
        icon: Plus,
        perform: () => {
          onClose();
          navigate("/requests/new");
        },
        keywords: ["create", "new", "request", "submit", "add request"],
      },
      {
        id: "act-new-task",
        type: "action",
        title: "+ New Task",
        subtitle: "Create a new task in your workspace",
        icon: Plus,
        perform: () => {
          onClose();
          navigate("/tasks?create=true");
        },
        keywords: ["create", "new", "task", "add task", "todo"],
      },
      {
        id: "act-toggle-theme",
        type: "action",
        title: "Toggle theme",
        subtitle: "Switch between dark and light appearance",
        icon: SunMoon,
        perform: () => {
          toggleAppTheme();
          onClose();
        },
        keywords: ["theme", "dark", "light", "appearance", "mode", "toggle theme"],
      },
    ],
    [navigate, onClose]
  );

  // Debounce input by 250ms for live search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchTerm.trim());
      setSelectedIndex(0);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Focus input and reset state on open
  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setDebouncedQuery("");
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Live search query via TanStack Query
  const { data: searchData, isFetching: isSearchFetching } = useQuery({
    queryKey: ["global-search", debouncedQuery],
    queryFn: ({ signal }) => searchApi.search(debouncedQuery, signal),
    enabled: isOpen && debouncedQuery.length >= 2,
    staleTime: 1000 * 30, // 30s cache
  });

  // Filter actions based on query
  const filteredActions = useMemo(() => {
    if (!searchTerm.trim()) return allActions;
    const q = searchTerm.trim().toLowerCase();
    return allActions.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.subtitle && a.subtitle.toLowerCase().includes(q)) ||
        a.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [allActions, searchTerm]);

  // Filter navigation pages based on query
  const filteredPages = useMemo(() => {
    if (!searchTerm.trim()) return allowedPages;
    const q = searchTerm.trim().toLowerCase();
    return allowedPages.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.subtitle && p.subtitle.toLowerCase().includes(q)) ||
        p.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [allowedPages, searchTerm]);

  // Live search results
  const searchRequests = useMemo<SearchRequestCommand[]>(() => {
    if (!searchData?.requests) return [];
    return searchData.requests.map((r) => ({ ...r, type: "request" as const }));
  }, [searchData]);

  const searchTasks = useMemo<SearchTaskCommand[]>(() => {
    if (!searchData?.tasks) return [];
    return searchData.tasks.map((t) => ({ ...t, type: "task" as const }));
  }, [searchData]);

  // Flatten all items currently displayed in sequential order
  const flattenedItems = useMemo<PaletteItem[]>(() => {
    return [
      ...filteredActions,
      ...filteredPages,
      ...searchRequests,
      ...searchTasks,
    ];
  }, [filteredActions, filteredPages, searchRequests, searchTasks]);

  // Keep selected index within bounds
  useEffect(() => {
    if (flattenedItems.length === 0) {
      setSelectedIndex(0);
    } else if (selectedIndex >= flattenedItems.length) {
      setSelectedIndex(flattenedItems.length - 1);
    }
  }, [flattenedItems.length, selectedIndex]);

  // Execute selection
  const handleSelect = (item: PaletteItem) => {
    onClose();
    if (item.type === "action") {
      item.perform();
    } else if (item.type === "page") {
      navigate(item.href);
    } else if (item.type === "request") {
      navigate(`/requests/${item.id}`);
    } else if (item.type === "task") {
      navigate(item.requestId ? `/requests/${item.requestId}` : `/tasks`);
    }
  };

  // Keyboard navigation & Focus Trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Esc to close
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // 2. Arrow keys to navigate items
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (flattenedItems.length > 0) {
          setSelectedIndex((prev) => (prev + 1) % flattenedItems.length);
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (flattenedItems.length > 0) {
          setSelectedIndex((prev) => (prev - 1 + flattenedItems.length) % flattenedItems.length);
        }
        return;
      }

      // 3. Enter to select
      if (e.key === "Enter") {
        e.preventDefault();
        if (flattenedItems.length > 0 && flattenedItems[selectedIndex]) {
          handleSelect(flattenedItems[selectedIndex]);
        }
        return;
      }

      // 4. Trap Tab focus inside the palette modal
      if (e.key === "Tab") {
        if (!modalRef.current) return;
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, flattenedItems, selectedIndex, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current && flattenedItems.length > 0) {
      const activeEl = listRef.current.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
      if (activeEl && typeof activeEl.scrollIntoView === "function") {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, flattenedItems.length]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-20 px-3 sm:px-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Palette Container */}
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-10 flex flex-col max-h-[82vh] animate-in fade-in zoom-in-95 duration-150"
      >
        <span id={titleId} className="sr-only">
          Command Palette
        </span>

        {/* Search Header Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 gap-3 bg-slate-50/50 dark:bg-slate-900/80">
          <Search className="w-5 h-5 text-indigo-500 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="command-palette-results"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search pages, actions, requests, and tasks..."
            className="flex-1 bg-transparent border-0 text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-0"
            aria-label="Command search input"
          />
          {isSearchFetching ? (
            <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" aria-label="Searching..." />
          ) : searchTerm ? (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md transition-colors"
              aria-label="Clear query"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
              ESC
            </kbd>
          )}
        </div>

        {/* Results / List Area */}
        <div
          ref={listRef}
          id="command-palette-results"
          role="listbox"
          aria-label="Command options"
          className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/60"
        >
          {flattenedItems.length === 0 && !isSearchFetching && (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No matching results
              </p>
              <p className="text-xs text-slate-400 mt-1">
                No actions, accessible pages, or records matched &ldquo;{searchTerm}&rdquo;.
              </p>
            </div>
          )}

          {/* Quick Actions Section */}
          {filteredActions.length > 0 && (
            <div className="py-1.5">
              <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Actions
              </div>
              <div className="space-y-0.5">
                {filteredActions.map((action) => {
                  const idx = flattenedItems.findIndex((it) => it.id === action.id);
                  const isSelected = selectedIndex === idx;
                  const Icon = action.icon;
                  return (
                    <div
                      key={action.id}
                      role="option"
                      aria-selected={isSelected}
                      data-index={idx}
                      onClick={() => handleSelect(action)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-100 font-medium"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-indigo-600 text-white"
                              : "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-semibold truncate">{action.title}</p>
                          {action.subtitle && (
                            <p className="text-[11px] text-slate-400 truncate">{action.subtitle}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                          Action
                        </Badge>
                        {isSelected && (
                          <CornerDownLeft className="w-3.5 h-3.5 text-indigo-500 hidden sm:block" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation Pages Section */}
          {filteredPages.length > 0 && (
            <div className="py-1.5">
              <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Navigation
              </div>
              <div className="space-y-0.5">
                {filteredPages.map((page) => {
                  const idx = flattenedItems.findIndex((it) => it.id === page.id);
                  const isSelected = selectedIndex === idx;
                  const Icon = page.icon;
                  return (
                    <div
                      key={page.id}
                      role="option"
                      aria-selected={isSelected}
                      data-index={idx}
                      onClick={() => handleSelect(page)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-100 font-medium"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-semibold truncate">{page.title}</p>
                          {page.subtitle && (
                            <p className="text-[11px] text-slate-400 truncate">{page.subtitle}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400 hidden sm:inline">
                          Jump to page
                        </span>
                        {isSelected ? (
                          <CornerDownLeft className="w-3.5 h-3.5 text-indigo-500" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Search Requests Section */}
          {searchRequests.length > 0 && (
            <div className="py-1.5">
              <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                <span>Work Requests</span>
                <span className="text-[10px] font-medium text-slate-400">
                  {searchRequests.length} match{searchRequests.length > 1 ? "es" : ""}
                </span>
              </div>
              <div className="space-y-0.5">
                {searchRequests.map((item) => {
                  const idx = flattenedItems.findIndex((it) => it.type === "request" && it.id === item.id);
                  const isSelected = selectedIndex === idx;
                  return (
                    <div
                      key={`request-${item.id}`}
                      role="option"
                      aria-selected={isSelected}
                      data-index={idx}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-100 font-medium"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-semibold truncate">{item.title}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{item.category}</span>
                            <span>•</span>
                            <span>by {item.requesterName}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          {item.status}
                        </Badge>
                        {isSelected && (
                          <CornerDownLeft className="w-3.5 h-3.5 text-indigo-500 hidden sm:block" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Search Tasks Section */}
          {searchTasks.length > 0 && (
            <div className="py-1.5">
              <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                <span>Tasks</span>
                <span className="text-[10px] font-medium text-slate-400">
                  {searchTasks.length} match{searchTasks.length > 1 ? "es" : ""}
                </span>
              </div>
              <div className="space-y-0.5">
                {searchTasks.map((item) => {
                  const idx = flattenedItems.findIndex((it) => it.type === "task" && it.id === item.id);
                  const isSelected = selectedIndex === idx;
                  return (
                    <div
                      key={`task-${item.id}`}
                      role="option"
                      aria-selected={isSelected}
                      data-index={idx}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-100 font-medium"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <CheckSquare className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-semibold truncate">{item.title}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{item.assigneeName ? `Assigned to ${item.assigneeName}` : "Unassigned"}</span>
                            {item.dueDate && (
                              <>
                                <span>•</span>
                                <span>Due {new Date(item.dueDate).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          {item.status}
                        </Badge>
                        {isSelected && (
                          <CornerDownLeft className="w-3.5 h-3.5 text-indigo-500 hidden sm:block" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer / Shortcuts */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-semibold text-[10px]">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-semibold text-[10px]">
                ↓
              </kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-semibold text-[10px]">
                ↵
              </kbd>
              <span>select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-semibold text-[10px]">
                ESC
              </kbd>
              <span>close</span>
            </span>
          </div>
          <div className="hidden sm:block text-[10px] font-medium text-slate-400">
            Permission Scoped • NexusOps
          </div>
        </div>
      </div>
    </div>
  );
}
