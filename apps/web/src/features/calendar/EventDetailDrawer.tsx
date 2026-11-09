import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  X,
  ExternalLink,
  Calendar as CalendarIcon,
  Clock,
  User,
  Tag,
  AlertCircle,
  Edit2,
  Trash2,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { useAuth } from "../auth/AuthContext";
import type { CalendarEvent } from "../../types/calendar";
import { EVENT_THEMES } from "./CalendarEventPill";
import {
  formatKolkataFullDate,
  formatKolkataTime,
  formatKolkataShortDate,
} from "./calendarUtils";

interface EventDetailDrawerProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onEditHoliday?: (event: CalendarEvent) => void;
  onDeleteHoliday?: (event: CalendarEvent) => void;
}

export const EventDetailDrawer: React.FC<EventDetailDrawerProps> = ({
  event,
  isOpen,
  onClose,
  onEditHoliday,
  onDeleteHoliday,
}) => {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !event) return null;

  const theme = EVENT_THEMES[event.colorKey] || EVENT_THEMES.tasks;
  const IconComponent = theme.icon;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-event-title"
    >
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          className="w-screen max-w-md bg-white p-6 shadow-xl dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 flex flex-col justify-between"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top section */}
          <div>
            {/* Header / Close */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`px-2.5 py-1 text-xs font-semibold ${theme.badge}`}>
                  <IconComponent className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                  {theme.label}
                </Badge>
                {event.details.status && (
                  <Badge variant="outline" className="text-xs">
                    {event.details.status}
                  </Badge>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close event details"
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Title */}
            <div className="mt-4">
              <h2
                id="drawer-event-title"
                className="text-lg font-bold text-neutral-900 dark:text-neutral-100"
              >
                {event.title}
              </h2>
            </div>

            {/* Time / Date Details */}
            <div className="mt-4 space-y-3 rounded-lg border border-neutral-100 bg-neutral-50/60 p-3.5 dark:border-neutral-800 dark:bg-neutral-800/40 text-xs">
              <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
                <CalendarIcon className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                <span className="font-medium">
                  {event.allDay
                    ? `${formatKolkataShortDate(event.start)}${
                        event.start !== event.end ? ` to ${formatKolkataShortDate(event.end)}` : ""
                      }`
                    : formatKolkataFullDate(event.start)}
                </span>
              </div>

              {!event.allDay && (
                <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
                  <Clock className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                  <span>Time: {formatKolkataTime(event.start)} (Asia/Kolkata)</span>
                </div>
              )}
            </div>

            {/* Entity-specific properties */}
            <div className="mt-5 space-y-3 text-xs">
              {event.type === "TASK" && (
                <>
                  {event.details.priority && (
                    <div className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                      <span className="text-neutral-500">Priority</span>
                      <span className="font-semibold">{event.details.priority}</span>
                    </div>
                  )}
                  {event.details.assigneeName && (
                    <div className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                      <span className="text-neutral-500">Assignee</span>
                      <span className="font-medium flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-neutral-400" />
                        {event.details.assigneeName}
                      </span>
                    </div>
                  )}
                </>
              )}

              {event.type === "REQUEST" && (
                <>
                  {event.details.category && (
                    <div className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                      <span className="text-neutral-500">Category</span>
                      <span className="font-semibold flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5 text-neutral-400" />
                        {event.details.category}
                      </span>
                    </div>
                  )}
                  {event.details.priority && (
                    <div className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                      <span className="text-neutral-500">Priority</span>
                      <span className="font-semibold">{event.details.priority}</span>
                    </div>
                  )}
                  {event.details.requesterName && (
                    <div className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                      <span className="text-neutral-500">Requester</span>
                      <span className="font-medium">{event.details.requesterName}</span>
                    </div>
                  )}
                  {event.details.amount != null && (
                    <div className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                      <span className="text-neutral-500">Amount</span>
                      <span className="font-semibold">₹{event.details.amount.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </>
              )}

              {event.type === "LEAVE" && (
                <>
                  {event.details.userName && (
                    <div className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                      <span className="text-neutral-500">Employee</span>
                      <span className="font-medium">{event.details.userName}</span>
                    </div>
                  )}
                  {event.details.departmentName && (
                    <div className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                      <span className="text-neutral-500">Department</span>
                      <span className="font-medium">{event.details.departmentName}</span>
                    </div>
                  )}
                  {event.details.leaveType && (
                    <div className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                      <span className="text-neutral-500">Leave Type</span>
                      <span className="font-semibold">{event.details.leaveType}</span>
                    </div>
                  )}
                  {event.details.daysCount && (
                    <div className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                      <span className="text-neutral-500">Working Days</span>
                      <span className="font-semibold">{event.details.daysCount} days</span>
                    </div>
                  )}
                  {event.details.reason && (
                    <div className="py-2 border-b border-neutral-100 dark:border-neutral-800">
                      <span className="text-neutral-500 block mb-1">Reason</span>
                      <p className="text-neutral-700 dark:text-neutral-300 italic bg-neutral-50 dark:bg-neutral-800/60 p-2 rounded">
                        "{event.details.reason}"
                      </p>
                    </div>
                  )}
                </>
              )}

              {event.type === "HOLIDAY" && (
                <div className="rounded-lg bg-purple-50/50 p-3 text-purple-900 dark:bg-purple-950/20 dark:text-purple-200">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertCircle className="h-4 w-4" />
                    <span>Company Wide Observance</span>
                  </div>
                  <p className="mt-1 text-xs opacity-80">
                    NexusOps offices are closed for {event.title}. All staff are granted public holiday leave.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
            {event.type === "HOLIDAY" && isAdmin && (
              <div className="flex items-center gap-2">
                {onEditHoliday && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onEditHoliday(event)}
                    className="flex-1 flex items-center justify-center gap-1.5"
                    aria-label={`Edit holiday ${event.title}`}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Edit Holiday
                  </Button>
                )}
                {onDeleteHoliday && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => onDeleteHoliday(event)}
                    className="flex items-center justify-center gap-1.5"
                    aria-label={`Delete holiday ${event.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                )}
              </div>
            )}

            {event.details.link && event.type !== "HOLIDAY" && (
              <Link
                to={event.details.link}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary-700 transition-colors"
              >
                <span>View Full {theme.label} Details</span>
                <ExternalLink className="h-4 w-4" />
              </Link>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
