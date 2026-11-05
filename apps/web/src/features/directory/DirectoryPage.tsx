import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  LayoutGrid,
  Table as TableIcon,
  FolderTree,
  Users,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useDirectory, useDirectoryDepartments } from "./hooks";
import { ProfileCard } from "./ProfileCard";
import { TeamPopover } from "./TeamPopover";
import { OrgChartView } from "./OrgChartView";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import { getInitials, getAvatarColor } from "./ProfileCard";
import type { DirectoryUser } from "../../types/directory";
import type { Role } from "../../types/auth";

type ViewMode = "grid" | "table";
type TabMode = "directory" | "org";

export function DirectoryPage(): React.JSX.Element {
  // Tabs & Views
  const [activeTab, setActiveTab] = useState<TabMode>("directory");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Filter States
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  const [selectedRole, setSelectedRole] = useState<Role | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);

  // Team Popover State
  const [selectedTeamUser, setSelectedTeamUser] = useState<DirectoryUser | null>(null);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch departments for filter
  const { data: departments = [] } = useDirectoryDepartments();

  // Fetch paginated directory
  const {
    data: directoryData,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useDirectory({
    page,
    limit,
    search: debouncedSearch.trim() || undefined,
    departmentId: selectedDepartment !== "ALL" ? selectedDepartment : undefined,
    role: selectedRole !== "ALL" ? selectedRole : undefined,
  });

  const users = directoryData?.users ?? [];
  const total = directoryData?.total ?? 0;
  const totalPages = directoryData?.totalPages ?? 1;

  const roleVariant = (role: Role) => {
    switch (role) {
      case "ADMIN":
        return "destructive";
      case "MANAGER":
        return "warning";
      default:
        return "default";
    }
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setSelectedDepartment("ALL");
    setSelectedRole("ALL");
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(searchInput.trim()) || selectedDepartment !== "ALL" || selectedRole !== "ALL";

  // Table Columns for Table View
  const tableColumns: Column<DirectoryUser>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Employee",
        render: (row) => (
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-inner ${getAvatarColor(
                row.name
              )}`}
              aria-hidden="true"
            >
              {getInitials(row.name)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                {row.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{row.email}</p>
            </div>
          </div>
        ),
      },
      {
        key: "role",
        header: "Role",
        render: (row) => (
          <Badge variant={roleVariant(row.role)} className="text-[11px] font-medium uppercase">
            {row.role}
          </Badge>
        ),
      },
      {
        key: "department",
        header: "Department",
        render: (row) =>
          row.department ? (
            <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">
              {row.department.name}
            </span>
          ) : (
            <span className="text-slate-400 italic text-xs">Unassigned</span>
          ),
      },
      {
        key: "manager",
        header: "Reporting Manager",
        render: (row) =>
          row.manager ? (
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              {row.manager.name}
            </span>
          ) : (
            <span className="text-xs text-slate-400 italic">None / Executive</span>
          ),
      },
      {
        key: "reports",
        header: "Direct Reports",
        render: (row) =>
          row.directReportsCount > 0 ? (
            <Badge variant="secondary" className="text-xs font-semibold">
              {row.directReportsCount} {row.directReportsCount === 1 ? "report" : "reports"}
            </Badge>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          ),
      },
      {
        key: "actions",
        header: "Action",
        render: (row) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTeamUser(row);
            }}
            className="text-xs h-7 px-2.5 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40"
            aria-label={`View team of ${row.name}`}
          >
            <Users className="w-3.5 h-3.5 mr-1" />
            <span>Team</span>
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Header and Mode Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Company Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Explore company team members, organizational reporting hierarchy, and departments.
          </p>
        </div>

        {/* Tab Switcher: Directory vs Org Chart */}
        <div
          role="tablist"
          aria-label="Directory views"
          className="inline-flex items-center p-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80"
        >
          <button
            role="tab"
            aria-selected={activeTab === "directory"}
            aria-controls="directory-tab-panel"
            onClick={() => setActiveTab("directory")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              activeTab === "directory"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Directory List</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "org"}
            aria-controls="org-tab-panel"
            onClick={() => setActiveTab("org")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              activeTab === "org"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Org Chart</span>
          </button>
        </div>
      </div>

      {/* Directory Tab View */}
      {activeTab === "directory" && (
        <div id="directory-tab-panel" role="tabpanel" className="space-y-6">
          {/* Filters & View Toggle Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by name, email, department or role..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 pr-9 text-xs sm:text-sm h-9 w-full"
                aria-label="Search directory"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
                  aria-label="Clear search input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Department & Role Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Department Filter */}
              <select
                aria-label="Filter by department"
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setPage(1);
                }}
                className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 h-9 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.userCount})
                  </option>
                ))}
              </select>

              {/* Role Filter */}
              <select
                aria-label="Filter by role"
                value={selectedRole}
                onChange={(e) => {
                  setSelectedRole(e.target.value as Role | "ALL");
                  setPage(1);
                }}
                className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 h-9 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Roles</option>
                <option value="EMPLOYEE">Employees</option>
                <option value="MANAGER">Managers</option>
                <option value="ADMIN">Admins</option>
              </select>

              {/* Clear filters button if active */}
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="text-xs h-9 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Clear all
                </Button>
              )}
            </div>

            {/* Grid vs Table View Mode Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 self-end lg:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Switch to Grid view"
                className={`p-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                aria-label="Switch to Table view"
                className={`p-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
                title="Table View"
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Results Summary Count */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>
              Showing {users.length > 0 ? (page - 1) * limit + 1 : 0} -{" "}
              {Math.min(page * limit, total)} of {total} {total === 1 ? "employee" : "employees"}
            </span>
            {isFetching && !isLoading && (
              <span className="flex items-center gap-1 text-indigo-500 text-xs">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Updating...
              </span>
            )}
          </div>

          {/* Loading Skeletons */}
          {isLoading && (
            <div>
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
                    >
                      <div className="flex items-center gap-3">
                        <LoadingSkeleton className="w-12 h-12 rounded-full" />
                        <div className="space-y-1.5 flex-1">
                          <LoadingSkeleton className="h-4 w-3/4" />
                          <LoadingSkeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                      <div className="space-y-2 pt-2">
                        <LoadingSkeleton className="h-3 w-full" />
                        <LoadingSkeleton className="h-3 w-2/3" />
                      </div>
                      <LoadingSkeleton className="h-8 w-full rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : (
                <DataTable
                  columns={tableColumns}
                  data={[]}
                  keyExtractor={(row) => row.id}
                  isLoading={true}
                />
              )}
            </div>
          )}

          {/* Error State */}
          {isError && !isLoading && (
            <div className="p-8 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-center">
              <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">
                Failed to load directory members.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-3 text-xs"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !isError && users.length === 0 && (
            <EmptyState
              title="No employees found"
              description={
                hasActiveFilters
                  ? "No team members matched your search or filters. Try adjusting your search query."
                  : "No active users were found in the directory."
              }
              actionLabel={hasActiveFilters ? "Reset all filters" : undefined}
              onAction={hasActiveFilters ? handleClearFilters : undefined}
            />
          )}

          {/* Data Presentation (Grid or Table) */}
          {!isLoading && !isError && users.length > 0 && (
            <>
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {users.map((user) => (
                    <ProfileCard
                      key={user.id}
                      user={user}
                      onViewTeam={(u) => setSelectedTeamUser(u)}
                    />
                  ))}
                </div>
              ) : (
                <DataTable
                  columns={tableColumns}
                  data={users}
                  keyExtractor={(row) => row.id}
                  onRowClick={(row) => setSelectedTeamUser(row)}
                />
              )}

              {/* Server-side Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Show</span>
                    <select
                      aria-label="Items per page"
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                      className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
                    >
                      <option value={12}>12</option>
                      <option value={24}>24</option>
                      <option value={48}>48</option>
                    </select>
                    <span>per page</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      aria-label="Previous page"
                      className="h-8 text-xs"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                      Previous
                    </Button>
                    <span className="text-xs font-semibold px-2 text-slate-700 dark:text-slate-300">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      aria-label="Next page"
                      className="h-8 text-xs"
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Org Chart Tab View */}
      {activeTab === "org" && (
        <div id="org-tab-panel" role="tabpanel">
          <OrgChartView
            departments={departments}
            selectedDepartmentId={selectedDepartment}
            onDepartmentChange={(deptId) => setSelectedDepartment(deptId)}
            onSelectUser={(user) => setSelectedTeamUser(user)}
          />
        </div>
      )}

      {/* Team Popover Modal */}
      <TeamPopover
        user={selectedTeamUser}
        isOpen={Boolean(selectedTeamUser)}
        onClose={() => setSelectedTeamUser(null)}
        onSelectUser={(u) => setSelectedTeamUser(u)}
      />
    </div>
  );
}
