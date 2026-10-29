import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, RotateCcw, ArrowRight } from "lucide-react";
import { useRequests } from "./hooks";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { PriorityBadge } from "../../components/ui/PriorityBadge";
import { Button } from "../../components/ui/button";
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

  const { data, isLoading } = useRequests(filters);

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
      render: (req) => (
        <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
          {req.category}
        </span>
      ),
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
          {req.dueDate
            ? new Date(req.dueDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "—"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (req) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {new Date(req.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Work Requests
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track, review, and manage operational and administrative requests
          </p>
        </div>
        <Link to="/requests/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            <span>Create Request</span>
          </Button>
        </Link>
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
