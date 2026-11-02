import React, { useState } from "react";
import { Search, UserCheck, UserX, Shield, ShieldAlert, AlertCircle } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useUsers, useUpdateUserRole, useUpdateUserStatus } from "./hooks";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Dialog } from "../../components/ui/Dialog";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/toast";
import type { Role, User } from "../../types/auth";

export function UserManagementPage(): React.JSX.Element {
  const { user: currentUser } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  // Filters & Pagination state
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Queries & Mutations
  const { data, isLoading, isError, error, refetch } = useUsers({
    search: search.trim() ? search.trim() : undefined,
    role: roleFilter !== "ALL" ? roleFilter : undefined,
    isActive: statusFilter === "ALL" ? undefined : statusFilter === "ACTIVE",
    page,
    limit,
  });

  const updateRoleMutation = useUpdateUserRole();
  const updateStatusMutation = useUpdateUserStatus();

  // Role Dialog State
  const [roleModalUser, setRoleModalUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>("EMPLOYEE");

  // Status Confirm Dialog State
  const [statusModalUser, setStatusModalUser] = useState<User | null>(null);

  // Handle Search submit / debounce
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setSearch(searchInput);
      setPage(1);
    }
  };

  const handleSearchBlur = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const openRoleModal = (user: User) => {
    setRoleModalUser(user);
    setSelectedRole(user.role);
  };

  const handleRoleChangeSubmit = async () => {
    if (!roleModalUser) return;
    try {
      await updateRoleMutation.mutateAsync({
        userId: roleModalUser.id,
        role: selectedRole,
      });
      toastSuccess(`Successfully updated ${roleModalUser.name}'s role to ${selectedRole}.`, "Role updated");
      setRoleModalUser(null);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || "Failed to update user role.";
      toastError(message, "Update failed");
    }
  };

  const handleStatusToggle = async () => {
    if (!statusModalUser) return;
    const newStatus = !statusModalUser.isActive;
    try {
      await updateStatusMutation.mutateAsync({
        userId: statusModalUser.id,
        isActive: newStatus,
      });
      toastSuccess(`${statusModalUser.name} has been ${newStatus ? "activated" : "deactivated"}.`, newStatus ? "User activated" : "User deactivated");
      setStatusModalUser(null);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || "Failed to update user status.";
      toastError(message, "Status change failed");
    }
  };

  const roleBadgeVariant = (role: Role) => {
    switch (role) {
      case "ADMIN":
        return "destructive";
      case "MANAGER":
        return "warning";
      default:
        return "default";
    }
  };

  const columns: Column<User>[] = [
    {
      key: "user",
      header: "User",
      render: (u) => {
        const initials = u.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">
              {initials || "U"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {u.name}
                </span>
                {currentUser?.id === u.id && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1 border-indigo-400 text-indigo-600 dark:text-indigo-400">
                    You
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">{u.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "role",
      header: "Role",
      render: (u) => (
        <Badge variant={roleBadgeVariant(u.role)} className="text-xs">
          {u.role}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (u) => (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
            u.isActive
              ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
          {u.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "department",
      header: "Department",
      render: (u) => (
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {u.department?.name || "—"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Joined",
      render: (u) => (
        <span className="text-xs text-slate-500">
          {new Date(u.createdAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      headerClassName: "text-right",
      render: (u) => {
        const isSelf = currentUser?.id === u.id;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isSelf}
              onClick={() => openRoleModal(u)}
              title={isSelf ? "You cannot modify your own role" : "Change User Role"}
              aria-label={isSelf ? "Cannot modify your own role" : `Change role for ${u.name}`}
              className="text-xs h-8"
            >
              <Shield className="w-3.5 h-3.5 mr-1 text-slate-500" />
              Role
            </Button>

            <Button
              variant={u.isActive ? "outline" : "default"}
              size="sm"
              disabled={isSelf}
              onClick={() => setStatusModalUser(u)}
              title={isSelf ? "You cannot deactivate yourself" : u.isActive ? "Deactivate User" : "Activate User"}
              aria-label={isSelf ? "Cannot deactivate yourself" : `${u.isActive ? "Deactivate" : "Activate"} ${u.name}`}
              className={`text-xs h-8 ${
                u.isActive
                  ? "hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-800"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {u.isActive ? (
                <>
                  <UserX className="w-3.5 h-3.5 mr-1" />
                  Deactivate
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5 mr-1" />
                  Activate
                </>
              )}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            User Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage company employees, assign roles, and toggle account activation.
          </p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={handleSearchBlur}
            placeholder="Search name or email... (Press Enter)"
            className="pl-9 h-9 text-xs"
            aria-label="Search users by name or email"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as Role | "ALL");
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            aria-label="Filter by role"
          >
            <option value="ALL">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="EMPLOYEE">Employee</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE");
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            aria-label="Filter by status"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          {/* Page size */}
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            aria-label="Rows per page"
          >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">
              Failed to load users: {(error as Error)?.message || "Unknown error occurred"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">
            Retry
          </Button>
        </div>
      )}

      {/* Users DataTable */}
      <DataTable
        columns={columns}
        data={data?.users || []}
        keyExtractor={(u) => u.id}
        isLoading={isLoading}
        page={data?.meta.page}
        totalPages={data?.meta.totalPages}
        total={data?.meta.total}
        onPageChange={(newPage) => setPage(newPage)}
        emptyTitle="No users found"
        emptyDescription="Try adjusting your search criteria or filters."
      />

      {/* Role Change Modal */}
      <Dialog
        isOpen={!!roleModalUser}
        onClose={() => setRoleModalUser(null)}
        title={`Change Role: ${roleModalUser?.name}`}
        description="Select the new organization role for this account."
      >
        <div className="space-y-4 pt-2">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Role changes take effect immediately on the user's next request. System rules prevent demoting the last active administrator.
            </span>
          </div>

          <div>
            <label htmlFor="role-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Assigned Role
            </label>
            <select
              id="role-select"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as Role)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="EMPLOYEE">Employee - Standard access to requests and tasks</option>
              <option value="MANAGER">Manager - Team requests, task assignments, and department approvals</option>
              <option value="ADMIN">Admin - Full company-wide governance, settings, and logs</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRoleModalUser(null)}
              disabled={updateRoleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              isLoading={updateRoleMutation.isPending}
              onClick={handleRoleChangeSubmit}
              disabled={selectedRole === roleModalUser?.role}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Status Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!statusModalUser}
        title={statusModalUser?.isActive ? "Deactivate User Account" : "Activate User Account"}
        description={
          statusModalUser?.isActive
            ? `Are you sure you want to deactivate ${statusModalUser.name}? They will immediately lose access and be signed out of all active sessions.`
            : `Are you sure you want to reactivate ${statusModalUser?.name}? They will be able to sign in again.`
        }
        confirmLabel={statusModalUser?.isActive ? "Deactivate" : "Activate"}
        variant={statusModalUser?.isActive ? "destructive" : "default"}
        isLoading={updateStatusMutation.isPending}
        onConfirm={handleStatusToggle}
        onCancel={() => setStatusModalUser(null)}
      />
    </div>
  );
}
