/**
 * Per-business opening hours tests (Phase 6A).
 *
 * Proves validation strictness plus engine overrides: custom hours reshape
 * the slot grid and the date picker, invalid documents fall back to platform
 * defaults, and null (unset) behaves exactly like the legacy constants.
 */
import { describe, it, expect } from "vitest";
import {
  parseBusinessHours,
  dayWindowMinutes,
  InvalidHoursError,
  type BusinessHours,
} from "./hours";
import {
  getOpeningRange,
  getSlotsForDay,
  isDateKeyAvailable,
} from "./appointment";

const TZ = "Indian/Mauritius";

/**
 * Next upcoming Monday/Sunday (business-local), always inside the 30-day
 * booking window so `isDateKeyAvailable` horizon checks stay stable.
 */
function nextWeekday(weekday: number): string {
  for (let offset = 1; offset <= 40; offset++) {
    const probe = new Date(Date.now() + offset * 86_400_000);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(probe);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const y = get("year");
    const m = get("month");
    const d = get("day");
    if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === weekday) {
      return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  throw new Error("no matching weekday within 40 days");
}
// The next Monday and the next Sunday.
const MONDAY = nextWeekday(1);
const SUNDAY = nextWeekday(0);
const HOUR = { durationMinutes: 60 };

const CUSTOM_MON_10_12: BusinessHours = {
  mon: { open: "10:00", close: "12:00" },
};

describe("parseBusinessHours", () => {
  it("accepts a full week and normalizes missing days to closed", () => {
    const hours = parseBusinessHours({
      mon: { open: "09:00", close: "18:00" },
      tue: { open: "09:00", close: "18:00" },
      wed: null,
    });
    expect(hours?.mon).toEqual({ open: "09:00", close: "18:00" });
    expect(hours?.wed).toBeNull();
    expect(hours?.sun).toBeNull();
  });

  it("rejects inverted, malformed, and non-object input", () => {
    for (const bad of [
      { mon: { open: "18:00", close: "09:00" } },
      { mon: { open: "9am", close: "17:00" } },
      { mon: { open: "09:00", close: "25:00" } },
      { mon: "09:00-18:00" },
      "09:00-18:00",
      42,
    ]) {
      expect(() => parseBusinessHours(bad)).toThrow(InvalidHoursError);
    }
  });
});

describe("engine overrides", () => {
  it("custom hours reshape the slot grid", () => {
    const custom = getSlotsForDay(MONDAY, HOUR, [], TZ, 30, CUSTOM_MON_10_12);
    // 10:00, 10:30, 11:00 for a 60-minute service inside 10:00–12:00.
    expect(custom.map((s) => s.label)).toEqual(["10:00", "10:30", "11:00"]);
    const baseline = getSlotsForDay(MONDAY, HOUR, [], TZ);
    expect(baseline.length).toBeGreaterThan(custom.length);
  });

  it("null hours behave exactly like the platform defaults", () => {
    expect(getSlotsForDay(MONDAY, HOUR, [], TZ, 30, null)).toEqual(
      getSlotsForDay(MONDAY, HOUR, [], TZ),
    );
    expect(isDateKeyAvailable(SUNDAY, TZ, null)).toBe(
      isDateKeyAvailable(SUNDAY, TZ),
    );
  });

  it("a custom-open Sunday yields slots; a custom-closed Monday yields none", () => {
    const sundayOpen: BusinessHours = { sun: { open: "10:00", close: "14:00" } };
    expect(getSlotsForDay(SUNDAY, HOUR, [], TZ, 30, sundayOpen).length).toBeGreaterThan(0);
    expect(isDateKeyAvailable(SUNDAY, TZ, sundayOpen)).toBe(true);

    const mondayClosed: BusinessHours = { mon: null };
    expect(getSlotsForDay(MONDAY, HOUR, [], TZ, 30, mondayClosed)).toEqual([]);
    expect(isDateKeyAvailable(MONDAY, TZ, mondayClosed)).toBe(false);
  });

  it("invalid stored documents fall back to defaults instead of crashing", () => {
    const garbage = { mon: { open: "xx", close: "yy" } } as unknown as BusinessHours;
    expect(getOpeningRange(1, garbage)).toEqual(getOpeningRange(1));
    expect(getSlotsForDay(MONDAY, HOUR, [], TZ, 30, garbage)).toEqual(
      getSlotsForDay(MONDAY, HOUR, [], TZ),
    );
  });

  it("dayWindowMinutes reports closed days and defers on missing docs", () => {
    expect(dayWindowMinutes(null, 1)).toBeNull();
    expect(dayWindowMinutes({ mon: null }, 1)).toEqual({
      startMinutes: null,
      endMinutes: null,
    });
    expect(dayWindowMinutes(CUSTOM_MON_10_12, 1)).toEqual({
      startMinutes: 600,
      endMinutes: 720,
    });
  });
});
