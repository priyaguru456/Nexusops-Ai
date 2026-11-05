import React, { useEffect, useRef, useState } from "react";
import {
  X,
  UserCheck,
  RotateCcw,
  Archive,
  Edit2,
  Copy,
  Check,
  User as UserIcon,
  History,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/toast";
import { formatKolkataDate } from "../../lib/utils";
import { AssetTypeIcon } from "./AssetTypeIcon";
import { AssetStatusBadge } from "./AssetStatusBadge";
import { WarrantyBadge } from "./WarrantyBadge";
import { AssetAssignModal } from "./AssetAssignModal";
import { AssetFormModal } from "./AssetFormModal";
import { assetsApi } from "./api";
import type { Asset } from "./types";

interface AssetDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  isAdmin: boolean;
  onAssetUpdated: (updatedAsset: Asset) => void;
}

export const AssetDetailDrawer: React.FC<AssetDetailDrawerProps> = ({
  isOpen,
  onClose,
  asset,
  isAdmin,
  onAssetUpdated,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const { success: toastSuccess, error: toastError } = useToast();

  const [copiedSerial, setCopiedSerial] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [retireDialogOpen, setRetireDialogOpen] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);

  // Focus management and Escape key handling
  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !asset) return null;

  const activeAssignment = asset.currentAssignment || asset.assignments?.find((a) => !a.returnedAt);

  const handleCopySerial = () => {
    if (!asset.serialNumber) return;
    navigator.clipboard.writeText(asset.serialNumber);
    setCopiedSerial(true);
    setTimeout(() => setCopiedSerial(false), 2000);
  };

  const handleConfirmReturn = async () => {
    try {
      setIsActionPending(true);
      const updated = await assetsApi.returnAsset(asset.id);
      toastSuccess(`Asset "${asset.name}" was marked as returned and is now available.`, "Asset Returned");
      onAssetUpdated(updated);
      setReturnDialogOpen(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        "Failed to return asset.";
      toastError(message, "Return Failed");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleConfirmRetire = async () => {
    try {
      setIsActionPending(true);
      const updated = await assetsApi.retire(asset.id);
      toastSuccess(`Asset "${asset.name}" was successfully decommissioned and retired.`, "Asset Retired");
      onAssetUpdated(updated);
      setRetireDialogOpen(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        "Failed to retire asset.";
      toastError(message, "Retirement Failed");
    } finally {
      setIsActionPending(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="asset-drawer-title">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <div
            ref={drawerRef}
            className="w-screen max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                  <AssetTypeIcon type={asset.type} size="lg" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 id="asset-drawer-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {asset.name}
                    </h2>
                    <AssetStatusBadge status={asset.status} size="sm" />
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>{asset.type}</span>
                    {asset.serialNumber && (
                      <>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={handleCopySerial}
                          className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          title="Click to copy serial number"
                        >
                          <span>{asset.serialNumber}</span>
                          {copiedSerial ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close asset details"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Current Assignee Card (if assigned) */}
              {asset.status === "ASSIGNED" && activeAssignment && (
                <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Current Assignee
                    </span>
                    <span className="text-[11px] text-blue-700 dark:text-blue-400">
                      Assigned {formatKolkataDate(activeAssignment.assignedAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                      {activeAssignment.user?.name?.slice(0, 2).toUpperCase() || "US"}
                    </div>
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {activeAssignment.user?.name}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 truncate">
                        {activeAssignment.user?.email}
                      </p>
                    </div>
                  </div>

                  {activeAssignment.request && (
                    <div className="pt-2 border-t border-blue-200/60 dark:border-blue-900/30 text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Linked Request: </span>
                      <Link
                        to={`/requests/${activeAssignment.request.id}`}
                        className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        #{activeAssignment.request.id.slice(0, 8)} ({activeAssignment.request.title})
                      </Link>
                    </div>
                  )}

                  {activeAssignment.notes && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-white/60 dark:bg-slate-900/40 p-2 rounded-lg border border-blue-100 dark:border-blue-900/20">
                      &ldquo;{activeAssignment.notes}&rdquo;
                    </p>
                  )}
                </div>
              )}

              {/* Specifications Card */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Asset Details & Warranty
                </h3>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Type</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{asset.type}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Status</span>
                    <AssetStatusBadge status={asset.status} size="sm" />
                  </div>

                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Purchase Date</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {formatKolkataDate(asset.purchaseDate)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Warranty</span>
                    <WarrantyBadge warrantyExpiresAt={asset.warrantyExpiresAt} showDate />
                  </div>
                </div>

                {asset.notes && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                    <span className="text-slate-500 dark:text-slate-400 block mb-1">Notes:</span>
                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg">
                      {asset.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Assignment History Timeline */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Assignment History ({asset.assignments?.length || 0})
                  </h3>
                </div>

                {(!asset.assignments || asset.assignments.length === 0) ? (
                  <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                    No assignment history recorded yet.
                  </div>
                ) : (
                  <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                    {asset.assignments.map((asgn) => {
                      const isActive = asgn.returnedAt === null;
                      return (
                        <div key={asgn.id} className="relative flex items-start gap-3 pl-1">
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 ${
                              isActive
                                ? "bg-emerald-500 text-white ring-4 ring-emerald-100 dark:ring-emerald-950"
                                : "bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            <UserCheck className="w-2.5 h-2.5" />
                          </div>

                          <div className="flex-1 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-xs shadow-xs space-y-1.5">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {asgn.user?.name || "Unknown User"}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  isActive
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                }`}
                              >
                                {isActive ? "Active Assignment" : "Returned"}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Assigned {formatKolkataDate(asgn.assignedAt)}
                              {asgn.returnedAt && ` • Returned ${formatKolkataDate(asgn.returnedAt)}`}
                            </p>

                            <p className="text-[11px] text-slate-400">
                              Processed by: {asgn.assignedBy?.name || "Admin"}
                            </p>

                            {asgn.request && (
                              <p className="text-[11px] text-indigo-600 dark:text-indigo-400">
                                Request: #{asgn.request.id.slice(0, 8)} - {asgn.request.title}
                              </p>
                            )}

                            {asgn.notes && (
                              <p className="text-xs text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-100 dark:border-slate-800">
                                {asgn.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Actions Footer - Admin Only */}
            {isAdmin && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/80 flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditModalOpen(true)}
                  className="gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </Button>

                {asset.status === "AVAILABLE" && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setAssignModalOpen(true)}
                    className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Assign Asset</span>
                  </Button>
                )}

                {asset.status === "ASSIGNED" && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setReturnDialogOpen(true)}
                    className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Process Return</span>
                  </Button>
                )}

                {asset.status !== "ASSIGNED" && asset.status !== "RETIRED" && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setRetireDialogOpen(true)}
                    className="gap-1.5"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Retire</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assign Modal */}
      <AssetAssignModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        asset={asset}
        onSuccess={(updated) => {
          onAssetUpdated(updated);
        }}
      />

      {/* Edit Modal */}
      <AssetFormModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        assetToEdit={asset}
        onSuccess={(updated) => {
          onAssetUpdated(updated);
        }}
      />

      {/* Return Confirmation Dialog */}
      <ConfirmDialog
        isOpen={returnDialogOpen}
        title="Return Asset"
        description={`Are you sure you want to process the return of "${asset.name}"? It will be marked AVAILABLE for future assignment.`}
        confirmLabel="Confirm Return"
        isLoading={isActionPending}
        onConfirm={handleConfirmReturn}
        onCancel={() => setReturnDialogOpen(false)}
      />

      {/* Retire Confirmation Dialog */}
      <ConfirmDialog
        isOpen={retireDialogOpen}
        title="Retire Asset"
        description={`Are you sure you want to retire "${asset.name}"? Retired assets cannot be assigned.`}
        confirmLabel="Retire Asset"
        variant="destructive"
        isLoading={isActionPending}
        onConfirm={handleConfirmRetire}
        onCancel={() => setRetireDialogOpen(false)}
      />
    </>
  );
};
