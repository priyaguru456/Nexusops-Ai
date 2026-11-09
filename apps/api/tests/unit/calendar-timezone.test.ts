import { describe, it, expect } from "vitest";

/**
 * Helper that formats a date string or Date object into a YYYY-MM-DD date key in Asia/Kolkata.
 */
export function getKolkataDateKey(dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

describe("Timezone Integrity: Asia/Kolkata All-Day Events", () => {
  it("ensures a holiday stored at UTC midnight never shifts to the previous day in Asia/Kolkata", () => {
    // 2026-11-08 00:00:00Z (Diwali in UTC)
    const holidayUtc = new Date("2026-11-08T00:00:00.000Z");
    
    // In Asia/Kolkata (+05:30), 00:00 UTC is 05:30 AM on Nov 8.
    const dateKey = getKolkataDateKey(holidayUtc);
    expect(dateKey).toBe("2026-11-08");
  });

  it("ensures a holiday stored at late UTC hours on the same calendar day doesn't roll over to the next day inappropriately", () => {
    // Stored at 18:00 UTC on 2026-11-07 -> in Asia/Kolkata is 23:30 on Nov 7
    const eveDate = new Date("2026-11-07T18:00:00.000Z");
    expect(getKolkataDateKey(eveDate)).toBe("2026-11-07");
  });

  it("ensures multi-day approved leaves accurately map their start and end dates without timezone drift", () => {
    // Leave from 2026-12-25 to 2026-12-27
    const startDate = new Date("2026-12-25T00:00:00.000Z");
    const endDate = new Date("2026-12-27T00:00:00.000Z");

    const startKey = getKolkataDateKey(startDate);
    const endKey = getKolkataDateKey(endDate);

    expect(startKey).toBe("2026-12-25");
    expect(endKey).toBe("2026-12-27");
  });

  it("consistently maps ISO date-only strings 'YYYY-MM-DD' without local browser skew", () => {
    const rawDateOnly = "2026-08-15";
    // Constructing with UTC boundary
    const utcDate = new Date(`${rawDateOnly}T00:00:00.000Z`);
    expect(getKolkataDateKey(utcDate)).toBe("2026-08-15");
  });
});
