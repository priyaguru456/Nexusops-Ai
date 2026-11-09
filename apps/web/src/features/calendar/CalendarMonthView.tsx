import React, { useMemo } from "react";
import type { CalendarEvent } from "../../types/calendar";
import { getMonthDaysGrid, getEventDateKeys } from "./calendarUtils";
import { CalendarEventPill } from "./CalendarEventPill";

interface CalendarMonthViewProps {
  anchorDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectDay: (date: Date) => void;
}

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  anchorDate,
  events,
  onSelectEvent,
  onSelectDay,
}) => {
  const cells = useMemo(() => getMonthDaysGrid(anchorDate), [anchorDate]);

  // Index events by dateKey for fast O(1) lookup per cell
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const evt of events) {
      const keys = getEventDateKeys(evt);
      for (const k of keys) {
        if (!map.has(k)) {
          map.set(k, []);
        }
        map.get(k)!.push(evt);
      }
    }
    return map;
  }, [events]);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50/70 text-center dark:border-neutral-800 dark:bg-neutral-800/40">
        {WEEKDAY_NAMES.map((name) => (
          <div
            key={name}
            className="py-2.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-neutral-200 dark:divide-neutral-800">
        {cells.map((cell) => {
          const dayEvents = eventsByDate.get(cell.dateKey) || [];
          const visibleEvents = dayEvents.slice(0, 3);
          const overflowCount = dayEvents.length - visibleEvents.length;

          return (
            <div
              key={cell.dateKey}
              onClick={() => onSelectDay(cell.date)}
              className={`min-h-[110px] sm:min-h-[125px] p-1.5 transition-colors cursor-pointer hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 flex flex-col justify-between ${
                cell.isCurrentMonth
                  ? "bg-white dark:bg-neutral-900"
                  : "bg-neutral-50/40 text-neutral-400 dark:bg-neutral-950/40 dark:text-neutral-600"
              }`}
            >
              {/* Day number header */}
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    cell.isToday
                      ? "bg-primary-600 text-white font-bold"
                      : cell.isCurrentMonth
                      ? "text-neutral-700 dark:text-neutral-300"
                      : "text-neutral-400 dark:text-neutral-600"
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {dayEvents.length > 0 && (
                  <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 hidden sm:inline">
                    {dayEvents.length} {dayEvents.length === 1 ? "event" : "events"}
                  </span>
                )}
              </div>

              {/* Event pills stack */}
              <div
                className="mt-1 flex-1 space-y-1 overflow-hidden"
                onClick={(e) => e.stopPropagation()} // Keep individual event clicks discrete
              >
                {visibleEvents.map((evt) => (
                  <CalendarEventPill
                    key={`${evt.id}-${cell.dateKey}`}
                    event={evt}
                    onClick={onSelectEvent}
                    compact
                  />
                ))}

                {overflowCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectDay(cell.date)}
                    className="w-full text-left text-[11px] font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 px-1 py-0.5 rounded transition-colors"
                  >
                    +{overflowCount} more...
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
