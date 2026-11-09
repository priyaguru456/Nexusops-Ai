import React, { useMemo } from "react";
import type { CalendarEvent } from "../../types/calendar";
import { getWeekDays, getEventDateKeys } from "./calendarUtils";
import { CalendarEventPill } from "./CalendarEventPill";

interface CalendarWeekViewProps {
  anchorDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectDay: (date: Date) => void;
}

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  anchorDate,
  events,
  onSelectEvent,
  onSelectDay,
}) => {
  const weekDays = useMemo(() => getWeekDays(anchorDate), [anchorDate]);

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
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
      <div className="min-w-[700px] grid grid-cols-7 divide-x divide-neutral-200 dark:divide-neutral-800">
        {weekDays.map((day) => {
          const dayEvents = eventsByDate.get(day.dateKey) || [];

          return (
            <div
              key={day.dateKey}
              className="flex flex-col min-h-[360px] bg-white dark:bg-neutral-900"
            >
              {/* Day header */}
              <button
                type="button"
                onClick={() => onSelectDay(day.date)}
                className={`flex flex-col items-center justify-center border-b border-neutral-200 py-3 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50 ${
                  day.isToday ? "bg-primary-50/50 dark:bg-primary-950/20" : ""
                }`}
              >
                <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  {day.dayName}
                </span>
                <span
                  className={`mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                    day.isToday
                      ? "bg-primary-600 text-white"
                      : "text-neutral-800 dark:text-neutral-200"
                  }`}
                >
                  {day.dayNumber}
                </span>
                <span className="mt-1 text-[10px] text-neutral-400 dark:text-neutral-500">
                  {dayEvents.length} {dayEvents.length === 1 ? "event" : "events"}
                </span>
              </button>

              {/* Day event list */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[500px]">
                {dayEvents.length === 0 ? (
                  <div className="py-6 text-center text-xs text-neutral-400 dark:text-neutral-600">
                    No events
                  </div>
                ) : (
                  dayEvents.map((evt) => (
                    <CalendarEventPill
                      key={`${evt.id}-${day.dateKey}`}
                      event={evt}
                      onClick={onSelectEvent}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
