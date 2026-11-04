import React from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Ban,
  MessageSquare,
  User,
  ShieldAlert,
} from "lucide-react";
import type { RequestApprovalStep } from "../../types/requests";
import { formatKolkataDateTime } from "../../lib/utils";

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
      <div className="p-5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/40">
        No formal approval steps registered for this request.
      </div>
    );
  }

  // Sort real approval steps by sequential stepOrder
  const sortedSteps = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  // Identify the currently pending step (the first step in order that remains PENDING)
  const activeStepOrder = sortedSteps.find((s) => s.status === "PENDING")?.stepOrder;

  const approvedCount = sortedSteps.filter((s) => s.status === "APPROVED").length;
  const isRejectedFlow = sortedSteps.some((s) => s.status === "REJECTED");

  return (
    <div
      className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-5"
      role="region"
      aria-label="Sequential approval workflow progress"
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Approval Progress
            </h2>
            {isRejectedFlow && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-md">
                <ShieldAlert className="w-3 h-3" />
                Workflow Terminated (Rejected)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real multi-stage workflow enforced sequentially before execution
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {approvedCount} of {sortedSteps.length} Approved
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            {currentStatus.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Stepper Grid (Responsive for mobile, tablet, desktop) */}
      <ol
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        role="list"
      >
        {sortedSteps.map((step) => {
          const isApproved = step.status === "APPROVED";
          const isRejected = step.status === "REJECTED";
          const isSkipped = step.status === "SKIPPED";
          const isPending = step.status === "PENDING";
          const isCurrentActive = isPending && step.stepOrder === activeStepOrder;
          const isUpcomingWaiting = isPending && !isCurrentActive;

          return (
            <li
              key={step.id}
              aria-current={isCurrentActive ? "step" : undefined}
              className={`relative rounded-xl border p-4 transition-all flex flex-col justify-between ${
                isApproved
                  ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/80 shadow-xs"
                  : isRejected
                  ? "bg-rose-50/50 dark:bg-rose-950/25 border-rose-300 dark:border-rose-800/80 shadow-xs"
                  : isCurrentActive
                  ? "bg-amber-50/60 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600/90 shadow-sm ring-2 ring-amber-400/40 dark:ring-amber-500/40"
                  : isSkipped
                  ? "bg-slate-50/30 dark:bg-slate-900/30 border-dashed border-slate-300 dark:border-slate-800 opacity-60"
                  : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-80"
              }`}
            >
              <div>
                {/* Step Top Bar: Order circle, Role name, and Status Badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-transform ${
                        isApproved
                          ? "bg-emerald-600 text-white"
                          : isRejected
                          ? "bg-rose-600 text-white"
                          : isCurrentActive
                          ? "bg-amber-500 text-white motion-safe:animate-pulse ring-2 ring-amber-300 dark:ring-amber-600"
                          : isSkipped
                          ? "bg-slate-200 dark:bg-slate-700 text-slate-400 line-through"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                      aria-hidden="true"
                    >
                      {step.stepOrder}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <span>Step {step.stepOrder}</span>
                        <span className="text-slate-400 font-normal">•</span>
                        <span className="uppercase text-[11px] tracking-wide text-indigo-700 dark:text-indigo-400 font-semibold">
                          {step.approverRole}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>
                          {step.approver?.name
                            ? step.approver.name
                            : `Authorized ${step.approverRole}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isApproved && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Approved
                      </span>
                    )}
                    {isRejected && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-800 dark:text-rose-300 bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800">
                        <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        Rejected
                      </span>
                    )}
                    {isCurrentActive && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-700">
                        <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 motion-safe:animate-spin" />
                        Pending Action
                      </span>
                    )}
                    {isUpcomingWaiting && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Waiting
                      </span>
                    )}
                    {isSkipped && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/40 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-800">
                        <Ban className="w-3 h-3" />
                        Skipped
                      </span>
                    )}
                  </div>
                </div>

                {/* Decision Timestamps & Details in Asia/Kolkata */}
                <div className="text-xs space-y-1.5 pt-1">
                  {step.decidedAt ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>Decided:</span>
                      <time
                        dateTime={step.decidedAt}
                        className="font-medium text-slate-800 dark:text-slate-200"
                      >
                        {formatKolkataDateTime(step.decidedAt)}
                      </time>
                    </div>
                  ) : isCurrentActive ? (
                    <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300 text-[11px] font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Currently awaiting action from {step.approverRole}</span>
                    </div>
                  ) : isUpcomingWaiting ? (
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                      Will activate once Step {step.stepOrder - 1} is approved
                    </div>
                  ) : null}

                  {/* Decision Comment */}
                  {step.comment && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
                      <div className="flex items-start gap-1.5">
                        <MessageSquare className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 mr-1">
                            {step.approver?.name || step.approverRole}:
                          </span>
                          <span className="italic">"{step.comment}"</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step State Footer Notice */}
              {isSkipped && (
                <div className="mt-2 text-[10px] text-slate-400 italic">
                  Step skipped due to previous rejection or flow termination.
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
