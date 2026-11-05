import React, { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { useToast } from "../../components/ui/toast";
import { assetsApi } from "./api";
import { AssetTypeIcon } from "./AssetTypeIcon";
import type { Asset } from "./types";

interface AssignAssetFromRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
  requesterId: string;
  requesterName: string;
  onSuccess: (assignedAsset: Asset) => void;
}

export const AssignAssetFromRequestModal: React.FC<AssignAssetFromRequestModalProps> = ({
  isOpen,
  onClose,
  requestId,
  requesterId,
  requesterName,
  onSuccess,
}) => {
  const { success: toastSuccess, error: toastError } = useToast();

  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedAssetId("");
      setNotes("");
      setErrorMsg(null);
      setLoadingAssets(true);

      assetsApi
        .list({ status: "AVAILABLE", limit: 100 })
        .then((res) => {
          setAvailableAssets(res.data);
          if (res.data.length > 0) {
            setSelectedAssetId(res.data[0].id);
          }
        })
        .catch(() => setAvailableAssets([]))
        .finally(() => setLoadingAssets(false));
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) {
      setErrorMsg("Please select an available hardware asset or license.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const assigned = await assetsApi.assign(selectedAssetId, {
        userId: requesterId,
        requestId,
        notes: notes.trim() || `Assigned via completed IT hardware request #${requestId.slice(0, 8)}`,
      });

      toastSuccess(
        `Asset "${assigned.name}" assigned to ${requesterName}.`,
        "Asset Assigned"
      );
      onSuccess(assigned);
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        "Failed to assign asset. Please check requirements.";
      setErrorMsg(message);
      toastError(message, "Assignment Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedAsset = availableAssets.find((a) => a.id === selectedAssetId);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Hardware Asset to IT Request"
      description={`Select an available inventory asset to fulfill completed request #${requestId.slice(0, 8)} for ${requesterName}.`}
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

        {/* Available Assets Dropdown */}
        <div className="space-y-1.5">
          <Label htmlFor="available-asset-select" className="text-xs font-medium">
            Available Asset <span className="text-rose-500">*</span>
          </Label>
          {loadingAssets ? (
            <p className="text-xs text-slate-400">Loading available inventory assets...</p>
          ) : availableAssets.length === 0 ? (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
              No AVAILABLE assets found in inventory. Add or return an asset first.
            </div>
          ) : (
            <select
              id="available-asset-select"
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              disabled={submitting}
              required
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {availableAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.type}] {a.name} {a.serialNumber ? `• S/N: ${a.serialNumber}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Selected Asset Details Preview */}
        {selectedAsset && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
              <AssetTypeIcon type={selectedAsset.type} size="sm" />
              <span>{selectedAsset.name}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Serial: {selectedAsset.serialNumber || "None"} • Status: AVAILABLE
            </p>
          </div>
        )}

        {/* Assignment Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="req-asset-notes" className="text-xs font-medium">
            Fulfillment Notes (Optional)
          </Label>
          <textarea
            id="req-asset-notes"
            rows={3}
            placeholder="e.g. Issued asset in fulfillment of requested hardware upgrade."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Actions */}
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
            disabled={submitting || availableAssets.length === 0 || !selectedAssetId}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Assign Asset</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
