import React, { useState, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/button";
import type { PendingApprovalStep } from "../../types/approvals";

interface BulkApproveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comment?: string) => Promise<void> | void;
  isLoading: boolean;
  selectedSteps: PendingApprovalStep[];
}

export const BulkApproveModal: React.FC<BulkApproveModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  selectedSteps,
}) => {
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (isOpen) {
      setComment("");
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(comment.trim() || undefined);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        if (!isLoading) onClose();
      }}
      title={`Bulk Approve (${selectedSteps.length}) Requests`}
      description="You are about to batch approve the selected requests. The server will verify authorization for each item."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {/* Selected Items Preview */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Selected Requests ({selectedSteps.length})
          </label>
          <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs">
            {selectedSteps.map((step) => (
              <div
                key={step.id}
                className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60"
              >
                <div className="truncate pr-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {step.request.title}
                  </span>
                  <span className="text-slate-400 ml-1.5">
                    (by {step.request.requester.name})
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                  #{step.request.id.slice(0, 8)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Optional Comment Input */}
        <div className="space-y-1.5">
          <label
            htmlFor="bulk-approval-comment"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Approval Comment <span className="text-slate-400 font-normal">(Optional, applied to all items)</span>
          </label>
          <textarea
            id="bulk-approval-comment"
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={isLoading}
            placeholder="Add optional notes or authorization instructions..."
            className="w-full p-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            autoFocus
          />
        </div>

        {/* Modal Actions */}
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
            size="sm"
            isLoading={isLoading}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Approve {selectedSteps.length} Item{selectedSteps.length > 1 ? "s" : ""}</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
