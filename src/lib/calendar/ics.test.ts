import { describe, it, expect } from "vitest";
import { generateIcs, generateIcsDownloadHeaders } from "./ics";
import type { CalendarEvent } from "./types";

const BASE_EVENT: CalendarEvent = {
  businessName: "Fade Area",
  serviceName: "Haircut",
  startTime: "2026-09-15T10:30:00+04:00",
  endTime: "2026-09-15T11:15:00+04:00",
  timezone: "Indian/Mauritius",
  manageUrl: "https://app.kivo.mu/manage/abc123",
};

describe("generateIcs", () => {
  it("produces valid VCALENDAR wrapper", () => {
    const ics = generateIcs(BASE_EVENT);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Kivo//Booking//EN");
  });

  it("includes VEVENT with correct summary", () => {
    const ics = generateIcs(BASE_EVENT);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("SUMMARY:Fade Area - Haircut");
  });

  it("includes DTSTART and DTEND with TZID", () => {
    const ics = generateIcs(BASE_EVENT);
    expect(ics).toContain("DTSTART;TZID=Indian/Mauritius:");
    expect(ics).toContain("DTEND;TZID=Indian/Mauritius:");
  });

  it("includes manage URL in description", () => {
    const ics = generateIcs(BASE_EVENT);
    expect(ics).toContain("https://app.kivo.mu/manage/abc123");
  });

  it("includes location when present", () => {
    const event = { ...BASE_EVENT, location: "Royal Road, Quatre Bornes" };
    const ics = generateIcs(event);
    expect(ics).toContain("LOCATION:Royal Road\\, Quatre Bornes");
  });

  it("generates deterministic UID", () => {
    const ics1 = generateIcs(BASE_EVENT);
    const ics2 = generateIcs(BASE_EVENT);
    const uid1 = ics1.match(/UID:(.+)/)?.[1];
    const uid2 = ics2.match(/UID:(.+)/)?.[1];
    expect(uid1).toBeDefined();
    expect(uid1).toBe(uid2);
  });

  it("handles special characters in names", () => {
    const event = { ...BASE_EVENT, businessName: "L'Escape & Co", serviceName: "Kids' Class" };
    const ics = generateIcs(event);
    expect(ics).toContain("L'Escape & Co");
    expect(ics).toContain("Kids' Class");
  });
});

describe("generateIcsDownloadHeaders", () => {
  it("returns correct filename and content type", () => {
    const result = generateIcsDownloadHeaders(BASE_EVENT);
    expect(result.filename).toBe("booking.ics");
    expect(result.contentType).toContain("text/calendar");
    expect(result.content).toContain("BEGIN:VCALENDAR");
  });
});
