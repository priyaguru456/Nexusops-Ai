import React from "react";
import { Check, Clock, X } from "lucide-react";
import { formatKolkataDateTime } from "../../lib/utils";
import type { ApprovalStepDetail } from "../../types/expenses";

interface ApprovalStepperProps {
  steps?: ApprovalStepDetail[];
  currentStatus?: string;
}

export function ApprovalStepper({
  steps = [],
  currentStatus: _currentStatus,
}: ApprovalStepperProps): React.JSX.Element {
  // If no approval steps exist yet (e.g. still in DRAFT)
  if (!steps || steps.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-center text-xs text-slate-500 dark:text-slate-400">
        Approval steps will initialize upon submitting this claim.
      </div>
    );
  }

  const sortedSteps = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  return (
    <div className="space-y-4" aria-label="Approval Stepper">
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
        {sortedSteps.map((step, idx) => {
          const isApproved = step.status === "APPROVED";
          const isRejected = step.status === "REJECTED";
          const isPending = step.status === "PENDING";

          return (
            <div key={step.id || idx} className="relative flex items-start gap-3.5">
              {/* Step indicator node */}
              <div
                className={`absolute -left-6 mt-0.5 flex items-center justify-center w-5 h-5 rounded-full ring-4 ring-white dark:ring-slate-900 ${
                  isApproved
                    ? "bg-emerald-500 text-white"
                    : isRejected
                    ? "bg-rose-500 text-white"
                    : isPending
                    ? "bg-amber-400 text-white animate-pulse"
                    : "bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                }`}
                aria-label={`Step ${step.stepOrder} status: ${step.status}`}
              >
                {isApproved && <Check className="w-3 h-3 stroke-[3]" />}
                {isRejected && <X className="w-3 h-3 stroke-[3]" />}
                {isPending && <Clock className="w-3 h-3 stroke-[3]" />}
              </div>

              {/* Step details */}
              <div className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Step {step.stepOrder}: {step.approverRole === "MANAGER" ? "Manager Review" : "Finance & Admin Review"}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                        isApproved
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : isRejected
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                          : isPending
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {step.status}
                    </span>
                  </div>
                  {step.decidedAt && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {formatKolkataDateTime(step.decidedAt)}
                    </span>
                  )}
                </div>

                {step.approver && (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Approver: <span className="font-medium">{step.approver.name}</span> ({step.approver.email})
                  </p>
                )}

                {step.comment && (
                  <div className="mt-2 text-xs italic text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700/40">
                    "{step.comment}"
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
