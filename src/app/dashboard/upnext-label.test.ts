/**
 * Tests for the Up Next day/date label logic on the dashboard.
 *
 * The labelling logic is inline in the server component so we extract
 * and mirror it here as a pure function to keep tests fast and isolated.
 */
import { describe, it, expect } from "vitest";
import { isoToDateKey, addDaysKey } from "@/lib/availability";

const TZ_MU = "Indian/Mauritius"; // UTC+4
const TZ_NY = "America/New_York";  // UTC-5 (or -4 in summer)

/**
 * Mirrors the inline IIFE in dashboard/page.tsx.
 * Returns the day label for a booking startTime relative to a given todayKey.
 */
function upNextDayLabel(
  startTimeIso: string,
  todayKey: string,
  tz: string,
): string {
  const bookingKey = isoToDateKey(startTimeIso, tz);
  const isToday = bookingKey === todayKey;
  const tomorrowKey = addDaysKey(todayKey, 1);
  const isTomorrow = bookingKey === tomorrowKey;

  if (isToday) return "Today";
  if (isTomorrow) return "Tomorrow";

  return new Intl.DateTimeFormat("en-MU", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz,
  }).format(new Date(startTimeIso));
}

describe("Up Next day label", () => {
  it("returns 'Today' for a booking that falls on todayKey in business TZ", () => {
    // 2026-09-16 at 09:00 Mauritius time = 2026-09-16T05:00:00Z
    const iso = "2026-09-16T05:00:00.000Z";
    const todayKey = "2026-09-16";
    expect(upNextDayLabel(iso, todayKey, TZ_MU)).toBe("Today");
  });

  it("returns 'Tomorrow' for a booking the day after todayKey", () => {
    // 2026-09-17 at 10:00 Mauritius = 2026-09-17T06:00:00Z
    const iso = "2026-09-17T06:00:00.000Z";
    const todayKey = "2026-09-16";
    expect(upNextDayLabel(iso, todayKey, TZ_MU)).toBe("Tomorrow");
  });

  it("returns a formatted date for a booking further in the future", () => {
    // 2026-09-25 (Friday) at 14:00 Mauritius = 2026-09-25T10:00:00Z
    const iso = "2026-09-25T10:00:00.000Z";
    const todayKey = "2026-09-16";
    const label = upNextDayLabel(iso, todayKey, TZ_MU);
    // Should contain the weekday and month — not Today or Tomorrow
    expect(label).not.toBe("Today");
    expect(label).not.toBe("Tomorrow");
    expect(label).toContain("25");
  });

  it("handles timezone boundary where UTC date differs from business-local date", () => {
    // 2026-09-16T23:00:00Z is already 2026-09-17 in Mauritius (UTC+4)
    // but still 2026-09-16 in UTC.
    const iso = "2026-09-16T23:00:00.000Z"; // 03:00 Mauritius on Sep 17
    const todayKeyMU = "2026-09-16"; // business today is Sep 16

    // In Mauritius TZ: the booking is Sep 17 → Tomorrow
    expect(upNextDayLabel(iso, todayKeyMU, TZ_MU)).toBe("Tomorrow");

    // Same instant, but a business in New York (UTC-4 in Sep):
    // 2026-09-16T23:00Z = 2026-09-16T19:00 New York → still Today for NY business
    const todayKeyNY = "2026-09-16";
    expect(upNextDayLabel(iso, todayKeyNY, TZ_NY)).toBe("Today");
  });

  it("returns 'Today' for a booking late in the same business day", () => {
    // 23:59 Mauritius on Sep 16 = 2026-09-16T19:59:00Z
    const iso = "2026-09-16T19:59:00.000Z";
    const todayKey = "2026-09-16";
    expect(upNextDayLabel(iso, todayKey, TZ_MU)).toBe("Today");
  });
});
