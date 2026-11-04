import React, { useState, useEffect } from "react";
import { AlertCircle, XCircle } from "lucide-react";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/button";

interface RejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  isLoading: boolean;
  requestTitle: string;
  requesterName?: string;
}

export const RejectModal: React.FC<RejectModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  requestTitle,
  requesterName,
}) => {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setError("");
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("A rejection reason is mandatory. Please explain why this request is being rejected.");
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        if (!isLoading) onClose();
      }}
      title="Reject Approval Request"
      description="Rejection permanently terminates this request workflow and notifies the requester."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {/* Request Context Card */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
          <div className="font-semibold text-slate-800 dark:text-slate-200">
            {requestTitle}
          </div>
          {requesterName && (
            <div className="text-slate-500 dark:text-slate-400">
              Submitted by: <span className="font-medium">{requesterName}</span>
            </div>
          )}
        </div>

        {/* Warning banner */}
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <span>
            This action cannot be undone. Any subsequent approval steps in this workflow will be automatically skipped.
          </span>
        </div>

        {/* Mandatory Reason Input */}
        <div className="space-y-1.5">
          <label
            htmlFor="rejection-reason"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Rejection Reason <span className="text-rose-500 font-bold">* (Required)</span>
          </label>
          <textarea
            id="rejection-reason"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError("");
            }}
            disabled={isLoading}
            placeholder="Please provide a clear reason for rejecting this request..."
            className={`w-full p-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 bg-transparent ${
              error
                ? "border-rose-500 focus:ring-rose-500"
                : "border-slate-300 dark:border-slate-700 focus:ring-rose-500"
            }`}
            autoFocus
          />
          {error && (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{error}</span>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            isLoading={isLoading}
            disabled={isLoading}
            className="gap-1.5"
          >
            <XCircle className="w-4 h-4" />
            <span>Confirm Rejection</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
