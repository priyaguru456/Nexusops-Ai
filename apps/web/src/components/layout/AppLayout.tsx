import React, { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Bot,
  FolderOpen,
  ClipboardCheck,
  BarChart3,
  Users,
  Shield,
  Contact,
  Megaphone,
  Laptop,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Search,
  Settings,
  Home,
  ChevronRight,
  Plus,
  CalendarDays,
  Star,
  Receipt,
  Building2,
} from "lucide-react";
import { useAuth } from "../../features/auth/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "../../features/notifications/NotificationBell";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { CsatSurveyModal } from "../../features/surveys/CsatSurveyModal";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { hasRoleAccess, type Role } from "../../types/auth";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
  exactRoles?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    label: "Work Requests",
    href: "/requests",
    icon: FileText,
    roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    label: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
    roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    label: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
    roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    label: "Expenses",
    href: "/expenses",
    icon: Receipt,
    roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    label: "Knowledge Base",
    href: "/documents",
    icon: FolderOpen,
    roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    label: "AI Assistant",
    href: "/ai",
    icon: Bot,
    roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    label: "Approvals",
    href: "/approvals",
    icon: ClipboardCheck,
    roles: ["MANAGER", "ADMIN"],
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    label: "Directory",
    href: "/directory",
    icon: Contact,
    roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    label: "Announcements",
    href: "/announcements",
    icon: Megaphone,
    roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
  {
    label: "User Management",
    href: "/admin/users",
    icon: Users,
    roles: ["ADMIN"],
  },
  {
    label: "Audit Logs",
    href: "/admin/audit",
    icon: Shield,
    roles: ["ADMIN"],
  },
  {
    label: "Assets",
    href: "/assets",
    icon: Laptop,
    roles: ["ADMIN"],
  },
  {
    label: "Surveys & CSAT",
    href: "/admin/surveys",
    icon: Star,
    roles: ["ADMIN"],
  },
  {
    label: "Organizations",
    href: "/super-admin/organizations",
    icon: Building2,
    roles: ["SUPER_ADMIN"],
    exactRoles: true,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["EMPLOYEE", "MANAGER", "ADMIN"],
  },
];

