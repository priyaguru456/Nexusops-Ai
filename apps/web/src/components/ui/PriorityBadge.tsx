import React from "react";
import { ArrowDown, Minus, ArrowUp, Flame } from "lucide-react";
import type { Priority } from "../../types/requests";

interface PriorityBadgeProps {
  priority: Priority | string;
  className?: string;
  showIcon?: boolean;
}

export function PriorityBadge({
  priority,
  className = "",
  showIcon = true,
}: PriorityBadgeProps): React.JSX.Element {
  const normalized = priority.toUpperCase();

  const configMap: Record<
    string,
    { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    LOW: {
      label: "Low",
      bg: "bg-slate-100 dark:bg-slate-800",
      text: "text-slate-600 dark:text-slate-400",
      border: "border-slate-200 dark:border-slate-700",
      icon: ArrowDown,
    },
    MEDIUM: {
      label: "Medium",
      bg: "bg-blue-50 dark:bg-blue-950/60",
      text: "text-blue-700 dark:text-blue-300",
      border: "border-blue-200 dark:border-blue-800",
      icon: Minus,
    },
    HIGH: {
      label: "High",
      bg: "bg-amber-50 dark:bg-amber-950/60",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-200 dark:border-amber-800",
      icon: ArrowUp,
    },
    URGENT: {
      label: "Urgent",
      bg: "bg-rose-50 dark:bg-rose-950/60",
      text: "text-rose-700 dark:text-rose-300 font-semibold",
      border: "border-rose-300 dark:border-rose-800",
      icon: Flame,
    },
  };

  const isUrgent = normalized === "URGENT";

  const config = configMap[normalized] || {
    label: normalized,
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
    icon: Minus,
  };

  const IconComponent = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${config.bg} ${config.text} ${config.border} ${
        isUrgent
          ? "motion-safe:animate-pulse ring-1 ring-rose-400/40 dark:ring-rose-500/40 motion-reduce:animate-none"
          : ""
      } ${className}`}
      aria-label={`Priority: ${config.label}${isUrgent ? " (Urgent)" : ""}`}
    >
      {isUrgent && (
        <span className="relative flex h-2 w-2 mr-0.5 shrink-0" aria-hidden="true">
          <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 motion-reduce:hidden" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600 dark:bg-rose-500" />
        </span>
      )}
      {showIcon && <IconComponent className="w-3 h-3 shrink-0" aria-hidden="true" />}
      <span>{config.label}</span>
    </span>
  );
}
