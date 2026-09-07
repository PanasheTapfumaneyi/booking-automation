/**
 * Appointment booking strategy (server-side).
 *
 * Behaviour is identical to Phase 2: fixed 30-minute slot grid inside the
 * business opening schedule, overlaps excluded, future + window validated,
 * and the final server-side check happens at insert time inside the RPC.
 */
import { ApiError } from "@/lib/server/errors";
import type { TimeSlot } from "@/types/booking";
import {
  BOOKING_WINDOW_DAYS,
  DEFAULT_TIMEZONE,
  SLOT_INTERVAL_MINUTES,
  getSlotsForDay,
  getLocalDayInfo,
  isoToDateKey,
  addDaysKey,
  type BusinessHours,
} from "@/lib/availability";
import {
  type BusinessRow,
  type ServiceRow,
  fetchBlocks,
} from "@/lib/server/database";
import {
  fetchExternalCalendarBlocks,
  mergeIntervals,
} from "@/lib/server/google-calendar/availability";
import type { ExternalBlocksStatus } from "@/lib/server/google-calendar/availability";

export interface AppointmentAvailabilityResult {
  kind: "appointment";
  business: {
    id: string;
    name: string;
    timezone: string;
    hours: BusinessHours | null;
  };
  service: { id: string; name: string; durationMinutes: number; price: number };
  date: string;
  timezone: string;
  slots: TimeSlot[];
  /** Diagnostic only — never contains credentials. */
  calendar: ExternalBlocksStatus;
}

function isFuture(start: Date): boolean {
  return start.getTime() > Date.now();
}

function isWithinWindow(start: Date): boolean {
  const horizon = Date.now() + BOOKING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return start.getTime() <= horizon;
}

/**
 * Validates that `start` lies in the future, inside the booking window, and
 * lands exactly on a generated slot for the service.
 */
export async function requireAppointmentSlot(
  business: Pick<BusinessRow, "timezone">,
  service: Pick<ServiceRow, "duration_minutes">,
  start: Date,
): Promise<void> {
  if (!isFuture(start)) {
    throw new ApiError(
      400,
      "VALIDATION",
      "This time has already passed. Please choose another slot.",
    );
  }
  if (!isWithinWindow(start)) {
    throw new ApiError(
      400,
      "VALIDATION",
      `You can only book up to ${BOOKING_WINDOW_DAYS} days ahead.`,
    );
  }

  const timezone = business.timezone || DEFAULT_TIMEZONE;
  const dateStr = isoToDateKey(start.toISOString(), timezone);
  const slots = getSlotsForDay(dateStr, { durationMinutes: service.duration_minutes }, [], timezone);
  const matches = slots.some(
    (slot) => Date.parse(slot.startTime) === start.getTime(),
  );
  if (!matches) {
    throw new ApiError(
      400,
      "VALIDATION",
      "That time isn't available to book. Please pick an open slot.",
    );
  }
}

export async function appointmentAvailability(params: {
  business: BusinessRow;
  service: ServiceRow;
  date: string;
  excludeBookingId?: string;
  ignoreGoogleEventId?: string;
}): Promise<AppointmentAvailabilityResult> {
  const { business, service, date, excludeBookingId, ignoreGoogleEventId } =
    params;
  const timezone = business.timezone || DEFAULT_TIMEZONE;

  const dayStartUtc = getLocalDayInfo(date, timezone).dayStartUtc;
  const dayEndUtc = getLocalDayInfo(addDaysKey(date, 1), timezone).dayStartUtc;

  const [blocks, external] = await Promise.all([
    fetchBlocks({
      businessId: business.id,
      startIso: dayStartUtc,
      endIso: dayEndUtc,
      excludeBookingId,
    }),
    fetchExternalCalendarBlocks({
      business,
      startIso: dayStartUtc,
      endIso: dayEndUtc,
      ignoreGoogleEventId,
    }),
  ]);

  const allBlocks = mergeIntervals([
    ...blocks.map((block) => ({ start: block.startTime, end: block.endTime })),
    ...external.blocks,
  ]).map((block) => ({ startTime: block.start, endTime: block.end }));

  const hours = business.availability ?? null;
  const slots = getSlotsForDay(
    date,
    { durationMinutes: service.duration_minutes },
    allBlocks,
    timezone,
    SLOT_INTERVAL_MINUTES,
    hours,
  );

  return {
    kind: "appointment",
    business: { id: business.id, name: business.name, timezone, hours },
    service: {
      id: service.id,
      name: service.name,
      durationMinutes: service.duration_minutes,
      price: Number(service.price),
    },
    date,
    timezone,
    slots,
    calendar: external.status,
  };
}