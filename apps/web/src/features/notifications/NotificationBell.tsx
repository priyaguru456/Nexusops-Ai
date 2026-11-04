import React, { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  CheckSquare,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from "./hooks";
import type { NotificationItem, NotificationType } from "../../types/notifications";
import { formatKolkataDateTime } from "../../lib/utils";

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Fetch latest 10 notifications for the dropdown
  const { data, isLoading } = useNotifications(false, 10);
  const markAsReadMutation = useMarkNotificationAsRead();
  const markAllAsReadMutation = useMarkAllNotificationsAsRead();

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await markAsReadMutation.mutateAsync(item.id);
      } catch (err) {
        // Continue navigation even if mark read encounters an error
      }
    }
    setIsOpen(false);
    if (item.link) {
      navigate(item.link);
    } else {
      navigate("/notifications");
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsReadMutation.mutateAsync();
  };

  const getNotificationIcon = (type: NotificationType | string) => {
    switch (type) {
      case "APPROVAL_REQUESTED":
        return <ClipboardCheck className="w-4 h-4 text-amber-500" />;
      case "APPROVAL_DECISION":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "APPROVAL_ESCALATED":
        return <ShieldAlert className="w-4 h-4 text-rose-500" />;
      case "APPROVAL_REMINDER":
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case "TASK_ASSIGNED":
        return <CheckSquare className="w-4 h-4 text-indigo-500" />;
      case "REQUEST_STATUS_CHANGED":
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return formatKolkataDateTime(dateStr);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        title="Notifications"
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
        }
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            data-testid="notification-unread-badge"
            className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-in zoom-in-50"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Notification Center"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markAllAsReadMutation.isPending}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                aria-label="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List of Latest 10 Notifications */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
                      <div className="h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <Bell className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  No notifications yet
                </p>
                <p className="text-[11px] text-slate-400">
                  You'll be notified when approvals, tasks, or status changes are assigned to you.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleNotificationClick(item);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${item.title || "Notification"}: ${item.message}`}
                  className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer select-none text-left focus:outline-none focus:bg-slate-100/80 dark:focus:bg-slate-800 ${
                    item.isRead
                      ? "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      : "bg-indigo-50/50 dark:bg-indigo-950/25 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/45"
                  }`}
                >
                  <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50">
                    {getNotificationIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    {item.title && (
                      <p
                        className={`text-xs font-semibold leading-tight truncate ${
                          item.isRead
                            ? "text-slate-700 dark:text-slate-300"
                            : "text-slate-900 dark:text-slate-100"
                        }`}
                      >
                        {item.title}
                      </p>
                    )}

                    <p
                      className={`text-xs leading-snug line-clamp-2 ${
                        item.isRead
                          ? "text-slate-600 dark:text-slate-400"
                          : "text-slate-800 dark:text-slate-200 font-medium"
                      }`}
                    >
                      {item.message}
                    </p>

                    <div className="flex items-center gap-2 pt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                      <span title={formatKolkataDateTime(item.createdAt)}>
                        {formatRelativeTime(item.createdAt)}
                      </span>
                      {item.link && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-0.5 text-indigo-500 dark:text-indigo-400 hover:underline">
                            Open <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {!item.isRead && (
                    <span
                      aria-label="Unread"
                      className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1.5 ring-2 ring-indigo-200 dark:ring-indigo-900"
                    />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer linking to full /notifications page */}
          <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="w-full py-1.5 text-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center justify-center gap-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <span>View all notifications</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
