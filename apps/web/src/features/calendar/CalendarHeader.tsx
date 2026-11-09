import React from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "../../components/ui/button";
import type { CalendarViewMode } from "../../types/calendar";
import {
  formatKolkataMonthYear,
  formatKolkataFullDate,
  formatKolkataShortDate,
  getWeekDays,
} from "./calendarUtils";

interface CalendarHeaderProps {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  anchorDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  viewMode,
  onViewModeChange,
  anchorDate,
  onPrev,
  onNext,
  onToday,
}) => {
  const getHeaderTitle = () => {
    if (viewMode === "month") {
      return formatKolkataMonthYear(anchorDate);
    }
    if (viewMode === "week") {
      const week = getWeekDays(anchorDate);
      const first = week[0].date;
      const last = week[6].date;
      return `${formatKolkataShortDate(first)} – ${formatKolkataShortDate(last)}`;
    }
    return formatKolkataFullDate(anchorDate);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
      {/* Title & Navigation Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg border border-neutral-200 p-0.5 dark:border-neutral-800">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onPrev}
            aria-label="Previous date range"
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToday}
            aria-label="Jump to today"
            className="h-8 px-2.5 text-xs font-semibold"
          >
            Today
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onNext}
            aria-label="Next date range"
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary-500 hidden sm:inline-block" aria-hidden="true" />
          <span>{getHeaderTitle()}</span>
        </h2>
      </div>

      {/* View Switcher */}
      <div
        role="tablist"
        aria-label="Calendar view selector"
        className="flex items-center rounded-lg border border-neutral-200 bg-neutral-100/60 p-1 dark:border-neutral-800 dark:bg-neutral-800/60 self-start sm:self-auto"
      >
        <button
          role="tab"
          type="button"
          aria-selected={viewMode === "month"}
          onClick={() => onViewModeChange("month")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            viewMode === "month"
              ? "bg-white text-neutral-900 shadow-xs dark:bg-neutral-900 dark:text-neutral-100"
              : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          }`}
        >
          Month
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={viewMode === "week"}
          onClick={() => onViewModeChange("week")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            viewMode === "week"
              ? "bg-white text-neutral-900 shadow-xs dark:bg-neutral-900 dark:text-neutral-100"
              : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          }`}
        >
          Week
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={viewMode === "day"}
          onClick={() => onViewModeChange("day")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            viewMode === "day"
              ? "bg-white text-neutral-900 shadow-xs dark:bg-neutral-900 dark:text-neutral-100"
              : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          }`}
        >
          Day
        </button>
      </div>
    </div>
  );
};
