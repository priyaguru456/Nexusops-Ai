import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar as CalendarIcon, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/toast";
import { useAuth } from "../auth/AuthContext";
import { calendarApi } from "./calendarApi";
import { CalendarSidebar } from "./CalendarSidebar";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarMonthView } from "./CalendarMonthView";
import { CalendarWeekView } from "./CalendarWeekView";
import { CalendarDayView } from "./CalendarDayView";
import { EventDetailDrawer } from "./EventDetailDrawer";
import { HolidayModal } from "./HolidayModal";
import { getVisibleRange } from "./calendarUtils";
import type {
  CalendarViewMode,
  CalendarToggles,
  CalendarEvent,
} from "../../types/calendar";

const STORAGE_KEY = "nexusops_calendar_toggles";

const DEFAULT_TOGGLES: CalendarToggles = {
  tasks: true,
  requests: true,
  leaves: true,
  holidays: true,
};

export const CalendarPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const { role } = useAuth();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());

  // Restore toggles from localStorage or default
  const [toggles, setToggles] = useState<CalendarToggles>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_TOGGLES, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_TOGGLES;
  });

  // Persist toggles to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toggles));
    } catch {
      // Ignore storage errors
    }
  }, [toggles]);

  const handleToggle = useCallback((key: keyof CalendarToggles) => {
    setToggles((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  // Selected event for detail drawer
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Holiday modals
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [holidayToEdit, setHolidayToEdit] = useState<CalendarEvent | null>(null);
  const [holidayToDelete, setHolidayToDelete] = useState<CalendarEvent | null>(null);

  // Compute visible range for current view and anchor date
  const visibleRange = useMemo(
    () => getVisibleRange(viewMode, anchorDate),
    [viewMode, anchorDate]
  );

  // Query events in visible range
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["calendar-events", visibleRange.start, visibleRange.end],
    queryFn: () => calendarApi.getEvents(visibleRange.start, visibleRange.end),
    staleTime: 60 * 1000,
  });

  const allEvents = useMemo(() => data?.events ?? [], [data]);

  // Counts of events in current visible range per category
  const counts = useMemo(() => {
    const c = { tasks: 0, requests: 0, leaves: 0, holidays: 0 };
    for (const evt of allEvents) {
      if (c[evt.colorKey] !== undefined) {
        c[evt.colorKey]++;
      }
    }
    return c;
  }, [allEvents]);

  // Active filtered events displayed on calendar
  const filteredEvents = useMemo(() => {
    return allEvents.filter((evt) => Boolean(toggles[evt.colorKey]));
  }, [allEvents, toggles]);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    setAnchorDate((prev) => {
      const next = new Date(prev);
      if (viewMode === "month") {
        next.setMonth(next.getMonth() - 1);
      } else if (viewMode === "week") {
        next.setDate(next.getDate() - 7);
      } else {
        next.setDate(next.getDate() - 1);
      }
      return next;
    });
  }, [viewMode]);

  const handleNext = useCallback(() => {
    setAnchorDate((prev) => {
      const next = new Date(prev);
      if (viewMode === "month") {
        next.setMonth(next.getMonth() + 1);
      } else if (viewMode === "week") {
        next.setDate(next.getDate() + 7);
      } else {
        next.setDate(next.getDate() + 1);
      }
      return next;
    });
  }, [viewMode]);

  const handleToday = useCallback(() => {
    setAnchorDate(new Date());
  }, []);

  const handleSelectDay = useCallback((date: Date) => {
    setAnchorDate(date);
    setViewMode("day");
  }, []);

  // Holiday actions
  const handleOpenAddHoliday = () => {
    setHolidayToEdit(null);
    setIsHolidayModalOpen(true);
  };

  const handleOpenEditHoliday = (event: CalendarEvent) => {
    setSelectedEvent(null);
    setHolidayToEdit(event);
    setIsHolidayModalOpen(true);
  };

  const handleOpenDeleteHoliday = (event: CalendarEvent) => {
    setSelectedEvent(null);
    setHolidayToDelete(event);
  };

  const handleConfirmDeleteHoliday = async () => {
    if (!holidayToDelete) return;
    try {
      await calendarApi.deleteHoliday(holidayToDelete.rawId);
      success(`Company holiday "${holidayToDelete.title}" has been removed.`, "Holiday Deleted");
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    } catch (err: any) {
      toastError(err.response?.data?.error || err.message || "Failed to delete holiday", "Delete Failed");
    } finally {
      setHolidayToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-primary-600" aria-hidden="true" />
            <span>Operations Calendar</span>
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Combined schedule of task deadlines, request target dates, approved leaves, and company holidays.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh calendar events"
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin text-primary-500" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Main View + Sidebar Grid */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* Sidebar Controls */}
        <CalendarSidebar
          toggles={toggles}
          onToggle={handleToggle}
          counts={counts}
          onOpenAddHolidayModal={role === "ADMIN" ? handleOpenAddHoliday : undefined}
        />

        {/* Calendar Workspace */}
        <div className="w-full flex-1 space-y-4 min-w-0">
          <CalendarHeader
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            anchorDate={anchorDate}
            onPrev={handlePrev}
            onNext={handleNext}
            onToday={handleToday}
          />

          {isLoading ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
              <LoadingSkeleton className="h-96 w-full" />
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/60 dark:bg-red-950/20">
              <AlertCircle className="mx-auto h-8 w-8 text-red-600 dark:text-red-400" />
              <h3 className="mt-2 text-sm font-semibold text-red-800 dark:text-red-300">
                Failed to load calendar events
              </h3>
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {(error as Error)?.message || "An unexpected error occurred while fetching events."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-4 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300"
              >
                Try Again
              </Button>
            </div>
          ) : (
            <>
              {viewMode === "month" && (
                <CalendarMonthView
                  anchorDate={anchorDate}
                  events={filteredEvents}
                  onSelectEvent={setSelectedEvent}
                  onSelectDay={handleSelectDay}
                />
              )}

              {viewMode === "week" && (
                <CalendarWeekView
                  anchorDate={anchorDate}
                  events={filteredEvents}
                  onSelectEvent={setSelectedEvent}
                  onSelectDay={handleSelectDay}
                />
              )}

              {viewMode === "day" && (
                <CalendarDayView
                  anchorDate={anchorDate}
                  events={filteredEvents}
                  onSelectEvent={setSelectedEvent}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Side Details Drawer */}
      <EventDetailDrawer
        event={selectedEvent}
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        onEditHoliday={handleOpenEditHoliday}
        onDeleteHoliday={handleOpenDeleteHoliday}
      />

      {/* Holiday Add / Edit Modal (Admin only) */}
      <HolidayModal
        isOpen={isHolidayModalOpen}
        onClose={() => {
          setIsHolidayModalOpen(false);
          setHolidayToEdit(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
        }}
        holidayToEdit={holidayToEdit}
      />

      {/* Confirm Delete Holiday Dialog */}
      <ConfirmDialog
        isOpen={Boolean(holidayToDelete)}
        title="Delete Company Holiday"
        description={`Are you sure you want to delete "${holidayToDelete?.title}"? This holiday observance will be removed for all users.`}
        confirmLabel="Delete Holiday"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleConfirmDeleteHoliday}
        onCancel={() => setHolidayToDelete(null)}
      />
    </div>
  );
};
