import type { CalendarEvent } from "./types";

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

function toGoogleUtc(iso: string): string {
  const d = new Date(iso);
  return (
    String(d.getUTCFullYear()) +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const text = `${event.businessName} - ${event.serviceName}`;
  const dates = `${toGoogleUtc(event.startTime)}/${toGoogleUtc(event.endTime)}`;

  const detailsParts: string[] = [];
  if (event.description) {
    detailsParts.push(event.description);
  }
  if (event.manageUrl) {
    if (detailsParts.length) detailsParts.push("\n");
    detailsParts.push(`Manage: ${event.manageUrl}`);
  }
  const details = detailsParts.join("");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text,
    dates,
  });

  if (details) {
    params.set("details", details);
  }
  if (event.location) {
    params.set("location", event.location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