export const AppLayout: React.FC = () => {
  const { user, role, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  // Global keyboard shortcut for search (Ctrl+K / Cmd+K)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const visibleNavItems = NAV_ITEMS.filter((item) =>
    hasRoleAccess(role, item.roles, item.exactRoles)
  );

  const roleBadgeVariant = (userRole?: Role) => {
    switch (userRole) {
      case "SUPER_ADMIN":
      case "ADMIN":
        return "destructive";
      case "MANAGER":
        return "warning";
      default:
        return "default";
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRouteInfo = (pathname: string) => {
    if (pathname.startsWith("/requests/new")) return { title: "Create Request", section: "Work Requests" };
    if (pathname.startsWith("/requests/") && pathname.endsWith("/edit")) return { title: "Edit Request", section: "Work Requests" };
    if (pathname.startsWith("/requests/")) return { title: "Request Details", section: "Work Requests" };
    if (pathname.startsWith("/requests")) return { title: "Work Requests", section: "Work Requests" };
    if (pathname.startsWith("/tasks")) return { title: "Tasks", section: "Tasks" };
    if (pathname.startsWith("/documents")) return { title: "Knowledge Base", section: "Documents" };
    if (pathname.startsWith("/ai")) return { title: "AI Assistant", section: "AI" };
    if (pathname.startsWith("/approvals")) return { title: "Approvals", section: "Approvals" };
    if (pathname.startsWith("/analytics")) return { title: "Analytics", section: "Analytics" };
    if (pathname.startsWith("/directory")) return { title: "Company Directory", section: "Organization" };
    if (pathname.startsWith("/announcements")) return { title: "Announcements", section: "Communications" };
    if (pathname.startsWith("/super-admin/organizations")) return { title: "Organizations", section: "Platform" };
    if (pathname.startsWith("/admin/users")) return { title: "User Management", section: "Administration" };
    if (pathname.startsWith("/admin/audit")) return { title: "Audit Logs", section: "Administration" };
    if (pathname.startsWith("/notifications")) return { title: "Notifications", section: "Workspace" };
    if (pathname.startsWith("/settings")) return { title: "Settings", section: "Settings" };
    return { title: "Dashboard", section: "Overview" };
  };

  const routeInfo = getRouteInfo(location.pathname);

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 flex flex-col md:flex-row text-slate-900 dark:text-slate-100">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-2">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-600 to-purple-600 text-white font-extrabold flex items-center justify-center text-sm shadow-md shadow-indigo-500/25">
              N
            </div>
            <span className="font-extrabold text-base bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
              NexusOps
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          <NotificationBell />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchModalOpen(true)}
            aria-label="Search"
            className="h-8 w-8 text-slate-500"
          >
            <Search className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation"
            className="h-8 w-8 text-slate-700 dark:text-slate-300"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Sidebar Desktop (Full Height, Fixed & Aesthetic) */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 h-screen sticky top-0 border-r border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-20 shadow-xs">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-600 to-purple-600 text-white font-extrabold flex items-center justify-center text-lg shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              N
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-extrabold text-base tracking-tight leading-tight text-slate-900 dark:text-white">
                  NexusOps AI
                </h2>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[11px] font-medium text-slate-400 truncate max-w-[140px]">
                  {user?.organization?.name || (user?.role === "SUPER_ADMIN" ? "Platform Control" : "Enterprise Suite")}
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Workspace
          </div>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-50 via-indigo-50/60 to-transparent dark:from-indigo-950/70 dark:via-indigo-950/40 dark:to-transparent text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs border-l-3 border-indigo-600 dark:border-indigo-500"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                <Icon
                  className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                    isActive
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info Bottom */}
        <div className="p-3.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 shadow-xs">
            <Link to="/settings" className="flex items-center gap-2.5 min-w-0 group cursor-pointer">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/20">
                {getInitials(user?.name)}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {user?.name || "User"}
                </p>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  <Badge variant={roleBadgeVariant(user?.role)} className="text-[9px] py-0 px-1.5 font-semibold">
                    {user?.role || "EMPLOYEE"}
                  </Badge>
                  {user?.organization?.slug && (
                    <span className="text-[10px] text-slate-400 truncate max-w-[75px]">
                      @{user.organization.slug}
                    </span>
                  )}
                </div>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              title="Sign Out"
              aria-label="Sign Out"
              className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors rounded-lg"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col">
          <div className="w-64 bg-white dark:bg-slate-900 h-full flex flex-col shadow-xl">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-bold text-base">Menu</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close Menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                      isActive
                        ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" className="w-full justify-center gap-2" onClick={logout}>
                <LogOut className="h-4 w-4" /> Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Desktop (Modern, Attractive Navbar) */}
        <header className="hidden md:flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md px-6 py-3 sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Link to="/dashboard" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1 font-medium">
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                {routeInfo.title}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Search Trigger */}
            <button
              type="button"
              onClick={() => setSearchModalOpen(true)}
              className="flex items-center gap-3 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all w-56 lg:w-72 text-xs font-normal cursor-pointer shadow-2xs"
              aria-label="Open command palette (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="flex-1 text-left truncate">Search or jump to...</span>
              <kbd className="text-[10px] bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 font-semibold text-slate-500 shrink-0 shadow-2xs">
                Ctrl K
              </kbd>
            </button>

            {/* Quick action: New Request */}
            <Link to="/requests/new">
              <Button size="sm" className="h-8 px-3 text-xs gap-1.5 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-500/20 rounded-lg">
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">New Request</span>
              </Button>
            </Link>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

            {/* Live Notification Bell */}
            <NotificationBell />

            {/* Light / Dark Mode Toggle */}
            <ThemeToggle />

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

            {/* User Dropdown / Info */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              >
                <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                  {getInitials(user?.name)}
                </div>
                <div className="hidden lg:block">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-none">
                    {user?.name}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{user?.email}</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xl z-50">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {user?.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                      <Badge variant={roleBadgeVariant(user?.role)} className="mt-1.5 text-[10px]">
                        {user?.role}
                      </Badge>
                    </div>
                    <div className="pt-1 space-y-0.5">
                      <Link
                        to="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg cursor-pointer transition-colors"
                      >
                        <Settings className="h-3.5 w-3.5 text-slate-500" />
                        Profile & Settings
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg cursor-pointer transition-colors"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-6 md:p-8">
          <Outlet />
        </main>
      </div>

      {/* Global Search Palette Modal (Ctrl+K) */}
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />

      {/* Non-blocking CSAT Survey Modal for fulfilled requests */}
      <CsatSurveyModal />
    </div>
  );
};
