import { describe, it, expect } from "vitest";
import {
  displayNameFromEmail,
  getDaypartInZone,
  greetingForDaypart,
} from "./greeting";

function dateAtHourTz(hour: number, timeZone: string): Date {
  // Noon UTC nudged so the wall-clock hour in `timeZone` is deterministic
  // for the zones under test (Mauritius is UTC+4, no DST).
  const base = new Date(Date.UTC(2026, 5, 15, 12, 0, 0));
  const offsetProbe = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    hour12: false,
    timeZone,
  }).formatToParts(base);
  const current = Number(offsetProbe.find((p) => p.type === "hour")?.value);
  return new Date(base.getTime() + ((hour - current) % 24) * 3600_000);
}

describe("greeting — daypart boundaries (Indian/Mauritius)", () => {
  const tz = "Indian/Mauritius";
  it("morning is 05:00–11:59", () => {
    expect(getDaypartInZone(tz, dateAtHourTz(5, tz))).toBe("morning");
    expect(getDaypartInZone(tz, dateAtHourTz(11, tz))).toBe("morning");
  });
  it("afternoon is 12:00–17:59", () => {
    expect(getDaypartInZone(tz, dateAtHourTz(12, tz))).toBe("afternoon");
    expect(getDaypartInZone(tz, dateAtHourTz(17, tz))).toBe("afternoon");
  });
  it("evening is 18:00–04:59", () => {
    expect(getDaypartInZone(tz, dateAtHourTz(18, tz))).toBe("evening");
    expect(getDaypartInZone(tz, dateAtHourTz(23, tz))).toBe("evening");
    expect(getDaypartInZone(tz, dateAtHourTz(4, tz))).toBe("evening");
  });
  it("maps dayparts to greeting copy", () => {
    expect(greetingForDaypart("morning")).toBe("Good morning");
    expect(greetingForDaypart("afternoon")).toBe("Good afternoon");
    expect(greetingForDaypart("evening")).toBe("Good evening");
  });
});

describe("greeting — display name from email", () => {
  it("derives a capitalized first name from dotted emails", () => {
    expect(displayNameFromEmail("panashe.tapfumaneyi@example.com")).toBe("Panashe");
  });
  it("handles underscores, hyphens and plus tags", () => {
    expect(displayNameFromEmail("jean_paul@example.com")).toBe("Jean");
    expect(displayNameFromEmail("marie-claire@example.com")).toBe("Marie");
    expect(displayNameFromEmail("alex+shop@example.com")).toBe("Alex");
  });
  it("returns null when no name exists — never invent one", () => {
    expect(displayNameFromEmail(null)).toBeNull();
    expect(displayNameFromEmail(undefined)).toBeNull();
    expect(displayNameFromEmail("")).toBeNull();
    expect(displayNameFromEmail("@example.com")).toBeNull();
  });
});
