import React, { useState } from "react";
import {
  Building2,
  Plus,
  Search,
  PowerOff,
  Power,
  AlertCircle,
  Users,
  FileText,
  FolderOpen,
} from "lucide-react";
import {
  useOrganizations,
  useCreateOrganization,
  useUpdateOrganization,
} from "./hooks";
import type { OrganizationRecord } from "./organizations.api";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { BackButton } from "../../components/ui/BackButton";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Dialog } from "../../components/ui/Dialog";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/toast";

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function OrganizationsPage(): React.JSX.Element {
  const { success: toastSuccess, error: toastError } = useToast();

  // Filter & pagination state
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [slugEditedManually, setSlugEditedManually] = useState(false);
  const [withInitialAdmin, setWithInitialAdmin] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Status toggle confirm modal
  const [statusTarget, setStatusTarget] = useState<OrganizationRecord | null>(null);

  const { data, isLoading, isError, error, refetch } = useOrganizations({
    search: search.trim() ? search.trim() : undefined,
    isActive: statusFilter === "ALL" ? undefined : statusFilter === "ACTIVE",
    page,
    limit,
  });

  const createOrgMutation = useCreateOrganization();
  const updateOrgMutation = useUpdateOrganization();

  const resetCreateForm = () => {
    setOrgName("");
    setOrgSlug("");
    setSlugEditedManually(false);
    setWithInitialAdmin(false);
    setAdminName("");
    setAdminEmail("");
    setAdminPassword("");
    setFormError(null);
  };

  const handleOrgNameChange = (value: string) => {
    setOrgName(value);
    if (!slugEditedManually) {
      setOrgSlug(toSlug(value));
    }
  };

  const handleOrgSlugChange = (value: string) => {
    setSlugEditedManually(true);
    setOrgSlug(value.toLowerCase());
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setSearch(searchInput);
      setPage(1);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = orgName.trim();
    const trimmedSlug = orgSlug.trim().toLowerCase();

    if (trimmedName.length < 2) {
      setFormError("Organization name must be at least 2 characters.");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug)) {
      setFormError("Slug must contain lowercase letters, numbers, and hyphens only.");
      return;
    }

    if (withInitialAdmin) {
      if (adminName.trim().length < 2) {
        setFormError("Initial admin name must be at least 2 characters.");
        return;
      }
      if (!adminEmail.trim().includes("@")) {
        setFormError("Please enter a valid initial admin email.");
        return;
      }
      if (adminPassword.length < 8) {
        setFormError("Initial admin password must be at least 8 characters.");
        return;
      }
    }

    try {
      await createOrgMutation.mutateAsync({
        name: trimmedName,
        slug: trimmedSlug,
        ...(withInitialAdmin
          ? {
              adminName: adminName.trim(),
              adminEmail: adminEmail.trim().toLowerCase(),
              adminPassword,
            }
          : {}),
      });
      toastSuccess(`Organization "${trimmedName}" created.`, "Organization provisioned");
      setCreateOpen(false);
      resetCreateForm();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string | { message?: string } } } })?.response
          ?.data?.error;
      const readable = typeof msg === "string" ? msg : msg?.message || "Failed to create organization.";
      setFormError(readable);
      toastError(readable, "Creation failed");
    }
  };

  const handleToggleStatus = async () => {
    if (!statusTarget) return;
    const nextActive = !statusTarget.isActive;
    try {
      await updateOrgMutation.mutateAsync({
        id: statusTarget.id,
        payload: { isActive: nextActive },
      });
      toastSuccess(
        `${statusTarget.name} has been ${nextActive ? "activated" : "suspended"}.`,
        nextActive ? "Organization activated" : "Organization suspended"
      );
      setStatusTarget(null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string | { message?: string } } } })?.response
          ?.data?.error;
      const readable =
        typeof msg === "string" ? msg : msg?.message || "Failed to update organization status.";
      toastError(readable, "Update failed");
    }
  };

  const columns: Column<OrganizationRecord>[] = [
    {
      key: "organization",
      header: "Organization",
      render: (org) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{org.name}</p>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">@{org.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "usage",
      header: "Usage",
      render: (org) => (
        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1" title="Users">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            {org._count?.users ?? 0}
          </span>
          <span className="inline-flex items-center gap-1" title="Work Requests">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            {org._count?.workRequests ?? 0}
          </span>
          <span className="inline-flex items-center gap-1" title="Documents">
            <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
            {org._count?.documents ?? 0}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (org) => (
        <Badge variant={org.isActive ? "success" : "destructive"} className="text-xs">
          {org.isActive ? "Active" : "Suspended"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (org) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {new Date(org.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (org) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant={org.isActive ? "outline" : "default"}
            size="sm"
            onClick={() => setStatusTarget(org)}
            aria-label={`${org.isActive ? "Suspend" : "Activate"} ${org.name}`}
            className={`text-xs h-8 ${
              org.isActive
                ? "hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-800"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {org.isActive ? (
              <>
                <PowerOff className="w-3.5 h-3.5 mr-1" />
                Suspend
              </>
            ) : (
              <>
                <Power className="w-3.5 h-3.5 mr-1" />
                Activate
              </>
            )}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Organizations
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Provision tenant workspaces, inspect usage, and manage organization access.
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            resetCreateForm();
            setCreateOpen(true);
          }}
          className="text-xs"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Organization
        </Button>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => {
              setSearch(searchInput);
              setPage(1);
            }}
            placeholder="Search organization name or slug..."
            className="pl-9 h-9 text-xs"
            aria-label="Search organizations"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "SUSPENDED");
            setPage(1);
          }}
          className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          aria-label="Filter by organization status"
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active Only</option>
          <option value="SUSPENDED">Suspended Only</option>
        </select>
      </div>

      {/* Error State */}
      {isError && (
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">
              Failed to load organizations: {(error as Error)?.message || "Unknown error"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">
            Retry
          </Button>
        </div>
      )}

      {/* Organizations Table */}
      <DataTable
        columns={columns}
        data={data?.items || []}
        keyExtractor={(org) => org.id}
        isLoading={isLoading}
        page={data?.page ?? page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onPageChange={(newPage) => setPage(newPage)}
        emptyTitle="No organizations found"
        emptyDescription="Create a new tenant workspace or adjust your search filter."
      />

      {/* Create Organization Dialog */}
      <Dialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Organization"
        description="Provision a new isolated tenant workspace on the platform."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={orgName}
              onChange={(e) => handleOrgNameChange(e.target.value)}
              placeholder="Acme Corporation"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-slug">Workspace Slug</Label>
            <Input
              id="org-slug"
              value={orgSlug}
              onChange={(e) => handleOrgSlugChange(e.target.value)}
              placeholder="acme-corporation"
              required
            />
            <p className="text-[11px] text-slate-400">
              Users can enter this slug when registering under this workspace.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={withInitialAdmin}
                onChange={(e) => setWithInitialAdmin(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Provision an initial organization admin user
            </label>
          </div>

          {withInitialAdmin && (
            <div className="space-y-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <div className="space-y-1.5">
                <Label htmlFor="init-admin-name">Admin Name</Label>
                <Input
                  id="init-admin-name"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="init-admin-email">Admin Email</Label>
                <Input
                  id="init-admin-email"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="jane@acme.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="init-admin-password">Temporary Password</Label>
                <Input
                  id="init-admin-password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createOrgMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={createOrgMutation.isPending}>
              Create Organization
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Suspend / Activate Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!statusTarget}
        title={statusTarget?.isActive ? "Suspend Organization" : "Activate Organization"}
        description={
          statusTarget?.isActive
            ? `Are you sure you want to suspend "${statusTarget.name}"? All users in this organization will be blocked from signing in or calling APIs until reactivated.`
            : `Are you sure you want to reactivate "${statusTarget?.name}"? Users will regain access immediately.`
        }
        confirmLabel={statusTarget?.isActive ? "Suspend" : "Activate"}
        variant={statusTarget?.isActive ? "destructive" : "default"}
        isLoading={updateOrgMutation.isPending}
        onConfirm={handleToggleStatus}
        onCancel={() => setStatusTarget(null)}
      />
    </div>
  );
}
