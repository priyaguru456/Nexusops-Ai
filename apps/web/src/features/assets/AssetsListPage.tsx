import React, { useState, useEffect, useCallback } from "react";
import {
  Laptop,
  Plus,
  Search,
  RotateCcw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { TableSkeleton } from "../../components/ui/LoadingSkeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatKolkataDate } from "../../lib/utils";
import { AssetTypeIcon } from "./AssetTypeIcon";
import { AssetStatusBadge } from "./AssetStatusBadge";
import { WarrantyBadge } from "./WarrantyBadge";
import { AssetDetailDrawer } from "./AssetDetailDrawer";
import { AssetFormModal } from "./AssetFormModal";
import { assetsApi } from "./api";
import type { Asset, AssetType, AssetStatus, GetAssetsQuery } from "./types";

export function AssetsListPage(): React.JSX.Element {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedWarranty, setSelectedWarranty] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Data & Fetch State
  const [assets, setAssets] = useState<Asset[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Drawer & Modal State
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const params: GetAssetsQuery = {
        page,
        limit,
        search: search.trim() || undefined,
        type: selectedType !== "ALL" ? (selectedType as AssetType) : undefined,
        status: selectedStatus !== "ALL" ? (selectedStatus as AssetStatus) : undefined,
        warranty: selectedWarranty !== "all" ? (selectedWarranty as any) : undefined,
      };

      const res = await assetsApi.list(params);
      setAssets(res?.data || []);
      setTotalItems(res?.pagination?.total || 0);
      setTotalPages(res?.pagination?.totalPages || 1);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        "Failed to load inventory assets. Please check network connection.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, selectedType, selectedStatus, selectedWarranty]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleRowClick = (asset: Asset) => {
    setSelectedAsset(asset);
    setDrawerOpen(true);
  };

  const handleClearFilters = () => {
    setSearch("");
    setSelectedType("ALL");
    setSelectedStatus("ALL");
    setSelectedWarranty("all");
    setPage(1);
  };

  const handleAssetUpdated = (updated: Asset) => {
    setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setSelectedAsset(updated);
  };

  const handleAssetCreated = (created: Asset) => {
    setAssets((prev) => [created, ...prev]);
    setTotalItems((prev) => prev + 1);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    selectedType !== "ALL" ||
    selectedStatus !== "ALL" ||
    selectedWarranty !== "all";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Hardware & Asset Inventory
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isAdmin
              ? "Manage company workstations, displays, mobile devices, and SaaS software licenses."
              : "View IT hardware and workstation equipment assigned to your account."}
          </p>
        </div>

        {/* Create Asset Action - Admin Only */}
        {isAdmin && (
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Asset</span>
          </Button>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search serial, name, assignee..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 text-xs"
            />
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by type"
              className="w-full h-9 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Types</option>
              <option value="LAPTOP">Laptops</option>
              <option value="MONITOR">Monitors</option>
              <option value="PHONE">Phones</option>
              <option value="LICENSE">Licenses</option>
              <option value="ACCESSORY">Accessories</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by status"
              className="w-full h-9 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_REPAIR">In Repair</option>
              <option value="RETIRED">Retired</option>
            </select>
          </div>

          {/* Warranty Filter */}
          <div>
            <select
              value={selectedWarranty}
              onChange={(e) => {
                setSelectedWarranty(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by warranty"
              className="w-full h-9 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Warranty States</option>
              <option value="expiring_soon">Expiring Soon (≤30d)</option>
              <option value="expired">Expired</option>
              <option value="valid">Active & Valid</option>
            </select>
          </div>
        </div>

        {/* Filter Summary & Reset */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Showing filtered results ({totalItems} found)
            </span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Error State */}
      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchAssets()}>
            Retry
          </Button>
        </div>
      )}

      {/* Inventory Table Container */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={6} cols={6} />
          </div>
        ) : assets.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "No matching assets found" : "No assets in inventory"}
            description={
              hasActiveFilters
                ? "Try adjusting your search criteria or resetting the applied filters."
                : isAdmin
                ? "Get started by adding workstations, displays, and devices to the inventory."
                : "You currently have no hardware or equipment assigned to your account."
            }
            icon={Laptop}
            actionLabel={hasActiveFilters ? "Reset Filters" : isAdmin ? "Add Asset" : undefined}
            onAction={hasActiveFilters ? handleClearFilters : isAdmin ? () => setCreateModalOpen(true) : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/60 font-semibold text-slate-600 dark:text-slate-300">
                  <th scope="col" className="px-4 py-3">Asset</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Serial / Key</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Assignee</th>
                  <th scope="col" className="px-4 py-3">Warranty</th>
                  <th scope="col" className="px-4 py-3">Purchase Date</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {assets.map((asset) => {
                  const activeAssignment = asset.assignments?.find((a) => a.returnedAt === null);

                  return (
                    <tr
                      key={asset.id}
                      onClick={() => handleRowClick(asset)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleRowClick(asset);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`View details for ${asset.name}`}
                      className="hover:bg-slate-50 dark:hover:bg-slate-850/60 cursor-pointer focus:outline-none focus:bg-indigo-50/50 dark:focus:bg-indigo-950/20 transition-colors"
                    >
                      {/* Name & Icon */}
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                            <AssetTypeIcon type={asset.type} size="sm" />
                          </div>
                          <span className="truncate max-w-xs">{asset.name}</span>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">
                        {asset.type}
                      </td>

                      {/* Serial Number */}
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {asset.serialNumber || "—"}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <AssetStatusBadge status={asset.status} size="sm" />
                      </td>

                      {/* Current Assignee */}
                      <td className="px-4 py-3">
                        {activeAssignment ? (
                          <div className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
                            <UserIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="truncate max-w-[130px]" title={activeAssignment.user?.email}>
                              {activeAssignment.user?.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Warranty Badge */}
                      <td className="px-4 py-3">
                        <WarrantyBadge warrantyExpiresAt={asset.warrantyExpiresAt} />
                      </td>

                      {/* Purchase Date */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {formatKolkataDate(asset.purchaseDate)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(asset);
                          }}
                          className="h-7 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalItems > 0 && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/40 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing {assets.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, totalItems)} of {totalItems} items
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-7 w-7 p-0"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-7 w-7 p-0"
                aria-label="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Slide-over Drawer */}
      <AssetDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        asset={selectedAsset}
        isAdmin={isAdmin}
        onAssetUpdated={handleAssetUpdated}
      />

      {/* Create Asset Modal - Admin Only */}
      {isAdmin && (
        <AssetFormModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={handleAssetCreated}
        />
      )}
    </div>
  );
}
