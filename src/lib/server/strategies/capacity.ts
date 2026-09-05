/**
 * Capacity booking strategy (server-side foundation).
 *
 * For a session: remaining = capacity - SUM(quantity of ACTIVE bookings).
 * A request is allowed only when requestedQuantity <= remaining. The final
 * authoritative re-check happens atomically inside the `create_booking` RPC
 * (session row lock + insert in one transaction); this module provides the
 * friendly pre-flight check used by the API layer.
 *
 * No tour UI yet — reusable core for tours, classes and activities.
 */
import { getSupabase } from "@/lib/supabase/server";
import { ApiError } from "@/lib/server/errors";
import {
  DEFAULT_TIMEZONE,
  getLocalDayInfo,
  addDaysKey,
  remainingCapacity,
} from "@/lib/availability";
import {
  type BusinessRow,
  type ServiceRow,
  type BookingSessionRow,
  BLOCKING_BOOKING_STATUSES,
  fetchBookingSession,
} from "@/lib/server/database";

export interface SessionSummary {
  id: string;
  startTime: string;
  endTime: string | null;
  capacity: number;
  booked: number;
  remaining: number;
  active: boolean;
}

export interface CapacityAvailabilityResult {
  kind: "capacity";
  business: { id: string; name: string; timezone: string };
  service: { id: string; name: string; durationMinutes: number; price: number };
  date: string;
  timezone: string;
  sessions: SessionSummary[];
}

const CAPACITY_FULL_MESSAGE =
  "That session just filled up. Please choose another departure.";

/** Sum of active booking quantities for a session (excluding one booking). */
export async function fetchSessionBookedQuantity(params: {
  sessionId: string;
  excludeBookingId?: string;
}): Promise<number> {
  let query = getSupabase()
    .from("bookings")
    .select("quantity")
    .eq("session_id", params.sessionId)
    .in("status", BLOCKING_BOOKING_STATUSES);

  if (params.excludeBookingId) {
    query = query.neq("id", params.excludeBookingId);
  }

  const { data, error } = await query;
  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't check availability.");
  }
  return (data ?? []).reduce(
    (total, booking) => total + (booking.quantity as number),
    0,
  );
}

/** Ensures the session exists, is active and has room for the quantity. */
export async function validateCapacityBooking(params: {
  sessionId: string;
  quantity: number;
}): Promise<BookingSessionRow> {
  const session = await fetchBookingSession(params.sessionId);
  if (!session || !session.active) {
    throw new ApiError(
      400,
      "SESSION_NOT_FOUND",
      "That departure isn't available right now.",
    );
  }

  const booked = await fetchSessionBookedQuantity({ sessionId: session.id });
  if (params.quantity > session.capacity - booked) {
    throw new ApiError(409, "CAPACITY_FULL", CAPACITY_FULL_MESSAGE);
  }
  return session;
}

export async function capacityAvailability(params: {
  business: BusinessRow;
  service: ServiceRow;
  date: string;
  excludeBookingId?: string;
}): Promise<CapacityAvailabilityResult> {
  const { business, service, date, excludeBookingId } = params;
  const timezone = business.timezone || DEFAULT_TIMEZONE;

  const dayStartUtc = getLocalDayInfo(date, timezone).dayStartUtc;
  const dayEndUtc = getLocalDayInfo(addDaysKey(date, 1), timezone).dayStartUtc;

  const { data, error } = await getSupabase()
    .from("booking_sessions")
    .select("id, business_id, service_id, start_time, end_time, capacity, active")
    .eq("business_id", business.id)
    .eq("service_id", service.id)
    .eq("active", true)
    .gte("start_time", dayStartUtc)
    .lt("start_time", dayEndUtc);

  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't check availability.");
  }

  const sessions: SessionSummary[] = [];
  for (const session of data ?? []) {
    const sessionId = session.id as string;
    const booked = await fetchSessionBookedQuantity({
      sessionId,
      excludeBookingId,
    });
    const capacity = session.capacity as number;
    sessions.push({
      id: sessionId,
      startTime: session.start_time as string,
      endTime: session.end_time as string | null,
      capacity,
      booked,
      remaining: remainingCapacity(capacity, booked),
      active: session.active as boolean,
    });
  }

  return {
    kind: "capacity",
    business: { id: business.id, name: business.name, timezone },
    service: {
      id: service.id,
      name: service.name,
      durationMinutes: service.duration_minutes,
      price: Number(service.price),
    },
    date,
    timezone,
    sessions,
  };
}