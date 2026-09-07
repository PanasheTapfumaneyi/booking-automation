/**
 * Per-business weekly opening hours (Phase 6A).
 *
 * Stored as JSONB on businesses.availability. Each weekday maps to an
 * opening window or null (closed); a missing/invalid document falls back
 * to the platform defaults in the slot engine. Times are local "HH:MM".
 */
export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const WEEKDAY_KEYS: WeekdayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

/** JS getDay() (0 = Sunday) → weekday key. */
export function weekdayKeyFromJsDay(jsDay: number): WeekdayKey {
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[jsDay] ?? "mon";
}

export interface DayHours {
  open: string;
  close: string;
}

/** Null day = closed. Absent document = platform defaults. */
export type BusinessHours = Partial<Record<WeekdayKey, DayHours | null>>;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(value: string): number {
  const match = TIME_RE.exec(value);
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Plain error carrying a user-facing message (callers map to ApiError 400). */
export class InvalidHoursError extends Error {
  constructor(message = "Opening hours are invalid.") {
    super(message);
    this.name = "InvalidHoursError";
  }
}

/**
 * Validates untrusted hours input (API/onboarding). Returns a normalized
 * document, or throws InvalidHoursError. Null/undefined yields null
 * (platform defaults). Client-safe: no server imports.
 */
export function parseBusinessHours(input: unknown): BusinessHours | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new InvalidHoursError();
  }
  const raw = input as Record<string, unknown>;
  const hours: BusinessHours = {};
  for (const key of WEEKDAY_KEYS) {
    const day = raw[key];
    if (day === null || day === undefined) {
      hours[key] = null;
      continue;
    }
    if (typeof day !== "object" || Array.isArray(day)) {
      throw new InvalidHoursError();
    }
    const { open, close } = day as { open?: unknown; close?: unknown };
    if (
      typeof open !== "string" ||
      typeof close !== "string" ||
      !TIME_RE.test(open) ||
      !TIME_RE.test(close) ||
      !(toMinutes(open) < toMinutes(close))
    ) {
      throw new InvalidHoursError(
        "Each open day needs an opening time before its closing time (HH:MM).",
      );
    }
    hours[key] = { open, close };
  }
  return hours;
}

/** Day window in minutes, or null when closed. Invalid docs fall back inside the engine. */
export function dayWindowMinutes(
  hours: BusinessHours | null | undefined,
  jsDay: number,
): { startMinutes: number | null; endMinutes: number | null } | null {
  if (!hours) return null; // signal: use platform defaults
  const day = hours[weekdayKeyFromJsDay(jsDay)];
  if (day === null || day === undefined) {
    return { startMinutes: null, endMinutes: null };
  }
  const startMinutes = toMinutes(day.open);
  const endMinutes = toMinutes(day.close);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return null;
  return { startMinutes, endMinutes };
}
