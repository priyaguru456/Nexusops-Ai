import React from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "./button";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  actionLabel?: string;
  onAction?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon = FolderOpen,
  actionLabel,
  onAction,
  children,
  className = "",
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-sm border border-indigo-100 dark:border-indigo-900/40">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
        {title}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-5">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="default" size="sm">
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}
