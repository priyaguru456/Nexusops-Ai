import React from "react";
import {
  FileEdit,
  Send,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  CheckCheck,
  Ban,
  ListTodo,
  AlertOctagon,
} from "lucide-react";
import type { RequestStatus } from "../../types/requests";
import type { TaskStatus } from "../../types/tasks";

interface StatusBadgeProps {
  status: RequestStatus | TaskStatus | string;
  className?: string;
  size?: "sm" | "md";
}

export function StatusBadge({
  status,
  className = "",
  size = "md",
}: StatusBadgeProps): React.JSX.Element {
  const normalized = status.toUpperCase();

  const configMap: Record<
    string,
    { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    // Request statuses
    DRAFT: {
      label: "Draft",
      bg: "bg-slate-100 dark:bg-slate-800",
      text: "text-slate-700 dark:text-slate-300",
      border: "border-slate-300 dark:border-slate-700",
      icon: FileEdit,
    },
    SUBMITTED: {
      label: "Submitted",
      bg: "bg-blue-50 dark:bg-blue-950/60",
      text: "text-blue-700 dark:text-blue-300",
      border: "border-blue-200 dark:border-blue-800",
      icon: Send,
    },
    IN_REVIEW: {
      label: "In Review",
      bg: "bg-indigo-50 dark:bg-indigo-950/60",
      text: "text-indigo-700 dark:text-indigo-300",
      border: "border-indigo-200 dark:border-indigo-800",
      icon: Eye,
    },
    APPROVED: {
      label: "Approved",
      bg: "bg-emerald-50 dark:bg-emerald-950/60",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-200 dark:border-emerald-800",
      icon: CheckCircle,
    },
    REJECTED: {
      label: "Rejected",
      bg: "bg-rose-50 dark:bg-rose-950/60",
      text: "text-rose-700 dark:text-rose-300",
      border: "border-rose-200 dark:border-rose-800",
      icon: XCircle,
    },
    IN_PROGRESS: {
      label: "In Progress",
      bg: "bg-amber-50 dark:bg-amber-950/60",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-200 dark:border-amber-800",
      icon: Clock,
    },
    COMPLETED: {
      label: "Completed",
      bg: "bg-teal-50 dark:bg-teal-950/60",
      text: "text-teal-700 dark:text-teal-300",
      border: "border-teal-200 dark:border-teal-800",
      icon: CheckCheck,
    },
    CANCELLED: {
      label: "Cancelled",
      bg: "bg-zinc-100 dark:bg-zinc-800",
      text: "text-zinc-600 dark:text-zinc-400",
      border: "border-zinc-300 dark:border-zinc-700",
      icon: Ban,
    },

    // Task statuses
    TODO: {
      label: "To Do",
      bg: "bg-slate-100 dark:bg-slate-800",
      text: "text-slate-700 dark:text-slate-300",
      border: "border-slate-300 dark:border-slate-700",
      icon: ListTodo,
    },
    BLOCKED: {
      label: "Blocked",
      bg: "bg-rose-50 dark:bg-rose-950/60",
      text: "text-rose-700 dark:text-rose-300",
      border: "border-rose-200 dark:border-rose-800",
      icon: AlertOctagon,
    },
    DONE: {
      label: "Done",
      bg: "bg-emerald-50 dark:bg-emerald-950/60",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-200 dark:border-emerald-800",
      icon: CheckCheck,
    },
  };

  const config = configMap[normalized] || {
    label: normalized.replace("_", " "),
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-300 dark:border-slate-700",
    icon: Clock,
  };

  const IconComponent = config.icon;
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs gap-1" : "px-2.5 py-1 text-xs font-medium gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium transition-colors ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
    >
      <IconComponent className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      <span>{config.label}</span>
    </span>
  );
}
