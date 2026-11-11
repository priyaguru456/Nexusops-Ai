import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FileText,
  CheckSquare,
  Clock,
  AlertTriangle,
  Bot,
  ArrowRight,
  TrendingUp,
  Calendar,
  Sparkles,
  Bell,
  Check,
  CheckCircle2,
  ClipboardCheck,
  AlertCircle,
  ExternalLink,
  Plus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../features/auth/AuthContext";
import { useAnalyticsOverview } from "../features/analytics/api";
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from "../features/notifications/hooks";
import { useTasks } from "../features/tasks/hooks";
import { matchesDueDateFilter } from "../features/tasks/taskUtils";
import { APPROVAL_KEYS } from "../features/approvals/hooks";
import { approvalsApi } from "../features/approvals/api";
import { StatCard } from "../features/analytics/components/StatCard";
import {
  TimeSeriesChart,
  CategoryPieChart,
  EmptyChartState,
} from "../features/analytics/components/Charts";
import { CompanyNewsWidget } from "../features/announcements/CompanyNewsWidget";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";

export function getKolkataGreeting(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const hour = parseInt(formatter.format(date), 10);
  if (hour >= 5 && hour < 12) {
    return "Good morning";
  } else if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  } else {
    return "Good evening";
  }
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const {
    data: overview,
    isLoading,
    isError: isOverviewError,
    error: overviewError,
    refetch: refetchOverview,
  } = useAnalyticsOverview();
  const { data: notifData, isLoading: notifLoading } = useNotifications(false, 6);
  const markAsReadMutation = useMarkNotificationAsRead();
  const markAllAsReadMutation = useMarkAllNotificationsAsRead();

  // Real data: tasks due today for current user
  const { data: userTasksData } = useTasks({
    assigneeId: user?.id,
    limit: 100,
  });

  const tasksDueTodayCount = useMemo(() => {
    if (!userTasksData?.tasks) return 0;
    return userTasksData.tasks.filter(
      (task) => task.status !== "DONE" && matchesDueDateFilter(task, "today")
    ).length;
  }, [userTasksData]);

  // Real data: requests awaiting my approval (Manager / Admin / Super Admin only)
  const canApprove = role === "MANAGER" || role === "ADMIN" || role === "SUPER_ADMIN";
  const { data: pendingApprovalsData } = useQuery({
    queryKey: APPROVAL_KEYS.pending(),
    queryFn: () => approvalsApi.getPending(),
    enabled: canApprove,
  });

  const pendingApprovalsCount = canApprove
    ? pendingApprovalsData?.steps?.length ?? 0
    : 0;

  const notifications = notifData?.notifications || [];
  const unreadCount = notifData?.unreadCount || 0;

  const handleNotificationClick = async (item: { id: string; isRead: boolean; link?: string | null }) => {
    if (!item.isRead) {
      await markAsReadMutation.mutateAsync(item.id);
    }
    if (item.link) {
      navigate(item.link);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "APPROVAL_REQUESTED":
        return <ClipboardCheck className="w-4 h-4 text-amber-500" />;
      case "APPROVAL_DECISION":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "TASK_ASSIGNED":
        return <CheckSquare className="w-4 h-4 text-indigo-500" />;
      case "REQUEST_STATUS_CHANGED":
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const formatHours = (hours: number | null): string => {
    if (hours === null || hours === undefined) return "N/A";
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  const scopeLabel =
    role === "SUPER_ADMIN"
      ? "Platform-Wide Multi-Tenant Operations"
      : role === "ADMIN"
      ? "Company-Wide Operations"
      : role === "MANAGER"
      ? `${user?.department?.name || "Departmental"} Team Overview`
      : "Personal Workspace";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Executive Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs">
        {/* Soft decorative glow */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/70 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                {scopeLabel}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date().toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {getKolkataGreeting()}, {user?.name || "Operator"}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl">
              Monitor operational KPIs, track workflow pipelines, and collaborate with AI assistant.
            </p>

            {/* Real Counts Badges: Tasks due today & Requests awaiting approval */}
            {(tasksDueTodayCount > 0 || (canApprove && pendingApprovalsCount > 0)) && (
              <div className="flex flex-wrap items-center gap-2 pt-1.5" role="region" aria-label="Actionable reminders">
                {tasksDueTodayCount > 0 && (
                  <Link
                    to="/tasks"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors shadow-2xs"
                    aria-label={`${tasksDueTodayCount} task${tasksDueTodayCount === 1 ? "" : "s"} due today`}
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>
                      {tasksDueTodayCount} {tasksDueTodayCount === 1 ? "task" : "tasks"} due today
                    </span>
                  </Link>
                )}

                {canApprove && pendingApprovalsCount > 0 && (
                  <Link
                    to="/approvals"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shadow-2xs"
                    aria-label={`${pendingApprovalsCount} request${pendingApprovalsCount === 1 ? "" : "s"} awaiting my approval`}
                  >
                    <ClipboardCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>
                      {pendingApprovalsCount} {pendingApprovalsCount === 1 ? "request" : "requests"} awaiting my approval
                    </span>
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link to="/requests/new">
              <Button className="h-9 px-4 gap-2 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-500/20 rounded-xl">
                <Plus className="h-4 w-4" />
                <span>New Request</span>
              </Button>
            </Link>
            <Link to="/ai">
              <Button
                variant="outline"
                className="h-9 px-3.5 gap-2 font-semibold rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Bot className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>Ask Assistant</span>
              </Button>
            </Link>
            <Link to="/analytics">
              <Button
                variant="outline"
                className="h-9 px-3.5 gap-2 font-semibold rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Analytics</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Overview Error Alert Banner */}
      {isOverviewError && (
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>
              {(overviewError as any)?.response?.data?.error ||
                (overviewError as any)?.response?.data?.message ||
                (overviewError as Error)?.message ||
                "Failed to load analytics overview."}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetchOverview()}
            className="border-rose-300 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Role-Specific Metric Stat Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Last 30 Days Key Metrics
          </h2>
          <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Auto-scoped to your role
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {role === "EMPLOYEE" && (
              <>
                <StatCard
                  title="My Requests"
                  value={overview?.totals.totalRequests ?? 0}
                  subtitle={`${overview?.totals.completed ?? 0} completed`}
                  icon={FileText}
                  variant="info"
                />
                <StatCard
                  title="In Progress"
                  value={overview?.totals.open ?? 0}
                  subtitle="Awaiting approvals"
                  icon={Clock}
                  variant="warning"
                />
                <StatCard
                  title="Assigned Tasks"
                  value={overview?.tasks.total ?? 0}
                  subtitle={`${overview?.tasks.done ?? 0} finished`}
                  icon={CheckSquare}
                  variant="success"
                />
                <StatCard
                  title="Overdue Tasks"
                  value={overview?.tasks.overdue ?? 0}
                  subtitle={overview?.tasks.overdue ? "Needs attention" : "All on schedule"}
                  icon={AlertTriangle}
                  variant={overview?.tasks.overdue ? "danger" : "default"}
                />
              </>
            )}

            {role === "MANAGER" && (
              <>
                <StatCard
                  title="Team Requests"
                  value={overview?.totals.totalRequests ?? 0}
                  subtitle={`${overview?.totals.open ?? 0} currently active`}
                  icon={FileText}
                  variant="info"
                />
                <StatCard
                  title="Pending Approvals"
                  value={overview?.totals.open ?? 0}
                  subtitle="In department queue"
                  icon={Clock}
                  variant="warning"
                />
                <StatCard
                  title="Avg Approval Time"
                  value={formatHours(overview?.performance.avgApprovalTimeHours ?? null)}
                  subtitle="Decision turnaround"
                  icon={TrendingUp}
                  variant="purple"
                />
                <StatCard
                  title="Team Overdue Tasks"
                  value={overview?.tasks.overdue ?? 0}
                  subtitle={overview?.tasks.overdue ? "Requires follow-up" : "Zero overdue"}
                  icon={AlertTriangle}
                  variant={overview?.tasks.overdue ? "danger" : "default"}
                />
              </>
            )}

            {(role === "ADMIN" || role === "SUPER_ADMIN") && (
              <>
                <StatCard
                  title="Company Requests"
                  value={overview?.totals.totalRequests ?? 0}
                  subtitle={`${overview?.totals.completed ?? 0} completed`}
                  icon={FileText}
                  variant="info"
                />
                <StatCard
                  title="Total Tasks"
                  value={overview?.tasks.total ?? 0}
                  subtitle={`${overview?.tasks.overdue ?? 0} overdue`}
                  icon={CheckSquare}
                  variant="success"
                />
                <StatCard
                  title="Avg Completion"
                  value={formatHours(overview?.performance.avgCompletionTimeHours ?? null)}
                  subtitle="Workflow end-to-end"
                  icon={Clock}
                  variant="warning"
                />
                <StatCard
                  title="AI Token Cost"
                  value={
                    overview?.aiSummary
                      ? `$${overview.aiSummary.estimatedCostUsd.toFixed(2)}`
                      : "$0.00"
                  }
                  subtitle={`${overview?.aiSummary?.totalQuestions ?? 0} questions asked`}
                  icon={Bot}
                  variant="purple"
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Time-series request volume chart */}
        <div className="lg:col-span-2">
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xs h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-semibold">Request Activity Over Time</CardTitle>
                <CardDescription>Daily volume trends for the last 30 days</CardDescription>
              </div>
              <Link
                to="/analytics"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                Detailed breakdown <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {overview && overview.requestsOverTime.length > 0 ? (
                <TimeSeriesChart
                  data={overview.requestsOverTime}
                  height={260}
                  color="#6366f1"
                />
              ) : (
                <EmptyChartState message="No request volume recorded in this time period" height={260} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Categories Distribution */}
        <div className="lg:col-span-1">
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xs h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-semibold">Requests by Category</CardTitle>
                <CardDescription>Breakdown by operational category</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {overview && overview.requestsByCategory.length > 0 ? (
                <CategoryPieChart
                  data={overview.requestsByCategory.map((c) => ({
                    category: c.category.replace(/_/g, " "),
                    count: c.count,
                  }))}
                  height={260}
                />
              ) : (
                <EmptyChartState message="No category data available" height={260} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Announcements, Notifications Hub & Quick Workflows Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Company News + System Notifications */}
        <div className="lg:col-span-2 space-y-6">
          <CompanyNewsWidget />

          {/* System Notifications Hub */}
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      System Notifications & Alerts
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {unreadCount > 0
                        ? `${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}`
                        : "All caught up"}
                    </CardDescription>
                  </div>
                </div>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllAsReadMutation.mutate()}
                    disabled={markAllAsReadMutation.isPending}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark all as read</span>
                  </button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-80 overflow-y-auto">
                {notifLoading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"
                      />
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-10 px-6 text-center space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <Bell className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      No notifications yet
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Approval actions, task assignments, and status updates will appear here in
                      real-time.
                    </p>
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer group ${
                        item.isRead
                          ? "hover:bg-slate-50 dark:hover:bg-slate-850/50"
                          : "bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                        {getNotificationIcon(item.type)}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <p
                          className={`text-xs leading-snug line-clamp-2 ${
                            item.isRead
                              ? "text-slate-700 dark:text-slate-300"
                              : "font-semibold text-slate-900 dark:text-slate-100"
                          }`}
                        >
                          {item.message}
                        </p>

                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span>{formatTimestamp(item.createdAt)}</span>
                          {item.link && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-0.5 text-indigo-500 font-medium group-hover:underline">
                                View <ExternalLink className="w-2.5 h-2.5" />
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1.5" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Workflow Action Cards */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
            <CardContent className="p-4 flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Work Requests
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Track and review requests across pipelines.
                </p>
                <Link
                  to="/requests"
                  className="mt-2 inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline gap-1"
                >
                  Manage Requests <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
            <CardContent className="p-4 flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckSquare className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Action Tasks
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {overview?.tasks.overdue
                    ? `${overview.tasks.overdue} task(s) overdue.`
                    : "All tasks on schedule."}
                </p>
                <Link
                  to="/tasks"
                  className="mt-2 inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline gap-1"
                >
                  View Tasks <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xs hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
            <CardContent className="p-4 flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 shrink-0">
                <Bot className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  AI Knowledge Assistant
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  RAG answers with verified policy citations.
                </p>
                <Link
                  to="/ai"
                  className="mt-2 inline-flex items-center text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline gap-1"
                >
                  Ask AI Assistant <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

