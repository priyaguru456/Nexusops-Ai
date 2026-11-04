import { describe, it, expect } from "vitest";
import {
  getKolkataDateString,
  getDueDateBadge,
  parseChecklist,
  matchesDueDateFilter,
} from "./taskUtils";
import type { TaskItem } from "../../types/tasks";

describe("taskUtils - Asia/Kolkata Due Date & Badge Logic", () => {
  // Fixed simulated current time in Asia/Kolkata: Nov 3, 2026, 15:08:29 IST
  const mockNow = new Date("2026-11-03T15:08:29+05:30");

  it("formats dates correctly in Asia/Kolkata timezone", () => {
    // 2026-11-03 20:00:00 UTC is 2026-11-04 01:30:00 IST (+5:30)
    expect(getKolkataDateString(new Date("2026-11-03T20:00:00Z"))).toBe("2026-11-04");
    // 2026-11-03 04:00:00 UTC is 2026-11-03 09:30:00 IST
    expect(getKolkataDateString(new Date("2026-11-03T04:00:00Z"))).toBe("2026-11-03");
    expect(getKolkataDateString(null)).toBe("");
  });

  it("computes 'Overdue by X days' (soft red) for past due dates", () => {
    // 1 day overdue
    const badgeYesterday = getDueDateBadge("2026-11-02T10:00:00Z", "TODO", mockNow);
    expect(badgeYesterday).not.toBeNull();
    expect(badgeYesterday?.type).toBe("overdue");
    expect(badgeYesterday?.text).toBe("Overdue by 1 day");
    expect(badgeYesterday?.className).toContain("text-rose-700");

    // 4 days overdue
    const badge4Days = getDueDateBadge("2026-10-30T10:00:00Z", "IN_PROGRESS", mockNow);
    expect(badge4Days).not.toBeNull();
    expect(badge4Days?.type).toBe("overdue");
    expect(badge4Days?.text).toBe("Overdue by 4 days");
    expect(badge4Days?.className).toContain("text-rose-700");
  });

  it("computes 'Due today' (amber) for tasks due today in Asia/Kolkata", () => {
    const badgeToday = getDueDateBadge("2026-11-03T18:00:00+05:30", "TODO", mockNow);
    expect(badgeToday).not.toBeNull();
    expect(badgeToday?.type).toBe("today");
    expect(badgeToday?.text).toBe("Due today");
    expect(badgeToday?.className).toContain("text-amber-700");
  });

  it("computes 'Due in X days' (slate) only within next 7 days", () => {
    // 1 day ahead (Nov 4)
    const badge1 = getDueDateBadge("2026-11-04T12:00:00+05:30", "TODO", mockNow);
    expect(badge1).not.toBeNull();
    expect(badge1?.type).toBe("upcoming");
    expect(badge1?.text).toBe("Due in 1 day");
    expect(badge1?.className).toContain("text-slate-700");

    // 7 days ahead (Nov 10)
    const badge7 = getDueDateBadge("2026-11-10T12:00:00+05:30", "TODO", mockNow);
    expect(badge7).not.toBeNull();
    expect(badge7?.type).toBe("upcoming");
    expect(badge7?.text).toBe("Due in 7 days");
    expect(badge7?.className).toContain("text-slate-700");

    // 8 days ahead (Nov 11) -> should be hidden
    const badge8 = getDueDateBadge("2026-11-11T12:00:00+05:30", "TODO", mockNow);
    expect(badge8).toBeNull();
  });

  it("hides due-date badge if status is DONE", () => {
    // Overdue but DONE
    expect(getDueDateBadge("2026-10-25T10:00:00Z", "DONE", mockNow)).toBeNull();
    // Due today but DONE
    expect(getDueDateBadge("2026-11-03T10:00:00+05:30", "DONE", mockNow)).toBeNull();
    // Upcoming but DONE
    expect(getDueDateBadge("2026-11-05T10:00:00+05:30", "DONE", mockNow)).toBeNull();
  });

  it("hides due-date badge if dueDate is missing", () => {
    expect(getDueDateBadge(null, "TODO", mockNow)).toBeNull();
    expect(getDueDateBadge(undefined, "TODO", mockNow)).toBeNull();
  });
});

