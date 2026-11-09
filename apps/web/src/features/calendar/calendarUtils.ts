import type { CalendarEvent } from "../../types/calendar";

export const KOLKATA_TIMEZONE = "Asia/Kolkata";

/**
 * Returns a YYYY-MM-DD date key in Asia/Kolkata timezone.
 * Used to ensure all-day events never shift by a day because of machine/browser timezones.
 */
export function getKolkataDateKey(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KOLKATA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Formats Month and Year (e.g. "November 2026") in Asia/Kolkata.
 */
export function formatKolkataMonthYear(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: KOLKATA_TIMEZONE,
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Formats a full date header (e.g. "Thursday, November 5, 2026") in Asia/Kolkata.
 */
export function formatKolkataFullDate(dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: KOLKATA_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/**
 * Formats short date (e.g. "5 Nov 2026") in Asia/Kolkata.
 */
export function formatKolkataShortDate(dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: KOLKATA_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Formats time (e.g. "03:30 PM") in Asia/Kolkata.
 */
export function formatKolkataTime(dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: KOLKATA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export interface MonthGridCell {
  date: Date;
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

/**
 * Generates grid cells for a full month (with Monday start) in Asia/Kolkata.
 */
export function getMonthDaysGrid(anchorDate: Date): MonthGridCell[] {
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();

  // First day of current month in UTC
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const todayKey = getKolkataDateKey(new Date());

  // Determine weekday in UTC (0 = Sun, 1 = Mon, ..., 6 = Sat)
  // We want Monday = 0, Tuesday = 1, ..., Sunday = 6
  const firstDayWeekday = (firstOfMonth.getUTCDay() + 6) % 7;

  // Total days in current month
  const lastOfMonth = new Date(Date.UTC(year, month + 1, 0));
  const totalDaysInMonth = lastOfMonth.getUTCDate();

  // Days from previous month
  const prevMonthLastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: MonthGridCell[] = [];

  // 1. Previous month trailing days
  for (let i = firstDayWeekday - 1; i >= 0; i--) {
    const prevDate = new Date(Date.UTC(year, month - 1, prevMonthLastDate - i, 12, 0, 0));
    const key = getKolkataDateKey(prevDate);
    cells.push({
      date: prevDate,
      dateKey: key,
      dayNumber: prevMonthLastDate - i,
      isCurrentMonth: false,
      isToday: key === todayKey,
    });
  }

  // 2. Current month days
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const curDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
    const key = getKolkataDateKey(curDate);
    cells.push({
      date: curDate,
      dateKey: key,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: key === todayKey,
    });
  }

  // 3. Next month leading days (fill up to complete 35 or 42 grid cells)
  const remainder = cells.length % 7;
  const daysToAdd = remainder === 0 ? 0 : 7 - remainder;
  for (let day = 1; day <= daysToAdd; day++) {
    const nextDate = new Date(Date.UTC(year, month + 1, day, 12, 0, 0));
    const key = getKolkataDateKey(nextDate);
    cells.push({
      date: nextDate,
      dateKey: key,
      dayNumber: day,
      isCurrentMonth: false,
      isToday: key === todayKey,
    });
  }

  return cells;
}

export interface WeekDayCell {
  date: Date;
  dateKey: string;
  dayNumber: number;
  dayName: string;
  isToday: boolean;
}

/**
 * Returns the 7 days of the week (Monday through Sunday) for an anchor date.
 */
export function getWeekDays(anchorDate: Date): WeekDayCell[] {
  const currentDayOfWeek = (anchorDate.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(anchorDate);
  monday.setUTCDate(anchorDate.getUTCDate() - currentDayOfWeek);
  monday.setUTCHours(12, 0, 0, 0);

  const todayKey = getKolkataDateKey(new Date());
  const days: WeekDayCell[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    const dateKey = getKolkataDateKey(d);
    const dayName = new Intl.DateTimeFormat("en-IN", {
      timeZone: KOLKATA_TIMEZONE,
      weekday: "short",
    }).format(d);

    days.push({
      date: d,
      dateKey,
      dayNumber: d.getUTCDate(),
      dayName,
      isToday: dateKey === todayKey,
    });
  }

  return days;
}

/**
 * Calculates the visible ISO start and end range for the current view and anchor date.
 */
export function getVisibleRange(
  viewMode: "month" | "week" | "day",
  anchorDate: Date
): { start: string; end: string } {
  if (viewMode === "month") {
    const grid = getMonthDaysGrid(anchorDate);
    const firstCell = grid[0];
    const lastCell = grid[grid.length - 1];
    return {
      start: `${firstCell.dateKey}T00:00:00.000Z`,
      end: `${lastCell.dateKey}T23:59:59.999Z`,
    };
  }

  if (viewMode === "week") {
    const week = getWeekDays(anchorDate);
    const firstDay = week[0];
    const lastDay = week[6];
    return {
      start: `${firstDay.dateKey}T00:00:00.000Z`,
      end: `${lastDay.dateKey}T23:59:59.999Z`,
    };
  }

  // Day view
  const dateKey = getKolkataDateKey(anchorDate);
  return {
    start: `${dateKey}T00:00:00.000Z`,
    end: `${dateKey}T23:59:59.999Z`,
  };
}

/**
 * Returns all date keys covered by an event (expanding multi-day approved leaves).
 */
export function getEventDateKeys(event: CalendarEvent): string[] {
  const startKey = getKolkataDateKey(event.start);
  const endKey = getKolkataDateKey(event.end);

  if (!event.allDay || startKey === endKey || !endKey) {
    return [startKey];
  }

  // Multi-day all-day event (e.g. Leave spanning across several days)
  const keys: string[] = [];
  const current = new Date(`${startKey}T12:00:00.000Z`);
  const end = new Date(`${endKey}T12:00:00.000Z`);

  while (current.getTime() <= end.getTime()) {
    keys.push(getKolkataDateKey(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return keys.length > 0 ? keys : [startKey];
}
