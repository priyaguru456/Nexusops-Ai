import React, { useState } from "react";
import {
  Shield,
  Filter,
  RotateCcw,
  Code,
  Calendar,
  X,
} from "lucide-react";
import { useAuditLogs } from "./hooks";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { Button } from "../../components/ui/button";
import type { AuditLogItem, AuditLogQueryFilters } from "../../types/audit";

export const AuditLogPage: React.FC = () => {
  const [filters, setFilters] = useState<AuditLogQueryFilters>({
    page: 1,
    limit: 15,
  });

  const [selectedMetadata, setSelectedMetadata] = useState<Record<string, unknown> | null>(null);

  const { data, isLoading } = useAuditLogs(filters);

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const page = data?.page || 1;

  const handleFilterChange = (key: keyof AuditLogQueryFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
      page: 1, // reset page on filter change
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      page: 1,
      limit: 15,
    });
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("APPROVED")) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    if (action.includes("REJECTED") || action.includes("CANCELLED")) return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800";
    if (action.includes("SUBMITTED")) return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    if (action.includes("ASSIGNED")) return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800";
    return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
  };

  const columns: Column<AuditLogItem>[] = [
    {
      key: "createdAt",
      header: "Timestamp",
      className: "w-44 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400 font-mono",
      render: (log) =>
        new Date(log.createdAt).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
    },
    {
      key: "actor",
      header: "Actor",
      className: "w-48 text-xs",
      render: (log) =>
        log.actor ? (
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {log.actor.name}
            </div>
            <div className="text-[11px] text-slate-400">{log.actor.email}</div>
          </div>
        ) : (
          <span className="text-slate-400 italic">System</span>
        ),
    },
    {
      key: "action",
      header: "Action",
      className: "w-48 text-xs",
      render: (log) => (
        <span
          className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getActionBadgeColor(
            log.action
          )}`}
        >
          {log.action}
        </span>
      ),
    },
    {
      key: "entity",
      header: "Target Entity",
      className: "w-48 text-xs",
      render: (log) => (
        <div>
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {log.entityType}
          </span>
          {log.entityId && (
            <div className="text-[10px] text-slate-400 font-mono">
              #{log.entityId.slice(0, 8)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "metadata",
      header: "Details",
      className: "text-xs",
      render: (log) => {
        if (!log.metadata || Object.keys(log.metadata).length === 0) {
          return <span className="text-slate-400 text-[11px]">-</span>;
        }
        return (
          <button
            type="button"
            onClick={() => setSelectedMetadata(log.metadata as Record<string, unknown>)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] text-slate-600 dark:text-slate-300 font-mono cursor-pointer transition-colors"
          >
            <Code className="w-3 h-3 text-indigo-500" />
            <span>View JSON</span>
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Audit Logs
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <Shield className="w-3 h-3" /> Append-Only
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Immutable audit record of all state mutations, approvals, and authorization actions
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Action Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
              Action
            </label>
            <select
              value={filters.action || ""}
              onChange={(e) => handleFilterChange("action", e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Actions</option>
              <option value="REQUEST_CREATED">REQUEST_CREATED</option>
              <option value="REQUEST_SUBMITTED">REQUEST_SUBMITTED</option>
              <option value="APPROVAL_STEP_APPROVED">APPROVAL_STEP_APPROVED</option>
              <option value="APPROVAL_STEP_REJECTED">APPROVAL_STEP_REJECTED</option>
              <option value="REQUEST_APPROVED">REQUEST_APPROVED</option>
              <option value="TASK_CREATED">TASK_CREATED</option>
              <option value="TASK_ASSIGNED">TASK_ASSIGNED</option>
              <option value="COMMENT_ADDED">COMMENT_ADDED</option>
              <option value="USER_LOGIN">USER_LOGIN</option>
              <option value="USER_REGISTERED">USER_REGISTERED</option>
            </select>
          </div>

          {/* Entity Type Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
              Entity Type
            </label>
            <select
              value={filters.entityType || ""}
              onChange={(e) => handleFilterChange("entityType", e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Entities</option>
              <option value="WorkRequest">WorkRequest</option>
              <option value="ApprovalStep">ApprovalStep</option>
              <option value="Task">Task</option>
              <option value="Comment">Comment</option>
              <option value="User">User</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" /> Start Date
            </label>
            <input
              type="date"
              value={filters.startDate || ""}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" /> End Date
            </label>
            <input
              type="date"
              value={filters.endDate || ""}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Reset button */}
        {(filters.action || filters.entityType || filters.startDate || filters.endDate) && (
          <div className="pt-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </Button>
          </div>
        )}
      </div>

      {/* Audit Logs Table */}
      <DataTable
        columns={columns}
        data={logs}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={(newPage) => setFilters((prev) => ({ ...prev, page: newPage }))}
        emptyTitle="No audit logs found"
        emptyDescription="There are no audit events recorded matching your current filters."
      />

      {/* JSON Metadata Modal */}
      {selectedMetadata && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Event Metadata
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMetadata(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              <pre className="p-3 rounded-xl bg-slate-950 text-slate-100 text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(selectedMetadata, null, 2)}
              </pre>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setSelectedMetadata(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