describe("taskUtils - Markdown Checklist Parser", () => {
  it("correctly parses standard markdown checklist items", () => {
    const description = `
# Task Details
Here are the steps to finish:
- [ ] Set up server
- [x] Configure database
- [X] Seed demo data
* [ ] Write automated tests
* [x] Verify API responses
1. [ ] Deploy to staging
2. [x] Run smoke tests
    `;

    const result = parseChecklist(description);
    expect(result).not.toBeNull();
    expect(result?.total).toBe(7);
    expect(result?.completed).toBe(4);
    expect(result?.percent).toBe(57); // 4/7 * 100 = 57.14 -> 57%
  });

  it("handles 100% completed checklists", () => {
    const description = "- [x] Done 1\n- [x] Done 2";
    const result = parseChecklist(description);
    expect(result).toEqual({ total: 2, completed: 2, percent: 100 });
  });

  it("returns null when there are no checklist items", () => {
    expect(parseChecklist("Just regular notes without checkboxes.")).toBeNull();
    expect(parseChecklist(null)).toBeNull();
    expect(parseChecklist("")).toBeNull();
    expect(parseChecklist("   ")).toBeNull();
  });
});

describe("taskUtils - Due Date Filters (Asia/Kolkata)", () => {
  const mockNow = new Date("2026-11-03T15:08:29+05:30"); // Tuesday Nov 3

  const baseTask: TaskItem = {
    id: "task-1",
    title: "Test Task",
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    dueDate: null,
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    requestId: null,
    assigneeId: "user-1",
    assignedById: null,
  };

  it("matches 'overdue' filter only when status is not DONE and date is past", () => {
    const overdueTask: TaskItem = { ...baseTask, dueDate: "2026-11-01T10:00:00Z" };
    expect(matchesDueDateFilter(overdueTask, "overdue", mockNow)).toBe(true);

    const doneTask: TaskItem = { ...overdueTask, status: "DONE" };
    expect(matchesDueDateFilter(doneTask, "overdue", mockNow)).toBe(false);

    const todayTask: TaskItem = { ...baseTask, dueDate: "2026-11-03T10:00:00+05:30" };
    expect(matchesDueDateFilter(todayTask, "overdue", mockNow)).toBe(false);
  });

  it("matches 'today' filter for tasks due today", () => {
    const todayTask: TaskItem = { ...baseTask, dueDate: "2026-11-03T10:00:00+05:30" };
    expect(matchesDueDateFilter(todayTask, "today", mockNow)).toBe(true);

    const tomorrowTask: TaskItem = { ...baseTask, dueDate: "2026-11-04T10:00:00+05:30" };
    expect(matchesDueDateFilter(tomorrowTask, "today", mockNow)).toBe(false);
  });

  it("matches 'thisWeek' filter for Monday-to-Sunday range in Asia/Kolkata", () => {
    // Current week: Mon Nov 2 to Sun Nov 8
    const mondayTask: TaskItem = { ...baseTask, dueDate: "2026-11-02T10:00:00+05:30" };
    expect(matchesDueDateFilter(mondayTask, "thisWeek", mockNow)).toBe(true);

    const sundayTask: TaskItem = { ...baseTask, dueDate: "2026-11-08T22:00:00+05:30" };
    expect(matchesDueDateFilter(sundayTask, "thisWeek", mockNow)).toBe(true);

    const nextWeekTask: TaskItem = { ...baseTask, dueDate: "2026-11-09T10:00:00+05:30" };
    expect(matchesDueDateFilter(nextWeekTask, "thisWeek", mockNow)).toBe(false);

    const prevWeekTask: TaskItem = { ...baseTask, dueDate: "2026-11-01T10:00:00+05:30" };
    expect(matchesDueDateFilter(prevWeekTask, "thisWeek", mockNow)).toBe(false);
  });
});
