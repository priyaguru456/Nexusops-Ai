import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  CheckSquare,
  AlertCircle,
  ExternalLink,
  RotateCw,
  Check,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from "./hooks";
import type { NotificationItem, NotificationType } from "../../types/notifications";
import { formatKolkataDateTime } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Alert } from "../../components/ui/alert";

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 15;

  const { data, isLoading, isError, error, refetch, isFetching } = useNotifications(
    unreadOnly,
    limit,
    page
  );

  const markAsReadMutation = useMarkNotificationAsRead();
  const markAllAsReadMutation = useMarkAllNotificationsAsRead();

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;
  const total = data?.total || notifications.length;
  const totalPages = data?.totalPages || Math.ceil(total / limit) || 1;

  const handleTabChange = (onlyUnread: boolean) => {
    setUnreadOnly(onlyUnread);
    setPage(1);
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await markAsReadMutation.mutateAsync(item.id);
      } catch {
        // Continue even if mark read mutation fails
      }
    }
    if (item.link) {
      navigate(item.link);
    }
  };

  const handleMarkOneRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await markAsReadMutation.mutateAsync(id);
    } catch {
      // Handled by react-query
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync();
    } catch {
      // Handled by react-query
    }
  };

  const getNotificationIcon = (type: NotificationType | string) => {
    switch (type) {
      case "APPROVAL_REQUESTED":
        return <ClipboardCheck className="w-5 h-5 text-amber-500" />;
      case "APPROVAL_DECISION":
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case "APPROVAL_ESCALATED":
        return <ShieldAlert className="w-5 h-5 text-rose-500" />;
      case "APPROVAL_REMINDER":
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case "TASK_ASSIGNED":
        return <CheckSquare className="w-5 h-5 text-indigo-500" />;
      case "REQUEST_STATUS_CHANGED":
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      default:
        return <Bell className="w-5 h-5 text-slate-500" />;
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Notification Center
            </h1>
            {unreadCount > 0 && (
              <Badge variant="default" className="bg-indigo-600 hover:bg-indigo-600">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Stay updated on work requests, approval assignments, and task milestones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 gap-1.5 text-xs text-slate-700 dark:text-slate-300"
            title="Refresh notifications"
            aria-label="Refresh notifications"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0 || markAllAsReadMutation.isPending}
            className="h-9 gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
            aria-label="Mark all notifications as read"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => handleTabChange(false)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              !unreadOnly
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
            aria-pressed={!unreadOnly}
          >
            All Notifications
          </button>
          <button
            type="button"
            onClick={() => handleTabChange(true)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              unreadOnly
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
            aria-pressed={unreadOnly}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-indigo-600 text-[10px] font-bold text-white flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </div>

        {total > 0 && (
          <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="space-y-3">
        {/* Error State */}
        {isError && (
          <Alert variant="destructive" className="my-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>
                  Failed to load notifications: {(error as any)?.message || "A network or server error occurred."}
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          </Alert>
        )}

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="space-y-3" data-testid="notifications-loading">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 flex items-start gap-4 animate-pulse"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-4/5" />
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-800/40 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && notifications.length === 0 && (
          <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <EmptyState
              title={unreadOnly ? "No unread notifications" : "No notifications yet"}
              description={
                unreadOnly
                  ? "You have caught up with all your updates! Check 'All Notifications' to review past alerts."
                  : "When work requests are submitted, tasks assigned, or approvals require your action, they will show up here."
              }
              actionLabel={unreadOnly ? "View all notifications" : undefined}
              onAction={unreadOnly ? () => handleTabChange(false) : undefined}
            />
          </div>
        )}

        {/* Notification List Items */}
        {!isLoading &&
          !isError &&
          notifications.length > 0 &&
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
              className={`group p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                item.isRead
                  ? "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs"
                  : "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200/80 dark:border-indigo-900/60 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/35 shadow-xs"
              }`}
            >
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                <div
                  className={`p-2.5 rounded-xl shrink-0 border ${
                    item.isRead
                      ? "bg-slate-100 dark:bg-slate-800 border-slate-200/60 dark:border-slate-700/60"
                      : "bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-800 shadow-2xs"
                  }`}
                >
                  {getNotificationIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3
                      className={`text-sm font-semibold truncate ${
                        item.isRead
                          ? "text-slate-800 dark:text-slate-200"
                          : "text-slate-900 dark:text-slate-100 font-bold"
                      }`}
                    >
                      {item.title || "Notification"}
                    </h3>

                    {item.entityType && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {item.entityType}
                      </span>
                    )}

                    {!item.isRead && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400">
                        NEW
                      </span>
                    )}
                  </div>

                  <p
                    className={`text-xs sm:text-sm leading-relaxed ${
                      item.isRead
                        ? "text-slate-600 dark:text-slate-400"
                        : "text-slate-700 dark:text-slate-300 font-medium"
                    }`}
                  >
                    {item.message}
                  </p>

                  <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400 dark:text-slate-500">
                    <span title={`Time in Asia/Kolkata: ${formatKolkataDateTime(item.createdAt)}`}>
                      {formatRelativeTime(item.createdAt)}
                    </span>
                    <span>•</span>
                    <span className="text-slate-400">
                      {formatKolkataDateTime(item.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {!item.isRead && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleMarkOneRead(e, item.id)}
                    className="h-8 px-2.5 text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800"
                    title="Mark as read"
                    aria-label="Mark notification as read"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    <span>Mark read</span>
                  </Button>
                )}

                {item.link && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNotificationClick(item);
                    }}
                    className="h-8 px-3 text-xs gap-1 font-semibold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60"
                  >
                    <span>Open</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Page {page} of {totalPages}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="h-8 px-2.5 text-xs gap-1"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="h-8 px-2.5 text-xs gap-1"
              aria-label="Next page"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
