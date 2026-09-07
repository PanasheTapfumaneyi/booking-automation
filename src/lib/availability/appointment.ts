/**
 * Appointment availability strategy.
 *
 * Generates the fixed-grid appointment slots for a business-local day, using
 * the barbershop-style opening schedule. Used by the appointment booking flow
 * (Fade District) — behaviour is unchanged from Phase 2.
 */
import type { Service, TimeSlot } from "@/types/booking";
import { type BusinessHours, dayWindowMinutes } from "./hours";
import {
  SLOT_INTERVAL_MINUTES,
  DEFAULT_TIMEZONE,
  BOOKING_WINDOW_DAYS,
  type TimeBlock,
  getLocalDayInfo,
  formatTimeInZone,
  isoToDateKey,
  addDaysKey,
} from "./time";

interface DayRange {
  /** Opening time in minutes from local midnight, or null when closed. */
  startMinutes: number | null;
  endMinutes: number | null;
}

/** Per-weekday opening ranges keyed by JS getDay() (0 = Sunday), local time. */
const WEEKDAY_OPENING: Record<number, DayRange> = {
  0: { startMinutes: null, endMinutes: null }, // Sunday — closed
  1: { startMinutes: 9 * 60, endMinutes: 18 * 60 },
  2: { startMinutes: 9 * 60, endMinutes: 18 * 60 },
  3: { startMinutes: 9 * 60, endMinutes: 18 * 60 },
  4: { startMinutes: 9 * 60, endMinutes: 18 * 60 },
  5: { startMinutes: 9 * 60, endMinutes: 18 * 60 },
  6: { startMinutes: 9 * 60, endMinutes: 16 * 60 }, // Saturday
};

export function getOpeningRange(
  dayOfWeek: number,
  hours?: BusinessHours | null,
): DayRange {
  if (hours) {
    const custom = dayWindowMinutes(hours, dayOfWeek);
    // Explicit per-day window (or closed) wins; a null return means the
    // stored document is unusable → fall back to platform defaults.
    if (custom) return custom;
  }
  return WEEKDAY_OPENING[dayOfWeek] ?? { startMinutes: null, endMinutes: null };
}

function isOpenOn(dayOfWeek: number, hours?: BusinessHours | null): boolean {
  return getOpeningRange(dayOfWeek, hours).startMinutes !== null;
}

/**
 * Generates available appointment slots for one business-local day.
 *
 * Slots start on a fixed grid inside opening hours, end before closing time,
 * and never overlap an active booking (or calendar event) block.
 */
export function getSlotsForDay(
  dateStr: string,
  service: Pick<Service, "durationMinutes">,
  blocks: TimeBlock[] = [],
  timezone: string = DEFAULT_TIMEZONE,
  slotIntervalMinutes: number = SLOT_INTERVAL_MINUTES,
  hours?: BusinessHours | null,
): TimeSlot[] {
  const { dayOfWeek, dayStartUtc } = getLocalDayInfo(dateStr, timezone);
  const range = getOpeningRange(dayOfWeek, hours);
  if (range.startMinutes === null || range.endMinutes === null) return [];

  const durationMinutes = service.durationMinutes;
  const dayStartMs = Date.parse(dayStartUtc);
  const slots: TimeSlot[] = [];

  for (
    let minutes = range.startMinutes;
    minutes + durationMinutes <= range.endMinutes;
    minutes += slotIntervalMinutes
  ) {
    const startMs = dayStartMs + minutes * 60000;
    const endMs = startMs + durationMinutes * 60000;

    const blocked = blocks.some(
      (block) =>
        startMs < Date.parse(block.endTime) && endMs > Date.parse(block.startTime),
    );
    if (blocked) continue;

    const startIso = new Date(startMs).toISOString();
    slots.push({
      startTime: startIso,
      endTime: new Date(endMs).toISOString(),
      label: formatTimeInZone(startIso, timezone),
    });
  }

  return slots;
}

/**
 * Business-timezone-safe "is this calendar day pickable": the shop is open on
 * that local weekday and the day sits between today and the booking window.
 * `dateKey` must be "YYYY-MM-DD". String comparison is safe for this format.
 */
export function isDateKeyAvailable(
  dateKey: string,
  timezone: string = DEFAULT_TIMEZONE,
  hours?: BusinessHours | null,
): boolean {
  const { dayOfWeek } = getLocalDayInfo(dateKey, timezone);
  if (!isOpenOn(dayOfWeek, hours)) return false;

  const todayKey = isoToDateKey(new Date().toISOString(), timezone);
  if (dateKey < todayKey) return false;
  const horizonKey = addDaysKey(todayKey, BOOKING_WINDOW_DAYS);
  return dateKey <= horizonKey;
}