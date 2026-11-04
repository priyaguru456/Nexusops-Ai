import type { TaskItem, TaskStatus } from "../../types/tasks";
import type { Priority } from "../../types/requests";

/**
 * Formats a Date or ISO string into a YYYY-MM-DD date string in the Asia/Kolkata timezone.
 */
export function getKolkataDateString(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Parses a YYYY-MM-DD date string into UTC midnight timestamp.
 */
export function parseKolkataDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return new Date(NaN);
  }
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

/**
 * Formats an ISO date string for display in Asia/Kolkata locale.
 */
export function formatKolkataDisplayDate(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "numeric",
    ...options,
  }).format(d);
}

export interface DueDateBadgeInfo {
  type: "overdue" | "today" | "upcoming";
  text: string;
  diffDays: number;
  className: string;
}

/**
 * Calculates due date badge information strictly in Asia/Kolkata timezone.
 * Returns null if:
 * - Status is DONE
 * - No dueDate is present
 * - Due date is more than 7 days in the future
 */
export function getDueDateBadge(
  dueDate: string | null | undefined,
  status: TaskStatus | string,
  now: Date = new Date()
): DueDateBadgeInfo | null {
  if (!dueDate || status === "DONE") {
    return null;
  }

  const dueStr = getKolkataDateString(dueDate);
  if (!dueStr) return null;

  const todayStr = getKolkataDateString(now);
  const dueUtc = parseKolkataDate(dueStr).getTime();
  const todayUtc = parseKolkataDate(todayStr).getTime();

  if (isNaN(dueUtc) || isNaN(todayUtc)) return null;

  const diffDays = Math.round((dueUtc - todayUtc) / 86400000);

  // Overdue: past due in Asia/Kolkata
  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      type: "overdue",
      diffDays,
      text: overdueDays === 1 ? "Overdue by 1 day" : `Overdue by ${overdueDays} days`,
      className:
        "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/60",
    };
  }

  // Due today in Asia/Kolkata
  if (diffDays === 0) {
    return {
      type: "today",
      diffDays,
      text: "Due today",
      className:
        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900/60",
    };
  }

  // Due in X days (only within the next 7 days: 1 to 7 days)
  if (diffDays >= 1 && diffDays <= 7) {
    return {
      type: "upcoming",
      diffDays,
      text: diffDays === 1 ? "Due in 1 day" : `Due in ${diffDays} days`,
      className:
        "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    };
  }

  // More than 7 days ahead
  return null;
}

export interface ChecklistInfo {
  total: number;
  completed: number;
  percent: number;
}

/**
 * Parses markdown checklists in description:
 * Supports `- [ ]`, `- [x]`, `- [X]`, `* [ ]`, `* [x]`, `1. [ ]`, `1. [x]`
 * Returns null if no checklist items found.
 */
export function parseChecklist(description: string | null | undefined): ChecklistInfo | null {
  if (!description || !description.trim()) return null;

  const lines = description.split(/\r?\n/);
  const checklistRegex = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]/;

  let total = 0;
  let completed = 0;

  for (const line of lines) {
    const match = line.match(checklistRegex);
    if (match) {
      total++;
      if (match[1].toLowerCase() === "x") {
        completed++;
      }
    }
  }

  if (total === 0) return null;

  const percent = Math.round((completed / total) * 100);
  return { total, completed, percent };
}

/**
 * Checks if a task's due date falls in the current calendar week (Monday to Sunday) in Asia/Kolkata.
 */
export function isThisWeekKolkata(dateStrOrDate: string | Date, now: Date = new Date()): boolean {
  const targetStr = getKolkataDateString(dateStrOrDate);
  if (!targetStr) return false;

  const todayStr = getKolkataDateString(now);
  const todayDate = parseKolkataDate(todayStr);
  const dayOfWeek = todayDate.getUTCDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday

  // Calculate Monday (start of week) and Sunday (end of week)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mondayDate = new Date(todayDate.getTime() + diffToMonday * 86400000);
  const sundayDate = new Date(mondayDate.getTime() + 6 * 86400000);

  const mondayStr = getKolkataDateString(mondayDate);
  const sundayStr = getKolkataDateString(sundayDate);

  return targetStr >= mondayStr && targetStr <= sundayStr;
}

export type DueDateQuickFilter = "overdue" | "today" | "thisWeek" | "";

/**
 * Checks if a task matches the selected due date quick filter in Asia/Kolkata.
 */
export function matchesDueDateFilter(
  task: TaskItem,
  filter: DueDateQuickFilter,
  now: Date = new Date()
): boolean {
  if (!filter) return true;
  if (!task.dueDate) return false;

  const dueStr = getKolkataDateString(task.dueDate);
  if (!dueStr) return false;

  const todayStr = getKolkataDateString(now);
  const dueUtc = parseKolkataDate(dueStr).getTime();
  const todayUtc = parseKolkataDate(todayStr).getTime();
  const diffDays = Math.round((dueUtc - todayUtc) / 86400000);

  switch (filter) {
    case "overdue":
      return task.status !== "DONE" && diffDays < 0;
    case "today":
      return diffDays === 0;
    case "thisWeek":
      return isThisWeekKolkata(task.dueDate, now);
    default:
      return true;
  }
}

/**
 * Priority visual indicators:
 * URGENT: rose
 * HIGH: amber
 * MEDIUM: blue
 * LOW: slate
 */
export const PRIORITY_BORDER_MAP: Record<Priority, string> = {
  URGENT: "border-l-4 border-l-rose-500 dark:border-l-rose-400",
  HIGH: "border-l-4 border-l-amber-500 dark:border-l-amber-400",
  MEDIUM: "border-l-4 border-l-blue-500 dark:border-l-blue-400",
  LOW: "border-l-4 border-l-slate-400 dark:border-l-slate-500",
};

export const PRIORITY_DOT_MAP: Record<Priority, string> = {
  URGENT: "bg-rose-500",
  HIGH: "bg-amber-500",
  MEDIUM: "bg-blue-500",
  LOW: "bg-slate-400",
};
