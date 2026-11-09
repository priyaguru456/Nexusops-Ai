import React, { useMemo } from "react";
import { Clock, ExternalLink, Calendar as CalendarIcon } from "lucide-react";
import type { CalendarEvent } from "../../types/calendar";
import { getKolkataDateKey, formatKolkataFullDate, formatKolkataTime, getEventDateKeys } from "./calendarUtils";
import { EVENT_THEMES } from "./CalendarEventPill";
import { Badge } from "../../components/ui/badge";
import { EmptyState } from "../../components/ui/EmptyState";

interface CalendarDayViewProps {
  anchorDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
}

export const CalendarDayView: React.FC<CalendarDayViewProps> = ({
  anchorDate,
  events,
  onSelectEvent,
}) => {
  const targetDateKey = useMemo(() => getKolkataDateKey(anchorDate), [anchorDate]);

  const dayEvents = useMemo(() => {
    return events.filter((evt) => {
      const keys = getEventDateKeys(evt);
      return keys.includes(targetDateKey);
    });
  }, [events, targetDateKey]);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
      <div className="border-b border-neutral-200 pb-4 dark:border-neutral-800 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            {formatKolkataFullDate(anchorDate)}
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {dayEvents.length} scheduled {dayEvents.length === 1 ? "event" : "events"} for this day (Asia/Kolkata)
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {dayEvents.length === 0 ? (
          <EmptyState
            title="No events scheduled"
            description="There are no tasks, requests, leaves, or holidays on this date."
            icon={CalendarIcon}
          />
        ) : (
          dayEvents.map((evt) => {
            const theme = EVENT_THEMES[evt.colorKey] || EVENT_THEMES.tasks;
            const IconComponent = theme.icon;

            return (
              <div
                key={evt.id}
                onClick={() => onSelectEvent(evt)}
                className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-neutral-200 p-4 transition-all hover:border-neutral-300 hover:shadow-xs cursor-pointer dark:border-neutral-800 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${theme.badge}`}
                    aria-hidden="true"
                  >
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                        {evt.title}
                      </span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${theme.badge}`}>
                        {theme.label}
                      </Badge>
                      {evt.details.status && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {evt.details.status}
                        </Badge>
                      )}
                      {evt.details.priority && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {evt.details.priority}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {evt.allDay ? "All Day" : formatKolkataTime(evt.start)}
                      </span>

                      {evt.details.assigneeName && (
                        <span>Assignee: {evt.details.assigneeName}</span>
                      )}
                      {evt.details.requesterName && (
                        <span>Requester: {evt.details.requesterName}</span>
                      )}
                      {evt.details.userName && <span>Staff: {evt.details.userName}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <span className="text-xs text-primary-600 group-hover:underline dark:text-primary-400 flex items-center gap-1">
                    Details
                    <ExternalLink className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
