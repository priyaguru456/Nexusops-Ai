import React from "react";
import { Calendar, AlertCircle, Clock } from "lucide-react";
import { getDueDateBadge, formatKolkataDisplayDate } from "./taskUtils";
import type { TaskStatus } from "../../types/tasks";

interface DueDateBadgeProps {
  dueDate: string | null | undefined;
  status: TaskStatus | string;
  className?: string;
  showFallbackDate?: boolean;
}

export function DueDateBadge({
  dueDate,
  status,
  className = "",
  showFallbackDate = true,
}: DueDateBadgeProps): React.JSX.Element | null {
  if (!dueDate) return null;

  const badgeInfo = getDueDateBadge(dueDate, status);

  if (badgeInfo) {
    const IconComponent =
      badgeInfo.type === "overdue"
        ? AlertCircle
        : badgeInfo.type === "today"
        ? Clock
        : Calendar;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${badgeInfo.className} ${className}`}
        title={`Due date: ${formatKolkataDisplayDate(dueDate, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })} (Asia/Kolkata)`}
        aria-label={`Due date status: ${badgeInfo.text}`}
      >
        <IconComponent className="w-3 h-3 shrink-0" />
        <span className="whitespace-nowrap">{badgeInfo.text}</span>
      </span>
    );
  }

  // When status is DONE or due date is > 7 days ahead
  if (!showFallbackDate) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 ${className}`}
      title={`Due: ${formatKolkataDisplayDate(dueDate, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })} (Asia/Kolkata)`}
    >
      <Calendar className="w-3 h-3 shrink-0" />
      <span>{formatKolkataDisplayDate(dueDate)}</span>
    </span>
  );
}
