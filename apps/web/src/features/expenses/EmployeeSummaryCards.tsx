import React from "react";
import { CheckCircle2, Clock, FileEdit, TrendingUp } from "lucide-react";
import { formatINR } from "../../lib/utils";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import type { ExpenseSummary } from "../../types/expenses";

interface EmployeeSummaryCardsProps {
  summary?: ExpenseSummary;
  isLoading: boolean;
  isFinanceOrAdmin?: boolean;
}

export function EmployeeSummaryCards({
  summary,
  isLoading,
}: EmployeeSummaryCardsProps): React.JSX.Element {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        aria-label="Loading summary metrics"
      >
        <LoadingSkeleton className="h-32 rounded-2xl" />
        <LoadingSkeleton className="h-32 rounded-2xl" />
        <LoadingSkeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  const employeeStats = summary?.employee || {
    totalReimbursedThisYear: 0,
    pendingPayout: 0,
    draftClaimsCount: 0,
    year: new Date().getFullYear(),
  };

  const currentYear = employeeStats.year || new Date().getFullYear();

  return (
    <section
      aria-label="Expense Summary Metrics"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {/* 1. Total reimbursed this year */}
      <div className="relative overflow-hidden p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Reimbursed ({currentYear})
            </p>
            <h3
              className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400"
              data-testid="summary-reimbursed"
            >
              {formatINR(employeeStats.totalReimbursedThisYear)}
            </h3>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" /> Successfully paid out
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
            <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* 2. Pending payout */}
      <div className="relative overflow-hidden p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Pending Payout
            </p>
            <h3
              className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400"
              data-testid="summary-pending-payout"
            >
              {formatINR(employeeStats.pendingPayout)}
            </h3>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Approved claims awaiting transfer
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
            <Clock className="w-5 h-5" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* 3. Draft claims */}
      <div className="relative overflow-hidden p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Draft Claims
            </p>
            <h3
              className="mt-2 text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400"
              data-testid="summary-draft-claims"
            >
              {employeeStats.draftClaimsCount}{" "}
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                {employeeStats.draftClaimsCount === 1 ? "claim" : "claims"}
              </span>
            </h3>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Ready to edit and submit
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
            <FileEdit className="w-5 h-5" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
