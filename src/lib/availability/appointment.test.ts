import { describe, it, expect } from "vitest";
import { getSlotsForDay, getOpeningRange, isDateKeyAvailable } from "@/lib/availability";
import { getLocalDayInfo } from "@/lib/availability";

// 2026-09-15: still an open weekday (Tuesday) after the fix; keeps the
// existing busy-block tests (which never depended on the weekday bug).
const TIMEZONE = "Indian/Mauritius";
const HOUR = { durationMinutes: 60 };

const localInUtc = (hours: number, minutes = 0) => {
  const utc = new Date(Date.UTC(2026, 8, 15, hours - 4, minutes));
  return utc.toISOString();
};

describe("appointment slot grid + calendar busy blocks", () => {
  it("a calendar busy event removes the overlapping appointment slot", () => {
    const slots = getSlotsForDay(
      "2026-09-15",
      HOUR,
      [{ startTime: localInUtc(13), endTime: localInUtc(14) }],
      TIMEZONE,
    );
    const labels = slots.map((s) => s.label);
    expect(labels).not.toContain("13:00");
    expect(labels).not.toContain("12:30"); // overlaps the busy hour too
    expect(labels).toContain("11:00");
    expect(labels).toContain("17:00"); // last non-overlapping slot
  });

  it("a non-overlapping calendar event leaves the slot untouched", () => {
    const slots = getSlotsForDay(
      "2026-09-15",
      HOUR,
      [{ startTime: localInUtc(6), endTime: localInUtc(6, 30) }], // before opening
      TIMEZONE,
    );
    expect(slots.map((s) => s.label)).toContain("13:00");
  });

  it("slot availability is unchanged when no calendar blocks exist", () => {
    const baseline = getSlotsForDay("2026-09-15", HOUR, [], TIMEZONE);
    expect(baseline).toHaveLength(17); // 09:00 → 17:00 on the 30-min grid
  });
});

describe("weekday business hours (getOpeningRange / getLocalDayInfo)", () => {
  it("Monday through Friday are open 09:00–18:00 (17 slots for 60-min service)", () => {
    const openDates = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11"];
    for (const d of openDates) {
      const range = getOpeningRange(getLocalDayInfo(d, TIMEZONE).dayOfWeek);
      expect(range).toEqual({ startMinutes: 9 * 60, endMinutes: 18 * 60 });
      expect(getSlotsForDay(d, HOUR, [], TIMEZONE)).toHaveLength(17);
    }
  });

  it("Saturday is open 09:00–16:00 (13 slots for 60-min service on 30-min grid)", () => {
    const range = getOpeningRange(getLocalDayInfo("2026-09-12", TIMEZONE).dayOfWeek);
    expect(range).toEqual({ startMinutes: 9 * 60, endMinutes: 16 * 60 });
    expect(getSlotsForDay("2026-09-12", HOUR, [], TIMEZONE)).toHaveLength(13);
  });

  it("Sunday is closed (0 slots)", () => {
    const range = getOpeningRange(getLocalDayInfo("2026-09-13", TIMEZONE).dayOfWeek);
    expect(range).toEqual({ startMinutes: null, endMinutes: null });
    expect(getSlotsForDay("2026-09-13", HOUR, [], TIMEZONE)).toHaveLength(0);
  });
});

describe("appointment availability regression (weekday-aware slot timing)", () => {
  it("Monday 2026-09-07 returns open slots (regression: previously closed)", () => {
    const slots = getSlotsForDay("2026-09-07", HOUR, [], TIMEZONE);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].startTime).toBe("2026-09-07T05:00:00.000Z"); // 09:00 local
    expect(slots[0].label).toBe("09:00");
  });

  it("first slot of the day lands at local 09:00 across a year boundary (east-zone)", () => {
    // 2026-01-01 is a Thursday (open) — local midnight crosses into 2025-12-31 UTC.
    const slots = getSlotsForDay("2026-01-01", HOUR, [], TIMEZONE);
    expect(getLocalDayInfo("2026-01-01", TIMEZONE).dayOfWeek).toBe(4); // Thursday
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].startTime).toBe("2026-01-01T05:00:00.000Z"); // 09:00 local
    expect(slots[0].label).toBe("09:00");
  });

  it("isDateKeyAvailable uses the corrected weekday (Monday open, Sunday closed)", () => {
    // Compute a future Monday and the following Sunday so the test never goes stale.
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun … 6=Sat
    const daysToMonday = dayOfWeek <= 1 ? 1 - dayOfWeek + 7 : 1 - dayOfWeek + 7;
    const futureMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToMonday));
    const futureSunday = new Date(futureMonday.getTime() + 6 * 86400000);
    const mondayKey = futureMonday.toISOString().slice(0, 10);
    const sundayKey = futureSunday.toISOString().slice(0, 10);

    expect(isDateKeyAvailable(mondayKey, TIMEZONE)).toBe(true);   // Monday — open
    expect(isDateKeyAvailable(sundayKey, TIMEZONE)).toBe(false);  // Sunday — closed
    expect(getSlotsForDay(sundayKey, HOUR, [], TIMEZONE)).toHaveLength(0);
  });
});