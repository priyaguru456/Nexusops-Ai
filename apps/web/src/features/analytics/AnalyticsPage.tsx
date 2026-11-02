import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BarChart3,
  FileText,
  CheckSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Zap,
  DollarSign,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import {
  useAnalyticsOverview,
  useRequestsAnalytics,
  useTasksAnalytics,
  useAIUsageAnalytics,
} from "./api";
import { StatCard } from "./components/StatCard";
import { DateRangeFilter } from "./components/DateRangeFilter";
import { CSVExportButton } from "./components/CSVExportButton";
import {
  TimeSeriesChart,
  CategoryPieChart,
  SimpleBarChart,
  TopDocumentsChart,
  EmptyChartState,
} from "./components/Charts";
import { AnalyticsSkeletons } from "./components/AnalyticsSkeletons";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";

export const AnalyticsPage: React.FC = () => {
  const { user, role } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"overview" | "requests" | "tasks" | "ai">("overview");

  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  // React Query hooks with date range in query keys
  const overviewQuery = useAnalyticsOverview(from, to);
  const requestsQuery = useRequestsAnalytics(from, to);
  const tasksQuery = useTasksAnalytics(from, to);
  const aiQuery = useAIUsageAnalytics(from, to, role === "ADMIN");

  const scopeLabel =
    role === "ADMIN"
      ? "Company-Wide Scope"
      : role === "MANAGER"
      ? `${user?.department?.name || "Team"} Department Scope`
      : "Personal Scope";

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Operations & AI Analytics
            </h1>
            <Badge variant="outline" className="text-[11px] font-medium border-indigo-200 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300">
              {scopeLabel}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time performance indicators, workflow metrics, and AI document assistance telemetry.
          </p>
        </div>

        {/* Date Filter & CSV Export Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          <DateRangeFilter />
          <CSVExportButton from={from} to={to} />
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
            activeTab === "overview"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("requests")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
            activeTab === "requests"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Requests & Approvals</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tasks")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
            activeTab === "tasks"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Tasks & Execution</span>
        </button>

        {role === "ADMIN" && (
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
              activeTab === "ai"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>AI Telemetry (Admin)</span>
          </button>
        )}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <>
          {overviewQuery.isLoading ? (
            <AnalyticsSkeletons />
          ) : overviewQuery.isError ? (
            <div className="p-6 text-center text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-200">
              Error loading analytics overview: {overviewQuery.error.message}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Open Requests"
                  value={overviewQuery.data?.totals.open ?? 0}
                  subtitle={`${overviewQuery.data?.totals.totalRequests ?? 0} total requests in period`}
                  icon={FileText}
                  variant="default"
                />

                <StatCard
                  title="Approved Requests"
                  value={overviewQuery.data?.totals.approved ?? 0}
                  subtitle={`${overviewQuery.data?.totals.completed ?? 0} fulfilled / completed`}
                  icon={CheckCircle2}
                  variant="success"
                />

                <StatCard
                  title="Overdue Tasks"
                  value={overviewQuery.data?.tasks.overdue ?? 0}
                  subtitle={`Out of ${overviewQuery.data?.tasks.total ?? 0} assigned tasks`}
                  icon={AlertTriangle}
                  variant={overviewQuery.data?.tasks.overdue ? "danger" : "default"}
                />

                <StatCard
                  title="Avg Approval Time"
                  value={
                    overviewQuery.data?.performance.avgApprovalTimeHours !== null
                      ? `${overviewQuery.data?.performance.avgApprovalTimeHours}h`
                      : "N/A"
                  }
                  subtitle={
                    overviewQuery.data?.performance.avgCompletionTimeHours !== null
                      ? `Avg complete: ${overviewQuery.data?.performance.avgCompletionTimeHours}h`
                      : "Pending completion data"
                  }
                  icon={Clock}
                  variant="info"
                />
              </div>

              {/* Charts Row: Requests Over Time + Category Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-slate-200 dark:border-slate-800">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold">Requests Over Time</CardTitle>
                    <CardDescription className="text-xs">
                      Daily request submissions across the selected window
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <TimeSeriesChart
                      data={overviewQuery.data?.requestsOverTime || []}
                      name="Requests"
                      color="#6366f1"
                    />
                  </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold">Category Breakdown</CardTitle>
                    <CardDescription className="text-xs">
                      Distribution by organizational department
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <CategoryPieChart data={overviewQuery.data?.requestsByCategory || []} />
                  </CardContent>
                </Card>
              </div>

              {/* Tasks Status Overview */}
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold">Task Fulfillment Lifecycle</CardTitle>
                  <CardDescription className="text-xs">
                    Current distribution across operational states
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <SimpleBarChart
                    data={[
                      { label: "TODO", count: overviewQuery.data?.tasks.todo || 0 },
                      { label: "In Progress", count: overviewQuery.data?.tasks.inProgress || 0 },
                      { label: "Blocked", count: overviewQuery.data?.tasks.blocked || 0 },
                      { label: "Done", count: overviewQuery.data?.tasks.done || 0 },
                    ]}
                    color="#10b981"
                    name="Tasks"
                  />
                </CardContent>
              </Card>

              {/* AI Quick Summary (if present) */}
              {overviewQuery.data?.aiSummary && (
                <div className="p-5 rounded-2xl border border-indigo-100 dark:border-indigo-950/60 bg-gradient-to-r from-indigo-50/50 via-slate-50 to-purple-50/50 dark:from-slate-900 dark:to-indigo-950/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      AI Document Assistant Activity
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-slate-500">Inquiries Answered</p>
                      <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
                        {overviewQuery.data.aiSummary.totalQuestions}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Not-Found Rate</p>
                      <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
                        {overviewQuery.data.aiSummary.notFoundRatePercent !== null
                          ? `${overviewQuery.data.aiSummary.notFoundRatePercent}%`
                          : "0%"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Average Latency</p>
                      <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
                        {overviewQuery.data.aiSummary.avgLatencyMs
                          ? `${overviewQuery.data.aiSummary.avgLatencyMs}ms`
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Estimated Token Cost</p>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        ${overviewQuery.data.aiSummary.estimatedCostUsd.toFixed(4)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* TAB 2: REQUESTS & APPROVALS */}
      {activeTab === "requests" && (
        <>
          {requestsQuery.isLoading ? (
            <AnalyticsSkeletons />
          ) : requestsQuery.isError ? (
            <div className="p-6 text-center text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-200">
              Error loading requests analytics: {requestsQuery.error.message}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Requests by Priority */}
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold">Requests by Priority</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <SimpleBarChart
                      data={(requestsQuery.data?.byPriority || []).map((p) => ({
                        label: p.priority,
                        count: p.count,
                      }))}
                      color="#f59e0b"
                      name="Priority Count"
                    />
                  </CardContent>
                </Card>

                {/* Requests by Status */}
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold">Requests by Status</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <SimpleBarChart
                      data={(requestsQuery.data?.byStatus || []).map((s) => ({
                        label: s.status,
                        count: s.count,
                      }))}
                      color="#6366f1"
                      name="Status Count"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Top Approvers Table */}
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold">Top Decision Approvers</CardTitle>
                  <CardDescription className="text-xs">
                    Approvers with highest decision throughput and average turnaround time
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {(!requestsQuery.data?.topApprovers || requestsQuery.data.topApprovers.length === 0) ? (
                    <EmptyChartState message="No approval decisions recorded in this date range." height={160} />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                            <th className="py-2.5 px-3">Approver</th>
                            <th className="py-2.5 px-3">Role</th>
                            <th className="py-2.5 px-3 text-right">Decisions Made</th>
                            <th className="py-2.5 px-3 text-right">Avg Decision Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {requestsQuery.data.topApprovers.map((a) => (
                            <tr key={a.approverId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                              <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                                {a.approverName}
                              </td>
                              <td className="py-2.5 px-3">
                                <Badge variant="outline" className="text-[10px]">
                                  {a.role}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                {a.decidedStepsCount}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                                {a.avgDecisionHours !== null ? `${a.avgDecisionHours}h` : "N/A"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bottleneck Approval Steps */}
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold">Approval Flow Bottlenecks</CardTitle>
                  <CardDescription className="text-xs">
                    Pending counts and duration metrics across multi-step approval stages
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {(!requestsQuery.data?.bottleneckSteps || requestsQuery.data.bottleneckSteps.length === 0) ? (
                    <EmptyChartState message="No multi-step approval data found." height={140} />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {requestsQuery.data.bottleneckSteps.map((step) => (
                        <div
                          key={`${step.stepOrder}-${step.approverRole}`}
                          className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                              Step {step.stepOrder} ({step.approverRole})
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                step.pendingCount > 0
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              }`}
                            >
                              {step.pendingCount} Pending
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 space-y-0.5">
                            <p>Approved: {step.approvedCount} · Rejected: {step.rejectedCount}</p>
                            <p className="font-medium text-slate-700 dark:text-slate-300">
                              Avg time to decide: {step.avgHoursToDecide !== null ? `${step.avgHoursToDecide}h` : "N/A"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* TAB 3: TASKS */}
      {activeTab === "tasks" && (
        <>
          {tasksQuery.isLoading ? (
            <AnalyticsSkeletons />
          ) : tasksQuery.isError ? (
            <div className="p-6 text-center text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-200">
              Error loading tasks analytics: {tasksQuery.error.message}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Assignee Breakdown Table */}
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold">Tasks by Assignee</CardTitle>
                  <CardDescription className="text-xs">
                    Workload distribution, completion rates, and overdue tasks per operator
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {(!tasksQuery.data?.byAssignee || tasksQuery.data.byAssignee.length === 0) ? (
                    <EmptyChartState message="No assigned tasks found for this period." height={160} />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                            <th className="py-2.5 px-3">Assignee</th>
                            <th className="py-2.5 px-3 text-right">Total Tasks</th>
                            <th className="py-2.5 px-3 text-right">Completed</th>
                            <th className="py-2.5 px-3 text-right">Overdue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {tasksQuery.data.byAssignee.map((a) => (
                            <tr key={a.assigneeId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                              <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                                {a.assigneeName}
                              </td>
                              <td className="py-2.5 px-3 text-right font-medium">{a.totalTasks}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                {a.completedTasks}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400">
                                {a.overdueTasks}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Overdue Tasks List */}
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">Overdue Tasks</CardTitle>
                      <CardDescription className="text-xs">
                        Tasks past their deadline requiring immediate resolution
                      </CardDescription>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      {tasksQuery.data?.overdueTasksCount ?? 0} Overdue
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {(!tasksQuery.data?.overdueTasks || tasksQuery.data.overdueTasks.length === 0) ? (
                    <EmptyChartState message="No tasks are currently overdue. Everything is on schedule!" height={140} />
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-80 overflow-y-auto">
                      {tasksQuery.data.overdueTasks.map((task) => (
                        <div key={task.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {task.title}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Assignee: {task.assigneeName} · Priority: {task.priority}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                              Due: {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* TAB 4: AI INTELLIGENCE (Admin only) */}
      {activeTab === "ai" && role === "ADMIN" && (
        <>
          {aiQuery.isLoading ? (
            <AnalyticsSkeletons />
          ) : aiQuery.isError ? (
            <div className="p-6 text-center text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-200">
              Error loading AI usage analytics: {aiQuery.error.message}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stat Cards Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Questions per Window"
                  value={aiQuery.data?.metrics.totalQuestions ?? 0}
                  subtitle={`${aiQuery.data?.metrics.totalAnswers ?? 0} answers generated`}
                  icon={Bot}
                  variant="default"
                />

                <StatCard
                  title="Not-Found Rate"
                  value={`${aiQuery.data?.metrics.notFoundRatePercent ?? 0}%`}
                  subtitle={`${aiQuery.data?.metrics.notFoundCount ?? 0} missing document queries`}
                  icon={ShieldAlert}
                  variant={
                    (aiQuery.data?.metrics.notFoundRatePercent ?? 0) > 20
                      ? "warning"
                      : "success"
                  }
                />

                <StatCard
                  title="Average Latency"
                  value={
                    aiQuery.data?.metrics.avgLatencyMs
                      ? `${aiQuery.data.metrics.avgLatencyMs}ms`
                      : "N/A"
                  }
                  subtitle="End-to-end RAG token stream"
                  icon={Zap}
                  variant="info"
                />

                <StatCard
                  title="Estimated Token Cost"
                  value={`$${aiQuery.data?.metrics.tokens.estimatedCostUsd.toFixed(4) ?? "0.0000"}`}
                  subtitle="Estimated usage cost (USD)"
                  badge="Estimate"
                  icon={DollarSign}
                  variant="purple"
                />
              </div>

              {/* Questions per Day Line Chart */}
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold">AI Inquiries per Day</CardTitle>
                  <CardDescription className="text-xs">
                    Frequency of conversational questions across employees
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <TimeSeriesChart
                    data={aiQuery.data?.questionsPerDay || []}
                    color="#8b5cf6"
                    name="Inquiries"
                  />
                </CardContent>
              </Card>

              {/* Most-Used Documents Horizontal Chart */}
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold">Most-Referenced Knowledge Assets</CardTitle>
                  <CardDescription className="text-xs">
                    Document chunks most frequently cited in verifiable assistant answers
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <TopDocumentsChart data={aiQuery.data?.mostUsedDocuments || []} />
                </CardContent>
              </Card>

              {/* Feedback & Token Breakdown Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold">User Feedback & Quality</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-1 space-y-3 text-xs">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60">
                      <span>Positive (+1) Thumbs Up</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {aiQuery.data?.metrics.feedback.positive ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60">
                      <span>Negative (-1) Thumbs Down</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">
                        {aiQuery.data?.metrics.feedback.negative ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60">
                      <span>Satisfaction Rate</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {aiQuery.data?.metrics.feedback.satisfactionRatePercent !== null
                          ? `${aiQuery.data?.metrics.feedback.satisfactionRatePercent}%`
                          : "No feedback recorded"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold">Token Volume Telemetry</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-1 space-y-3 text-xs">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60">
                      <span>Input Tokens (Prompt Context)</span>
                      <span className="font-mono font-bold">
                        {(aiQuery.data?.metrics.tokens.inputTokens ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60">
                      <span>Output Tokens (Generated Answer)</span>
                      <span className="font-mono font-bold">
                        {(aiQuery.data?.metrics.tokens.outputTokens ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60">
                      <span>Total Tokens Consumed</span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {(aiQuery.data?.metrics.tokens.totalTokens ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AnalyticsPage;
