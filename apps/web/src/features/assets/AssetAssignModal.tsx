import React, { useState, useEffect } from "react";
import { UserCheck, AlertCircle } from "lucide-react";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { useToast } from "../../components/ui/toast";
import { assetsApi } from "./api";
import { AssetTypeIcon } from "./AssetTypeIcon";
import type { Asset, AssetAssigneeUser } from "./types";

interface AssetAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  presetUserId?: string;
  presetRequestId?: string;
  onSuccess: (updatedAsset: Asset) => void;
}

export const AssetAssignModal: React.FC<AssetAssignModalProps> = ({
  isOpen,
  onClose,
  asset,
  presetUserId,
  presetRequestId,
  onSuccess,
}) => {
  const { success: toastSuccess, error: toastError } = useToast();
  const [users, setUsers] = useState<AssetAssigneeUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(presetUserId || "");
  const [requestId, setRequestId] = useState(presetRequestId || "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedUserId(presetUserId || "");
      setRequestId(presetRequestId || "");
      setNotes("");
      setErrorMsg(null);

      // Load active users list
      setLoadingUsers(true);
      assetsApi
        .getUsers()
        .then((data) => setUsers(data))
        .catch(() => setUsers([]))
        .finally(() => setLoadingUsers(false));
    }
  }, [isOpen, presetUserId, presetRequestId]);

  if (!asset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setErrorMsg("Please select an employee to assign this asset to.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      const updated = await assetsApi.assign(asset.id, {
        userId: selectedUserId,
        requestId: requestId.trim() || null,
        notes: notes.trim() || null,
      });

      toastSuccess(
        `Asset "${asset.name}" was successfully assigned.`,
        "Asset Assigned"
      );
      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        "Failed to assign asset. Please check requirements and try again.";
      setErrorMsg(message);
      toastError(message, "Assignment Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Asset"
      description={`Assign ${asset.name} to an active employee.`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Asset Summary Pill */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
          <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shadow-xs border border-slate-200 dark:border-slate-700">
            <AssetTypeIcon type={asset.type} size="md" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {asset.name}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {asset.type} • Serial: {asset.serialNumber || "No serial"}
            </p>
          </div>
        </div>

        {/* Assignee selection */}
        <div className="space-y-1.5">
          <Label htmlFor="assignee-select" className="text-xs font-medium">
            Assign To Employee <span className="text-rose-500">*</span>
          </Label>
          <select
            id="assignee-select"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            disabled={loadingUsers || submitting}
            required
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">-- Select an employee --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email}) {u.department ? `• ${u.department.name}` : ""}
              </option>
            ))}
          </select>
          {loadingUsers && (
            <p className="text-[11px] text-slate-400">Loading company directory...</p>
          )}
        </div>

        {/* Linked Request ID */}
        <div className="space-y-1.5">
          <Label htmlFor="linked-request-id" className="text-xs font-medium">
            Linked Work Request ID (Optional)
          </Label>
          <Input
            id="linked-request-id"
            type="text"
            placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            disabled={submitting}
            className="text-xs font-mono"
          />
          <p className="text-[11px] text-slate-400">
            Attaches this assignment to a completed hardware or IT service request.
          </p>
        </div>

        {/* Assignment Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="assign-notes" className="text-xs font-medium">
            Condition / Assignment Notes (Optional)
          </Label>
          <textarea
            id="assign-notes"
            rows={3}
            placeholder="e.g. Issued with power adapter, USB-C hub, and protective sleeve."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Dialog Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            isLoading={submitting}
            disabled={submitting || !selectedUserId}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Confirm Assignment</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
