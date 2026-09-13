import { describe, it, expect } from "vitest";
import { googleCalendarUrl } from "./google";
import type { CalendarEvent } from "./types";

const BASE_EVENT: CalendarEvent = {
  businessName: "Fade Area",
  serviceName: "Haircut",
  startTime: "2026-09-15T10:30:00+04:00",
  endTime: "2026-09-15T11:15:00+04:00",
  timezone: "Indian/Mauritius",
  manageUrl: "https://app.kivo.mu/manage/abc123",
};

describe("googleCalendarUrl", () => {
  it("generates a valid Google Calendar render URL", () => {
    const url = googleCalendarUrl(BASE_EVENT);
    expect(url).toContain("https://calendar.google.com/calendar/render");
  });

  it("includes action=TEMPLATE", () => {
    const url = googleCalendarUrl(BASE_EVENT);
    expect(url).toContain("action=TEMPLATE");
  });

  it("includes event text with business and service", () => {
    const url = googleCalendarUrl(BASE_EVENT);
    expect(url).toContain("text=Fade+Area+-+Haircut");
  });

  it("includes manage URL in details", () => {
    const url = googleCalendarUrl(BASE_EVENT);
    expect(url).toContain("https%3A%2F%2Fapp.kivo.mu%2Fmanage%2Fabc123");
  });

  it("includes location when present", () => {
    const event = { ...BASE_EVENT, location: "Royal Road" };
    const url = googleCalendarUrl(event);
    expect(url).toContain("location=");
  });
});
