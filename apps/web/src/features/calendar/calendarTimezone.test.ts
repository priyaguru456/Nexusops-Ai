import { describe, it, expect } from "vitest";
import {
  getKolkataDateKey,
  getEventDateKeys,
  getVisibleRange,
  getMonthDaysGrid,
  getWeekDays,
} from "./calendarUtils";
import type { CalendarEvent } from "../../types/calendar";

describe("Calendar Timezone and All-Day Event Integrity (Asia/Kolkata)", () => {
  it("formats dates into YYYY-MM-DD in Asia/Kolkata timezone without date shift", () => {
    // 2026-11-08 00:00:00 UTC -> in Asia/Kolkata (UTC+5:30) is 2026-11-08 05:30:00 AM (same day)
    const diwaliDate = new Date("2026-11-08T00:00:00.000Z");
    expect(getKolkataDateKey(diwaliDate)).toBe("2026-11-08");

    // 2026-11-08 18:00:00 UTC -> in Asia/Kolkata is 2026-11-08 11:30:00 PM (same day)
    const lateHourDate = new Date("2026-11-08T18:00:00.000Z");
    expect(getKolkataDateKey(lateHourDate)).toBe("2026-11-08");
  });

  it("handles empty or invalid date gracefully", () => {
    expect(getKolkataDateKey(null)).toBe("");
    expect(getKolkataDateKey(undefined)).toBe("");
    expect(getKolkataDateKey("invalid-date-string")).toBe("");
  });

  it("expands multi-day approved leaves across all intervening days in Asia/Kolkata", () => {
    const leaveEvent: CalendarEvent = {
      id: "leave-101",
      rawId: "101",
      title: "Ravi Kumar - Casual Leave (3d)",
      type: "LEAVE",
      start: "2026-11-10T00:00:00.000Z",
      end: "2026-11-12T00:00:00.000Z",
      allDay: true,
      colorKey: "leaves",
      details: {
        link: "/approvals",
        leaveType: "CASUAL",
        daysCount: 3,
      },
    };

    const keys = getEventDateKeys(leaveEvent);
    expect(keys).toEqual(["2026-11-10", "2026-11-11", "2026-11-12"]);
  });

  it("does not shift single-day holidays across day boundaries", () => {
    const holidayEvent: CalendarEvent = {
      id: "holiday-202",
      rawId: "202",
      title: "Gandhi Jayanti",
      type: "HOLIDAY",
      start: "2026-10-02T00:00:00.000Z",
      end: "2026-10-02T00:00:00.000Z",
      allDay: true,
      colorKey: "holidays",
      details: {
        link: "/calendar",
      },
    };

    const keys = getEventDateKeys(holidayEvent);
    expect(keys).toEqual(["2026-10-02"]);
  });

  it("generates correct visible range for Month view", () => {
    const anchorDate = new Date(Date.UTC(2026, 10, 15)); // Nov 2026
    const range = getVisibleRange("month", anchorDate);

    // Range must start at 00:00:00 and end at 23:59:59
    expect(range.start).toMatch(/T00:00:00\.000Z$/);
    expect(range.end).toMatch(/T23:59:59\.999Z$/);

    // Grid cells should be multiple of 7
    const grid = getMonthDaysGrid(anchorDate);
    expect(grid.length % 7).toBe(0);
    expect(grid.length).toBeGreaterThanOrEqual(28);
  });

  it("generates 7 consecutive days for Week view starting on Monday", () => {
    const anchorDate = new Date(Date.UTC(2026, 10, 5, 12, 0, 0)); // Nov 5, 2026 (Thursday)
    const week = getWeekDays(anchorDate);

    expect(week).toHaveLength(7);
    expect(week[0].dayName).toBe("Mon");
    expect(week[3].dayName).toBe("Thu");
    expect(week[6].dayName).toBe("Sun");
  });
});
