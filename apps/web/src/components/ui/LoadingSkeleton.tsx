import React from "react";

export function LoadingSkeleton({ className = "" }: { className?: string }): React.JSX.Element {
  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-lg ${className}`}
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }): React.JSX.Element {
  return (
    <div className="w-full space-y-3">
      <div className="flex gap-4 p-4 border-b border-slate-200 dark:border-slate-800">
        {Array.from({ length: cols }).map((_, i) => (
          <LoadingSkeleton key={`head-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`row-${r}`} className="flex gap-4 p-4 items-center">
          {Array.from({ length: cols }).map((_, c) => (
            <LoadingSkeleton key={`cell-${r}-${c}`} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function KanbanSkeleton(): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
      {Array.from({ length: 4 }).map((_, col) => (
        <div
          key={`col-${col}`}
          className="bg-slate-100/60 dark:bg-slate-900/40 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3"
        >
          <LoadingSkeleton className="h-6 w-1/2 mb-4" />
          {Array.from({ length: 3 }).map((_, card) => (
            <div
              key={`card-${col}-${card}`}
              className="bg-white dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2"
            >
              <LoadingSkeleton className="h-4 w-3/4" />
              <LoadingSkeleton className="h-3 w-1/2" />
              <div className="flex justify-between pt-2">
                <LoadingSkeleton className="h-5 w-16" />
                <LoadingSkeleton className="h-6 w-6 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-2">
          <LoadingSkeleton className="h-8 w-64" />
          <LoadingSkeleton className="h-4 w-36" />
        </div>
        <div className="flex gap-3">
          <LoadingSkeleton className="h-10 w-24" />
          <LoadingSkeleton className="h-10 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <LoadingSkeleton className="h-48 w-full rounded-2xl" />
          <LoadingSkeleton className="h-64 w-full rounded-2xl" />
        </div>
        <div className="space-y-6">
          <LoadingSkeleton className="h-44 w-full rounded-2xl" />
          <LoadingSkeleton className="h-72 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
