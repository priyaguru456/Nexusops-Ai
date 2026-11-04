import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, RotateCcw, ArrowRight, AlertCircle } from "lucide-react";
import { useRequests, useRequestCounts } from "./hooks";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { PriorityBadge } from "../../components/ui/PriorityBadge";
import { CategoryBadge } from "../../components/ui/CategoryBadge";
import { Button } from "../../components/ui/button";
import { BackButton } from "../../components/ui/BackButton";
import { formatKolkataDate } from "../../lib/utils";
import type { WorkRequest, RequestQueryFilters } from "../../types/requests";

export function RequestsListPage(): React.JSX.Element {
  const navigate = useNavigate();

  const [filters, setFilters] = useState<RequestQueryFilters>({
    status: "",
    priority: "",
    category: "",
    search: "",
    page: 1,
    limit: 10,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const { data, isLoading, isError, error, refetch } = useRequests(filters);
  const { data: counts, isLoading: isLoadingCounts } = useRequestCounts();

  const statusTabs: Array<{
    id: RequestQueryFilters["status"];
    label: string;
    count: number;
  }> = [
    { id: "", label: "All", count: counts?.all ?? 0 },
    {
      id: "PENDING_APPROVAL",
      label: "Pending Approval",
      count: counts?.pendingApproval ?? 0,
    },
    { id: "APPROVED", label: "Approved", count: counts?.approved ?? 0 },
    { id: "IN_PROGRESS", label: "In Progress", count: counts?.inProgress ?? 0 },
    { id: "COMPLETED", label: "Completed", count: counts?.completed ?? 0 },
    { id: "REJECTED", label: "Rejected", count: counts?.rejected ?? 0 },
  ];

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }));
  };

  const handleFilterChange = (key: keyof RequestQueryFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleResetFilters = () => {
    setFilters({
      status: "",
      priority: "",
      category: "",
      search: "",
      page: 1,
      limit: 10,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  };

  const handleSort = (columnKey: string) => {
    setFilters((prev) => {
      const isSameCol = prev.sortBy === columnKey;
      const newOrder = isSameCol && prev.sortOrder === "asc" ? "desc" : "asc";
      return {
        ...prev,
        sortBy: columnKey as RequestQueryFilters["sortBy"],
        sortOrder: newOrder,
        page: 1,
      };
    });
  };

  const columns: Column<WorkRequest>[] = [
    {
      key: "title",
      header: "Request",
      sortable: true,
      render: (req) => (
        <div className="max-w-xs sm:max-w-md">
          <div className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            {req.title}
          </div>
          <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
            {req.description}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      render: (req) => <CategoryBadge category={req.category} size="sm" />,
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      render: (req) => <PriorityBadge priority={req.priority} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (req) => <StatusBadge status={req.status} />,
    },
    {
      key: "requester",
      header: "Requester",
      render: (req) => (
        <div className="text-xs">
          <div className="font-medium text-slate-800 dark:text-slate-200">
            {req.requester.name}
          </div>
          <div className="text-slate-400 text-[11px]">
            {req.requester.department?.name || req.requester.role}
          </div>
        </div>
      ),
    },
    {
      key: "dueDate",
      header: "Due Date",
      sortable: true,
      render: (req) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {formatKolkataDate(req.dueDate)}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (req) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {formatKolkataDate(req.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (req) => (
        <Link
          to={`/requests/${req.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1 transition-colors inline-flex items-center gap-1 text-xs font-medium"
        >
          <span>View</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Work Requests
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Track, review, and manage operational and administrative requests
            </p>
          </div>
        </div>
        <Link to="/requests/new">
          <Button className="gap-2 shadow-xs">
            <Plus className="w-4 h-4" />
            <span>Create Request</span>
          </Button>
        </Link>
      </div>

      {/* Status Filter Tabs with Counts from API */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800 scrollbar-none"
        role="tablist"
        aria-label="Filter requests by status"
      >
        {statusTabs.map((tab) => {
          const isActive = (filters.status || "") === (tab.id || "");

          return (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleFilterChange("status", tab.id || "")}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isActive
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                {isLoadingCounts ? (
                  <span className="inline-block w-3 h-3 animate-pulse bg-current opacity-30 rounded-full" />
                ) : (
                  tab.count
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={filters.search || ""}
              onChange={handleSearchChange}
              placeholder="Search title, description..."
              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filters.status || ""}
            onChange={(e) => handleFilterChange("status", e.target.value)}
            className="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Category Filter */}
          <select
            value={filters.category || ""}
            onChange={(e) => handleFilterChange("category", e.target.value)}
            className="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Categories</option>
            <option value="IT">IT</option>
            <option value="HR">HR</option>
            <option value="FINANCE">Finance</option>
            <option value="FACILITIES">Facilities</option>
            <option value="OTHER">Other</option>
          </select>

          {/* Priority Filter */}
          <select
            value={filters.priority || ""}
            onChange={(e) => handleFilterChange("priority", e.target.value)}
            className="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>

        {/* Filter Reset Button */}
        {(filters.search || filters.status || filters.priority || filters.category) && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Error Alert Banner */}
      {isError && (
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>
              {(error as any)?.response?.data?.error ||
                (error as any)?.response?.data?.message ||
                (error as Error)?.message ||
                "Failed to load requests."}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="border-rose-300 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Requests Data Table */}
      <DataTable
        columns={columns}
        data={data?.requests ?? []}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyTitle="No requests found"
        emptyDescription="No requests match your current filters. Create a new request or adjust your search."
        onRowClick={(req) => navigate(`/requests/${req.id}`)}
        sortBy={filters.sortBy}
        sortOrder={filters.sortOrder}
        onSort={handleSort}
        page={data?.page}
        totalPages={data?.totalPages}
        total={data?.total}
        onPageChange={(newPage) => setFilters((prev) => ({ ...prev, page: newPage }))}
      />
    </div>
  );
}
