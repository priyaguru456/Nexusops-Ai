import React from "react";
import { CheckSquare, FileText, CalendarCheck, Sparkles } from "lucide-react";
import type { CalendarEvent } from "../../types/calendar";

interface CalendarEventPillProps {
  event: CalendarEvent;
  onClick: (event: CalendarEvent) => void;
  compact?: boolean;
}

export const EVENT_THEMES = {
  tasks: {
    pill: "border-blue-400/50 bg-blue-50 text-blue-800 hover:bg-blue-100 dark:border-blue-700/60 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:bg-blue-900/60",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200",
    icon: CheckSquare,
    label: "Task",
  },
  requests: {
    pill: "border-amber-400/50 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-900/60",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
    icon: FileText,
    label: "Request",
  },
  leaves: {
    pill: "border-emerald-400/50 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700/60 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-900/60",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
    icon: CalendarCheck,
    label: "Leave",
  },
  holidays: {
    pill: "border-purple-400/50 bg-purple-50 text-purple-800 hover:bg-purple-100 dark:border-purple-700/60 dark:bg-purple-950/60 dark:text-purple-200 dark:hover:bg-purple-900/60",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200",
    icon: Sparkles,
    label: "Holiday",
  },
};

export const CalendarEventPill: React.FC<CalendarEventPillProps> = ({
  event,
  onClick,
  compact = false,
}) => {
  const theme = EVENT_THEMES[event.colorKey] || EVENT_THEMES.tasks;
  const IconComponent = theme.icon;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(event);
    }
  };

  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      onKeyDown={handleKeyDown}
      aria-label={`${theme.label}: ${event.title}`}
      className={`group flex w-full items-center gap-1.5 truncate rounded-md border px-2 py-1 text-left text-xs font-medium transition-all focus:outline-hidden focus:ring-2 focus:ring-primary-500 ${
        theme.pill
      } ${compact ? "py-0.5 text-[11px]" : ""}`}
    >
      <IconComponent className="h-3 w-3 shrink-0 opacity-80" aria-hidden="true" />
      <span className="truncate flex-1">{event.title}</span>
    </button>
  );
};
