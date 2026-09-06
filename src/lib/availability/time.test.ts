import { describe, it, expect } from "vitest";
import { getLocalDayInfo } from "./time";

// Indian/Mauritius is UTC+4 year-round (no DST). Local midnight therefore
// lands on the previous UTC day, which used to corrupt the weekday
// calculation (a local Monday resolved as UTC Sunday = "closed").
const TIMEZONE = "Indian/Mauritius";

describe("getLocalDayInfo weekdays in Indian/Mauritius", () => {
  it("maps Monday through Sunday to the local weekday", () => {
    // Week of 2026-09-07 (Monday) … 2026-09-13 (Sunday).
    const expectations: Record<string, number> = {
      "2026-09-07": 1, // Monday
      "2026-09-08": 2, // Tuesday
      "2026-09-09": 3, // Wednesday
      "2026-09-10": 4, // Thursday
      "2026-09-11": 5, // Friday
      "2026-09-12": 6, // Saturday
      "2026-09-13": 0, // Sunday
    };
    for (const [date, dayOfWeek] of Object.entries(expectations)) {
      expect(getLocalDayInfo(date, TIMEZONE).dayOfWeek, date).toBe(dayOfWeek);
    }
  });

  it("keeps the morning shop day open for a local Monday (regression)", () => {
    // The off-by-one bug resolved local Monday 2026-09-07 as UTC Sunday.
    expect(getLocalDayInfo("2026-09-07", TIMEZONE).dayOfWeek).toBe(1);
  });

  it("right-shifts the week for Sunday as the bookable-week boundary", () => {
    expect(getLocalDayInfo("2026-09-06", TIMEZONE).dayOfWeek).toBe(0); // Sunday
    expect(getLocalDayInfo("2026-09-14", TIMEZONE).dayOfWeek).toBe(1); // Monday
  });
});

describe("day boundary crossing UTC midnight", () => {
  it("resolves the local day start to the previous UTC date (summer)", () => {
    // Local Monday 2026-09-07 00:00 +04:00 == 2026-09-06T20:00Z.
    const info = getLocalDayInfo("2026-09-07", TIMEZONE);
    expect(info.dayStartUtc).toBe("2026-09-06T20:00:00.000Z");
    expect(info.dayOfWeek).toBe(1); // Monday, not the Sunday of the UTC instant
  });

  it("resolves the local day start across the year boundary", () => {
    // Local Thursday 2026-01-01 00:00 +04:00 == 2025-12-31T20:00Z.
    const info = getLocalDayInfo("2026-01-01", TIMEZONE);
    expect(info.dayStartUtc).toBe("2025-12-31T20:00:00.000Z");
    expect(info.dayOfWeek).toBe(4); // Thursday
  });

  it("keeps the weekday stable at a same-day UTC instant (east-zone)", () => {
    // Local Sunday 2026-09-13 00:00 +04:00 == 2026-09-12T20:00Z (a UTC Saturday).
    const info = getLocalDayInfo("2026-09-13", TIMEZONE);
    expect(info.dayStartUtc).toBe("2026-09-12T20:00:00.000Z");
    expect(info.dayOfWeek).toBe(0); // Sunday, not Saturday
  });
});

describe("business timezone stays authoritative (west-of-UTC zone)", () => {
  it("resolves America/Los_Angeles boundaries without server timezone", () => {
    const info = getLocalDayInfo("2026-09-07", "America/Los_Angeles");
    expect(info.dayStartUtc).toBe("2026-09-07T07:00:00.000Z");
    expect(info.dayOfWeek).toBe(1); // Monday
  });
});