import { LEAVE_CONFIG } from "./leave.config";

/**
 * Normalizes a date or date-string to UTC midnight (00:00:00.000Z).
 */
export function normalizeDateToUTC(input: Date | string): Date {
  const d = typeof input === "string" ? new Date(input) : new Date(input.getTime());
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Formats a Date object to YYYY-MM-DD in UTC.
 */
export function formatDateKeyUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Checks whether a given UTC Date is a weekend (Saturday or Sunday).
 */
export function isWeekendUTC(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Calculates working days between startDate and endDate (inclusive),
 * excluding weekends (Saturday/Sunday) and any holiday dates provided in the set.
 */
export function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  holidayDateKeys: Set<string> = new Set()
): number {
  const start = normalizeDateToUTC(startDate);
  const end = normalizeDateToUTC(endDate);

  if (start.getTime() > end.getTime()) {
    return 0;
  }

  let count = 0;
  const current = new Date(start.getTime());

  while (current.getTime() <= end.getTime()) {
    if (!isWeekendUTC(current)) {
      const key = formatDateKeyUTC(current);
      if (!holidayDateKeys.has(key)) {
        count++;
      }
    }
    // Advance by 1 calendar day
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return count;
}

/**
 * Checks if two date ranges overlap (both ranges inclusive).
 */
export function datesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  const normStartA = normalizeDateToUTC(startA).getTime();
  const normEndA = normalizeDateToUTC(endA).getTime();
  const normStartB = normalizeDateToUTC(startB).getTime();
  const normEndB = normalizeDateToUTC(endB).getTime();

  return normStartA <= normEndB && normEndA >= normStartB;
}

/**
 * Checks if a start date is within the allowed past-dated grace period.
 * (e.g. within the last N days before today)
 */
export function isWithinPastGracePeriod(
  startDate: Date,
  graceDays: number = LEAVE_CONFIG.PAST_LEAVE_GRACE_DAYS,
  now: Date = new Date()
): boolean {
  const start = normalizeDateToUTC(startDate);
  const today = normalizeDateToUTC(now);

  if (start.getTime() >= today.getTime()) {
    return true; // Future or today is always fine
  }

  const diffMs = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays <= graceDays;
}
