import React, { useState, useEffect } from "react";
import { Plus, Edit2, AlertCircle } from "lucide-react";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { useToast } from "../../components/ui/toast";
import { assetsApi } from "./api";
import type { Asset, AssetType, AssetStatus } from "./types";

interface AssetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetToEdit?: Asset | null;
  onSuccess: (savedAsset: Asset) => void;
}

export const AssetFormModal: React.FC<AssetFormModalProps> = ({
  isOpen,
  onClose,
  assetToEdit,
  onSuccess,
}) => {
  const isEditing = Boolean(assetToEdit);
  const { success: toastSuccess, error: toastError } = useToast();

  const [name, setName] = useState("");
  const [type, setType] = useState<AssetType>("LAPTOP");
  const [serialNumber, setSerialNumber] = useState("");
  const [status, setStatus] = useState<AssetStatus>("AVAILABLE");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warrantyExpiresAt, setWarrantyExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (assetToEdit) {
        setName(assetToEdit.name);
        setType(assetToEdit.type);
        setSerialNumber(assetToEdit.serialNumber || "");
        setStatus(assetToEdit.status);
        setPurchaseDate(assetToEdit.purchaseDate ? assetToEdit.purchaseDate.slice(0, 10) : "");
        setWarrantyExpiresAt(assetToEdit.warrantyExpiresAt ? assetToEdit.warrantyExpiresAt.slice(0, 10) : "");
        setNotes(assetToEdit.notes || "");
      } else {
        setName("");
        setType("LAPTOP");
        setSerialNumber("");
        setStatus("AVAILABLE");
        setPurchaseDate("");
        setWarrantyExpiresAt("");
        setNotes("");
      }
      setErrorMsg(null);
    }
  }, [isOpen, assetToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Asset name is required.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const payload = {
        name: name.trim(),
        type,
        serialNumber: serialNumber.trim() || null,
        status: isEditing && assetToEdit?.status === "ASSIGNED" ? undefined : status,
        purchaseDate: purchaseDate ? new Date(purchaseDate).toISOString() : null,
        warrantyExpiresAt: warrantyExpiresAt ? new Date(warrantyExpiresAt).toISOString() : null,
        notes: notes.trim() || null,
      };

      let result: Asset;
      if (isEditing && assetToEdit) {
        result = await assetsApi.update(assetToEdit.id, payload);
        toastSuccess(`Asset "${result.name}" updated successfully.`, "Asset Updated");
      } else {
        result = await assetsApi.create(payload as any);
        toastSuccess(`Asset "${result.name}" added to inventory.`, "Asset Created");
      }

      onSuccess(result);
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        "Failed to save asset details. Please verify your inputs.";
      setErrorMsg(message);
      toastError(message, "Save Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Asset" : "Add New Asset"}
      description={
        isEditing
          ? `Update specifications and warranty records for ${assetToEdit?.name}.`
          : "Register a new hardware, license, or accessory in the corporate inventory."
      }
      maxWidth="lg"
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

        {/* Row 1: Name and Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="asset-name" className="text-xs font-medium">
              Asset Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="asset-name"
              type="text"
              required
              placeholder="e.g. MacBook Pro 16-inch M3"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-type" className="text-xs font-medium">
              Asset Type <span className="text-rose-500">*</span>
            </Label>
            <select
              id="asset-type"
              value={type}
              onChange={(e) => setType(e.target.value as AssetType)}
              disabled={submitting}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="LAPTOP">Laptop / Workstation</option>
              <option value="MONITOR">Monitor / Display</option>
              <option value="PHONE">Phone / Tablet</option>
              <option value="LICENSE">Software / SaaS License</option>
              <option value="ACCESSORY">Peripherals & Accessory</option>
            </select>
          </div>
        </div>

        {/* Row 2: Serial Number & Initial Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="asset-serial" className="text-xs font-medium">
              Serial Number / License Key
            </Label>
            <Input
              id="asset-serial"
              type="text"
              placeholder="e.g. MBP16-2024-001"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              disabled={submitting}
              className="text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-status" className="text-xs font-medium">
              Status
            </Label>
            <select
              id="asset-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AssetStatus)}
              disabled={submitting || (isEditing && assetToEdit?.status === "ASSIGNED")}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="AVAILABLE">Available</option>
              {isEditing && assetToEdit?.status === "ASSIGNED" && (
                <option value="ASSIGNED" disabled>
                  Assigned (Managed via assignment workflow)
                </option>
              )}
              <option value="IN_REPAIR">In Repair</option>
              <option value="RETIRED">Retired</option>
            </select>
            {isEditing && assetToEdit?.status === "ASSIGNED" && (
              <p className="text-[11px] text-slate-400">
                To change status of an assigned asset, use the Return action.
              </p>
            )}
          </div>
        </div>

        {/* Row 3: Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="asset-purchase-date" className="text-xs font-medium">
              Purchase Date
            </Label>
            <Input
              id="asset-purchase-date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              disabled={submitting}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-warranty-date" className="text-xs font-medium">
              Warranty Expiration Date
            </Label>
            <Input
              id="asset-warranty-date"
              type="date"
              value={warrantyExpiresAt}
              onChange={(e) => setWarrantyExpiresAt(e.target.value)}
              disabled={submitting}
              className="text-xs"
            />
          </div>
        </div>

        {/* Row 4: Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="asset-notes" className="text-xs font-medium">
            Notes & Specifications
          </Label>
          <textarea
            id="asset-notes"
            rows={3}
            placeholder="Add hardware specs, vendor details, or maintenance notes..."
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
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isEditing ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{isEditing ? "Save Changes" : "Create Asset"}</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
