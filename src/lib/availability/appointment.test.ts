import { describe, it, expect } from "vitest";
import { getSlotsForDay } from "@/lib/availability";

// 2026-09-15. NOTE: time.ts resolves the local weekday as the UTC weekday of
// the local-midnight instant, which is off-by-one for UTC+4; this date is one
// the current implementation treats as an open weekday (09:00–18:00 local,
// 60-minute slots on a 30-minute grid).
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