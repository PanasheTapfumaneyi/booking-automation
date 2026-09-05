/**
 * Shared timezone-aware date/time helpers.
 *
 * The business timezone is always authoritative: every production decision
 * converts instants through `timezone`, never through the browser's local
 * timezone.
 */

export const SLOT_INTERVAL_MINUTES = 30;
export const BOOKING_WINDOW_DAYS = 30;
export const DEFAULT_TIMEZONE = "Indian/Mauritius";

/** An occupied time span (active booking or calendar event), in UTC ISO. */
export interface TimeBlock {
  startTime: string;
  endTime: string;
}

function toLocalDateString(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function getUTCOffsetMinutes(dateStr: string, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(`${dateStr}T00:00:00Z`));
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "0";

  const utcMidnight = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    0,
    0,
    0,
  );
  const zonedAsUtc = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")) % 24,
    Number(get("minute")),
    Number(get("second")),
  );
  return (zonedAsUtc - utcMidnight) / 60000;
}

function isValidDateStr(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Resolves a "YYYY-MM-DD" string to the UTC instant of midnight that begins
 * that day in the given business timezone, plus the local weekday.
 */
export function getLocalDayInfo(
  dateStr: string,
  timezone: string = DEFAULT_TIMEZONE,
): { dayOfWeek: number; dayStartUtc: string } {
  if (!isValidDateStr(dateStr)) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  const offsetMinutes = getUTCOffsetMinutes(dateStr, timezone);
  const dayStartMs = Date.UTC(year, month - 1, day) - offsetMinutes * 60000;
  return {
    dayOfWeek: new Date(dayStartMs).getUTCDay(),
    dayStartUtc: new Date(dayStartMs).toISOString(),
  };
}

/** Labels an instant as local wall-clock time in the business timezone. */
export function formatTimeInZone(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-MU", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function formatLongDateInZone(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-MU", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return formatTimeInZone(iso, DEFAULT_TIMEZONE);
}

export function formatLongDate(iso: string): string {
  return formatLongDateInZone(iso, DEFAULT_TIMEZONE);
}

/** Converts a booking's start instant to the business-local date string. */
export function isoToDateKey(
  iso: string,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  return toDateKey(new Date(iso), timezone);
}

export function toDateKey(
  date: Date,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  return toLocalDateString(date, timezone);
}

export function minutesToLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

export function addDaysKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day) + days * 86400000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}`;
}

/** True when the two UTC ISO instants overlap (inclusive-end semantics). */
export function doIntervalsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return Date.parse(aStart) < Date.parse(bEnd) && Date.parse(aEnd) > Date.parse(bStart);
}