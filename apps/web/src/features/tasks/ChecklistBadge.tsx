import React from "react";
import { parseChecklist, type ChecklistInfo } from "./taskUtils";

interface ChecklistBadgeProps {
  description?: string | null;
  checklist?: ChecklistInfo | null;
  className?: string;
}

export function ChecklistBadge({
  description,
  checklist: propChecklist,
  className = "",
}: ChecklistBadgeProps): React.JSX.Element | null {
  const checklist = propChecklist !== undefined ? propChecklist : parseChecklist(description);

  if (!checklist || checklist.total === 0) {
    return null;
  }

  const { completed, total, percent } = checklist;
  const isComplete = completed === total;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 ${className}`}
      title={`${completed} of ${total} items completed (${percent}%)`}
      aria-label={`Checklist: ${completed} of ${total} items completed`}
    >
      <span className="font-semibold text-[11px] whitespace-nowrap">
        ✓ {completed}/{total}
      </span>
      <div
        className="w-8 sm:w-10 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shrink-0"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isComplete ? "bg-emerald-500" : "bg-indigo-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
