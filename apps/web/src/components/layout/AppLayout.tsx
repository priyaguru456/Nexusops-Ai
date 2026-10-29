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
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../../features/auth/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { Role } from "../../types/auth";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
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
    roles: ["MANAGER", "ADMIN"],
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
];

export const AppLayout: React.FC = () => {
  const { user, role, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const visibleNavItems = NAV_ITEMS.filter((item) => (role ? item.roles.includes(role) : false));

  const roleBadgeVariant = (userRole?: Role) => {
    switch (userRole) {
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row text-slate-900 dark:text-slate-100">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow">
            N
          </div>
          <span className="font-bold text-lg text-slate-900 dark:text-white">NexusOps</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-base shadow-md shadow-indigo-500/20">
            N
          </div>
          <div>
            <h2 className="font-bold text-base leading-tight text-slate-900 dark:text-white">
              NexusOps AI
            </h2>
            <p className="text-xs text-slate-400">Enterprise Suite</p>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Navigation
          </div>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Info Bottom */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                {getInitials(user?.name)}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {user?.name || "User"}
                </p>
                <Badge variant={roleBadgeVariant(user?.role)} className="mt-0.5 text-[10px] py-0 px-1.5">
                  {user?.role || "EMPLOYEE"}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              title="Sign Out"
              aria-label="Sign Out"
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50"
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
        {/* Top Bar Desktop */}
        <header className="hidden md:flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-6 py-3 sticky top-0 z-30">
          <div>
            <h1 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              NexusOps Platform
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell Placeholder */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                title="Notifications"
                aria-label="Notifications"
                className="relative text-slate-600 dark:text-slate-400"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-indigo-600" />
              </Button>
            </div>

            {/* Light / Dark Mode Toggle */}
            <ThemeToggle />

            <div className="h-4 w-px bg-slate-200 dark:border-slate-700" />

            {/* User Dropdown / Info */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
              >
                <div className="h-8 w-8 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center">
                  {getInitials(user?.name)}
                </div>
                <div className="hidden lg:block">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-none">
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
                    <div className="pt-1">
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
    </div>
  );
};
