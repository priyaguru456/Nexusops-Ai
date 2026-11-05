import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Filter,
  RotateCcw,
  Calendar,
  X,
  AlertCircle,
  Download,
  Search,
  Eye,
  Check,
  Copy,
  Clock,
  User,
  Globe,
  Database,
  Loader2,
} from "lucide-react";
import { useAuditLogs, useExportAuditLogs } from "./hooks";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { Button } from "../../components/ui/button";
import { BackButton } from "../../components/ui/BackButton";
import { formatKolkataDateTime } from "../../lib/utils";
import { toast } from "../../components/ui/toast";
import type { AuditLogItem, AuditLogQueryFilters } from "../../types/audit";

export const AuditLogPage: React.FC = () => {
  const [filters, setFilters] = useState<AuditLogQueryFilters>({
    page: 1,
    limit: 15,
  });

  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useAuditLogs(filters);
  const exportMutation = useExportAuditLogs();

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const page = data?.page || 1;

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedLog) {
        setSelectedLog(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedLog]);

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

  const handleCopy = useCallback((text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  }, []);

  const handleExportCsv = async () => {
    try {
      const blob = await exportMutation.mutateAsync(filters);
      const url = window.URL.createObjectURL(new Blob([blob], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = url;
      const todayStr = new Date().toISOString().slice(0, 10);
      link.setAttribute("download", `audit-logs-export-${todayStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Audit logs exported to CSV successfully.");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || "Failed to export audit logs to CSV");
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("APPROVED") || action.includes("ACTIVATED")) {
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    }
    if (action.includes("REJECTED") || action.includes("CANCELLED") || action.includes("DELETED") || action.includes("DEACTIVATED")) {
      return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800";
    }
    if (action.includes("SUBMITTED") || action.includes("LOGIN") || action.includes("CREATED") || action.includes("UPLOADED")) {
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    }
    if (action.includes("ASSIGNED") || action.includes("ROLE")) {
      return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800";
    }
    if (action.includes("UPDATED") || action.includes("CHANGE")) {
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    }
    return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
  };

  const columns: Column<AuditLogItem>[] = [
    {
      key: "createdAt",
      header: "Timestamp (IST)",
      className: "w-44 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300 font-mono",
      render: (log) => (
        <div title={`UTC: ${new Date(log.createdAt).toISOString()}`}>
          {formatKolkataDateTime(log.createdAt)}
        </div>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      className: "w-48 text-xs",
      render: (log) =>
        log.actor ? (
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>{log.actor.name}</span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {log.actor.role}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
              {log.actor.email}
            </div>
          </div>
        ) : (
          <span className="text-slate-400 italic">System</span>
        ),
    },
    {
      key: "action",
      header: "Action",
      className: "w-44 text-xs",
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
      key: "summary",
      header: "Summary",
      className: "text-xs max-w-xs",
      render: (log) => (
        <div className="truncate text-slate-700 dark:text-slate-300" title={log.summary || ""}>
          {log.summary || "—"}
        </div>
      ),
    },
    {
      key: "entity",
      header: "Target Entity",
      className: "w-40 text-xs",
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
      key: "ipAddress",
      header: "IP Address",
      className: "w-28 text-xs font-mono text-slate-500 dark:text-slate-400",
      render: (log) => log.ipAddress || <span className="text-slate-400">—</span>,
    },
    {
      key: "actions",
      header: "Details",
      className: "w-24 text-right text-xs",
      render: (log) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSelectedLog(log)}
          className="h-7 px-2.5 text-xs gap-1.5 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
          aria-label={`View audit details for event ${log.id}`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>View</span>
        </Button>
      ),
    },
  ];

  const hasActiveFilters = Boolean(
    filters.actor || filters.action || filters.entityType || filters.startDate || filters.endDate
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Audit Logs
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <Shield className="w-3 h-3" /> Append-Only
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Immutable audit record of all state mutations, approvals, and authorization actions
            </p>
          </div>
        </div>

        {/* Header Action: CSV Export */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={exportMutation.isPending || isLoading}
            className="gap-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            aria-label="Export audit logs to CSV"
          >
            {exportMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
            ) : (
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            )}
            <span>{exportMutation.isPending ? "Exporting..." : "Export CSV"}</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 h-7 px-2"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Actor Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Search className="w-3 h-3 text-slate-400" /> Actor
            </label>
            <input
              type="text"
              placeholder="Name, email, or ID..."
              value={filters.actor || ""}
              onChange={(e) => handleFilterChange("actor", e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Action Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
              Action
            </label>
            <select
              value={filters.action || ""}
              onChange={(e) => handleFilterChange("action", e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
            >
              <option value="">All Actions</option>
              <option value="USER_LOGIN">USER_LOGIN</option>
              <option value="REQUEST_CREATED">REQUEST_CREATED</option>
              <option value="REQUEST_UPDATED">REQUEST_UPDATED</option>
              <option value="REQUEST_SUBMITTED">REQUEST_SUBMITTED</option>
              <option value="REQUEST_STATUS_UPDATED">REQUEST_STATUS_UPDATED</option>
              <option value="REQUEST_APPROVED">REQUEST_APPROVED</option>
              <option value="REQUEST_REJECTED">REQUEST_REJECTED</option>
              <option value="REQUEST_CANCELLED">REQUEST_CANCELLED</option>
              <option value="REQUEST_ATTACHMENT_ADDED">REQUEST_ATTACHMENT_ADDED</option>
              <option value="APPROVAL_STEP_APPROVED">APPROVAL_STEP_APPROVED</option>
              <option value="APPROVAL_STEP_REJECTED">APPROVAL_STEP_REJECTED</option>
              <option value="TASK_CREATED">TASK_CREATED</option>
              <option value="TASK_UPDATED">TASK_UPDATED</option>
              <option value="TASK_ASSIGNED">TASK_ASSIGNED</option>
              <option value="TASK_DELETED">TASK_DELETED</option>
              <option value="DOCUMENT_UPLOADED">DOCUMENT_UPLOADED</option>
              <option value="DOCUMENT_DELETED">DOCUMENT_DELETED</option>
              <option value="ROLE_CHANGE">ROLE_CHANGE</option>
              <option value="USER_ACTIVATED">USER_ACTIVATED</option>
              <option value="USER_DEACTIVATED">USER_DEACTIVATED</option>
              <option value="PASSWORD_CHANGED">PASSWORD_CHANGED</option>
              <option value="COMMENT_CREATED">COMMENT_CREATED</option>
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
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
            >
              <option value="">All Entities</option>
              <option value="WorkRequest">WorkRequest</option>
              <option value="ApprovalStep">ApprovalStep</option>
              <option value="Task">Task</option>
              <option value="Document">Document</option>
              <option value="User">User</option>
              <option value="Comment">Comment</option>
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
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
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
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">
              Failed to load audit logs: {(error as any)?.response?.data?.error || (error as Error)?.message || "Unknown error occurred"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">
            Retry
          </Button>
        </div>
      )}

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

      {/* Detail Slide-Over Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="audit-drawer-title">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedLog(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-500" />
                    <h2 id="audit-drawer-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Audit Entry Details
                    </h2>
                  </div>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold border ${getActionBadgeColor(
                      selectedLog.action
                    )}`}
                  >
                    {selectedLog.action}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  aria-label="Close details drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Summary Card */}
                {selectedLog.summary && (
                  <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1">
                      Event Summary
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {selectedLog.summary}
                    </p>
                  </div>
                )}

                {/* Event Core Metadata Grid */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Event Information
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                      <div className="text-slate-400 text-[11px] flex items-center gap-1 mb-1">
                        <Clock className="w-3 h-3" /> Timestamp (IST)
                      </div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatKolkataDateTime(selectedLog.createdAt)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5" title="UTC Time">
                        UTC: {new Date(selectedLog.createdAt).toISOString()}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                      <div className="text-slate-400 text-[11px] flex items-center gap-1 mb-1">
                        <Globe className="w-3 h-3" /> Origin IP Address
                      </div>
                      <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {selectedLog.ipAddress || "Not recorded"}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 col-span-2">
                      <div className="text-slate-400 text-[11px] flex items-center gap-1 mb-1">
                        <Database className="w-3 h-3" /> Target Entity
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedLog.entityType}
                          {selectedLog.entityId && (
                            <span className="font-mono font-normal text-slate-500 dark:text-slate-400 ml-2">
                              {selectedLog.entityId}
                            </span>
                          )}
                        </div>
                        {selectedLog.entityId && (
                          <button
                            type="button"
                            onClick={() => handleCopy(selectedLog.entityId!, "entityId")}
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            {copiedField === "entityId" ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copiedField === "entityId" ? "Copied" : "Copy ID"}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 col-span-2">
                      <div className="text-slate-400 text-[11px] mb-1">Log ID</div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[280px]">
                          {selectedLog.id}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedLog.id, "logId")}
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          {copiedField === "logId" ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedField === "logId" ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actor Card */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Actor Details
                  </h3>
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                    {selectedLog.actor ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {selectedLog.actor.name}
                          </span>
                          <span className="text-[11px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {selectedLog.actor.role}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {selectedLog.actor.email}
                        </div>
                        {selectedLog.actorId && (
                          <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100 dark:border-slate-800">
                            ID: {selectedLog.actorId}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                        Triggered automatically by System background worker / escalation process.
                      </div>
                    )}
                  </div>
                </div>

                {/* Sanitized Metadata JSON */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Context Metadata
                    </h3>
                    {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleCopy(JSON.stringify(selectedLog.metadata, null, 2), "json")}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        {copiedField === "json" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedField === "json" ? "Copied JSON" : "Copy JSON"}</span>
                      </button>
                    )}
                  </div>

                  {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 ? (
                    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950">
                      <pre className="p-4 text-xs font-mono text-emerald-400 dark:text-emerald-300 overflow-x-auto whitespace-pre-wrap max-h-72">
                        {JSON.stringify(selectedLog.metadata, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                      No additional metadata recorded for this event.
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)} className="text-xs">
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
