import React from "react";
import { Link } from "react-router-dom";
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
} from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { useAnalyticsOverview } from "../features/analytics/api";
import { StatCard } from "../features/analytics/components/StatCard";
import {
  TimeSeriesChart,
  CategoryPieChart,
  EmptyChartState,
} from "../features/analytics/components/Charts";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";

export const DashboardPage: React.FC = () => {
  const { user, role } = useAuth();
  const { data: overview, isLoading } = useAnalyticsOverview();

  const formatHours = (hours: number | null): string => {
    if (hours === null || hours === undefined) return "N/A";
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  const scopeLabel =
    role === "ADMIN"
      ? "Company-Wide Operations"
      : role === "MANAGER"
      ? `${user?.department?.name || "Departmental"} Team Overview`
      : "Personal Workspace";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 p-6 sm:p-8 text-white shadow-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium text-indigo-100 border border-white/15">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>{scopeLabel}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.name || "Operator"}!
            </h1>
            <p className="text-indigo-100 text-sm max-w-xl">
              Monitor operational KPIs, track active workflows, and collaborate with NexusOps AI assistant.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link to="/requests/new">
              <Button className="bg-white text-indigo-700 hover:bg-indigo-50 font-semibold shadow-sm">
                <FileText className="h-4 w-4 mr-2" />
                New Request
              </Button>
            </Link>
            <Link to="/ai">
              <Button variant="outline" className="border-white/30 text-white bg-white/10 hover:bg-white/20">
                <Bot className="h-4 w-4 mr-2" />
                Ask Assistant
              </Button>
            </Link>
            <Link to="/analytics">
              <Button variant="outline" className="border-white/30 text-white bg-white/10 hover:bg-white/20">
                <TrendingUp className="h-4 w-4 mr-2" />
                Full Analytics
              </Button>
            </Link>
          </div>
        </div>
      </div>

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

            {role === "ADMIN" && (
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

      {/* Main Charts & Quick Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Time-series request volume chart */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-semibold">Request Activity Over Time</CardTitle>
                <CardDescription>Daily volume trends for the last 30 days</CardDescription>
              </div>
              <Link
                to="/analytics"
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
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
          <Card>
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

      {/* Bottom Quick Access / Status Rows */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Quick Nav Card 1: Requests */}
        <Card className="hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
          <CardContent className="p-5 flex items-start gap-4">
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Work Requests
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {role === "EMPLOYEE"
                  ? "Track approvals and submission statuses for your requests."
                  : "Review, process, and track requests across workflows."}
              </p>
              <Link
                to="/requests"
                className="mt-3 inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline gap-1"
              >
                Go to Requests <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick Nav Card 2: Tasks */}
        <Card className="hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
          <CardContent className="p-5 flex items-start gap-4">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckSquare className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Action Tasks
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {overview?.tasks.overdue ? (
                  <span className="text-rose-600 dark:text-rose-400 font-medium">
                    {overview.tasks.overdue} task(s) overdue and require resolution.
                  </span>
                ) : (
                  "All task assignments are currently on schedule."
                )}
              </p>
              <Link
                to="/tasks"
                className="mt-3 inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline gap-1"
              >
                Go to Tasks <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick Nav Card 3: AI Assistant */}
        <Card className="hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
          <CardContent className="p-5 flex items-start gap-4">
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                AI Knowledge Assistant
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Query enterprise policies and get cited answers with page references.
              </p>
              <Link
                to="/ai"
                className="mt-3 inline-flex items-center text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline gap-1"
              >
                Open Assistant <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
