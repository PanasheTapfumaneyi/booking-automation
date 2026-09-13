import type { CalendarEvent } from "./types";

export type { CalendarEvent };

function foldLine(line: string): string {
  const max = 75;
  if (line.length <= max) return line;
  const parts: string[] = [];
  let remaining = line;
  while (remaining.length > max) {
    parts.push(remaining.slice(0, max));
    remaining = " " + remaining.slice(max);
  }
  parts.push(remaining);
  return parts.join("\r\n");
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

function formatUtcDate(iso: string): string {
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

function deterministicUid(event: CalendarEvent): string {
  const seed =
    event.businessName +
    event.serviceName +
    event.startTime +
    event.endTime +
    event.timezone;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `${hex}-${Date.now()}@kivo`;
}

export function generateIcs(event: CalendarEvent): string {
  const summary = `${event.businessName} - ${event.serviceName}`;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Kivo//Booking//EN",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    foldLine(`UID:${deterministicUid(event)}`),
    `DTSTART;TZID=${event.timezone}:${formatUtcDate(event.startTime)}`,
    `DTEND;TZID=${event.timezone}:${formatUtcDate(event.endTime)}`,
    foldLine(`SUMMARY:${escapeText(summary)}`),
  ];

  const descriptionParts: string[] = [];
  if (event.description) {
    descriptionParts.push(event.description);
  }
  if (event.manageUrl) {
    if (descriptionParts.length) descriptionParts.push("\\n");
    descriptionParts.push(`Manage: ${event.manageUrl}`);
  }
  if (descriptionParts.length) {
    lines.push(foldLine(`DESCRIPTION:${escapeText(descriptionParts.join(""))}`));
  }

  if (event.location) {
    lines.push(foldLine(`LOCATION:${escapeText(event.location)}`));
  }

  lines.push(
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "BEGIN:VTIMEZONE",
    `TZID:${event.timezone}`,
    "END:VTIMEZONE",
    "END:VCALENDAR",
  );

  return lines.join("\r\n") + "\r\n";
}

export function generateIcsDownloadHeaders(
  event: CalendarEvent,
): { filename: string; contentType: string; content: string } {
  return {
    filename: "booking.ics",
    contentType: "text/calendar; charset=utf-8",
    content: generateIcs(event),
  };
}
