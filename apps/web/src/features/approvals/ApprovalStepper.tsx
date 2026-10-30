import React from "react";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import type { RequestApprovalStep } from "../../types/requests";

interface ApprovalStepperProps {
  steps?: RequestApprovalStep[];
  currentStatus: string;
}

export const ApprovalStepper: React.FC<ApprovalStepperProps> = ({
  steps = [],
  currentStatus,
}) => {
  if (!steps || steps.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
        No approval steps configured for this request (auto-routed).
      </div>
    );
  }

  // Sort steps by stepOrder
  const sortedSteps = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  // Determine which step is currently active (first pending step)
  const activeStepOrder = sortedSteps.find((s) => s.status === "PENDING")?.stepOrder;

  return (
    <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Approval Workflow Progress
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Sequential approval flow required before task execution
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {sortedSteps.filter((s) => s.status === "APPROVED").length} of {sortedSteps.length} Steps
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            {currentStatus}
          </span>
        </div>
      </div>

      <div className="relative pt-2 pb-2">
        {/* Desktop/Tablet Horizontal Stepper */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedSteps.map((step) => {
            const isApproved = step.status === "APPROVED";
            const isRejected = step.status === "REJECTED";
            const isSkipped = step.status === "SKIPPED";
            const isPending = step.status === "PENDING";
            const isActive = isPending && step.stepOrder === activeStepOrder;
            const isWaiting = isPending && !isActive;

            return (
              <div
                key={step.id}
                className={`relative p-4 rounded-xl border transition-all ${
                  isApproved
                    ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
                    : isRejected
                    ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60"
                    : isActive
                    ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/80 shadow-xs ring-1 ring-amber-400/30"
                    : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800"
                }`}
              >
                {/* Status Header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isApproved
                          ? "bg-emerald-600 text-white"
                          : isRejected
                          ? "bg-rose-600 text-white"
                          : isActive
                          ? "bg-amber-500 text-white animate-pulse"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {step.stepOrder}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Step {step.stepOrder}: {step.approverRole}
                    </span>
                  </div>

                  <div>
                    {isApproved && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="w-3 h-3" /> Approved
                      </span>
                    )}
                    {isRejected && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 rounded-md">
                        <XCircle className="w-3 h-3" /> Rejected
                      </span>
                    )}
                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-md">
                        <Clock className="w-3 h-3" /> Awaiting Action
                      </span>
                    )}
                    {isWaiting && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        <Clock className="w-3 h-3" /> Waiting
                      </span>
                    )}
                    {isSkipped && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500 line-through">
                        Skipped
                      </span>
                    )}
                  </div>
                </div>

                {/* Subtitle / Details */}
                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 mt-2">
                  {step.decidedAt && (
                    <div className="flex items-center gap-1 text-[11px]">
                      <span>Decided:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {new Date(step.decidedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}

                  {step.comment && (
                    <div className="mt-2 p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 italic">
                      "{step.comment}"
                    </div>
                  )}

                  {isActive && (
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium text-[11px] pt-1">
                      <AlertCircle className="w-3 h-3" />
                      Assigned to {step.approverRole} approvers
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
