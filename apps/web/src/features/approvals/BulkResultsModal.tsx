import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/button";
import type { BulkApproveResponse, PendingApprovalStep } from "../../types/approvals";

interface BulkResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: BulkApproveResponse | null;
  steps: PendingApprovalStep[];
}

export const BulkResultsModal: React.FC<BulkResultsModalProps> = ({
  isOpen,
  onClose,
  result,
  steps,
}) => {
  if (!result) return null;

  const stepMap = new Map<string, PendingApprovalStep>();
  for (const step of steps) {
    stepMap.set(step.id, step);
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Approval Summary"
      description="Detailed results for the selected approval steps."
      maxWidth="md"
    >
      <div className="space-y-4 pt-2">
        {/* Summary Badges */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{result.summary.succeeded} Succeeded</span>
          </div>
          {result.summary.failed > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>{result.summary.failed} Failed</span>
            </div>
          )}
          <span className="text-xs text-slate-400 ml-auto">
            Total: {result.summary.total}
          </span>
        </div>

        {/* Itemized Results List */}
        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
          {result.results.map((res) => {
            const step = stepMap.get(res.stepId);
            const title = step?.request.title || `Request #${res.stepId.slice(0, 8)}`;
            const requester = step?.request.requester.name;

            return (
              <div
                key={res.stepId}
                className={`p-3 rounded-xl border text-xs space-y-1 ${
                  res.success
                    ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
                    : "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {res.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {title}
                    </span>
                  </div>
                  <span
                    className={`font-semibold uppercase text-[10px] px-1.5 py-0.5 rounded ${
                      res.success
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300"
                    }`}
                  >
                    {res.success ? "Approved" : "Failed"}
                  </span>
                </div>

                {requester && (
                  <p className="text-[11px] text-slate-500 pl-6">
                    Requester: {requester}
                  </p>
                )}

                {!res.success && res.error && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 pl-6 font-medium">
                    Reason: {res.error}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button size="sm" onClick={onClose} className="h-8">
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
