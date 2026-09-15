import type { Booking, NewBookingInput } from "@/types/booking";
import { getSupabase } from "@/lib/supabase/server";
import { ApiError } from "@/lib/server/errors";
import {
  type ServiceRow,
  type BookingRow,
  type BusinessRow,
  BOOKING_SELECT,
  fetchBusiness,
  fetchService,
  fetchBookingByToken,
  fetchBookingSession,
  fetchBlocks,
  findOrCreateCustomer,
  normalizePhone,
  revertBookingSession,
} from "@/lib/server/database";
import { requireAppointmentSlot } from "@/lib/server/strategies/appointment";
import {
  assertResourceFree,
  validateResourceBooking,
} from "@/lib/server/strategies/resource";
import {
  validateCapacityBooking,
  fetchSessionBookedQuantity,
} from "@/lib/server/strategies/capacity";

import { generateManageToken } from "@/lib/server/token";
import { computeResourceTotal, formatMauritianRupees } from "@/lib/resource-pricing";
import {
  assertNewTimeCalendarFree,
  moveCalendarEvent,
  syncAfterCancel,
  syncAfterCreate,
} from "@/lib/server/google-calendar/sync";

import {
  dispatchBookingEvent,
  type NotificationDispatchResult,
} from "@/lib/server/notifications/service";
import {
  generateAttemptId,
  recordFunnelEvent,
  recordFailure,
} from "@/lib/server/operations/events";

export { generateManageToken } from "@/lib/server/token";

const SLOT_UNAVAILABLE_MESSAGE =
  "That time was just booked by someone else. Please choose another available time.";

const CAPACITY_FULL_MESSAGE =
  "That session just filled up. Please choose another departure.";

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function parseInstant(raw: string): Date | null {
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;
  return date;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateContact(input: NewBookingInput): {
  name: string;
  phone: string;
  email: string | null;
} {
  const name = input.name?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  const email = input.email?.trim() ?? "";

  if (!name) {
    throw new ApiError(400, "VALIDATION", "Please enter your name.");
  }
  if (normalizePhone(phone).length < 7) {
    throw new ApiError(400, "VALIDATION", "Please enter a valid phone number.");
  }
  if (email && !isValidEmail(email)) {
    throw new ApiError(400, "VALIDATION", "Please enter a valid email address.");
  }
  return { name, phone, email: email || null };
}

// ---------------------------------------------------------------------------
// Booking mapping
// ---------------------------------------------------------------------------

function mapBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    businessId: row.business_id,
    serviceId: row.service_id,
    customerId: row.customer_id,
    resourceId: row.resource_id,
    sessionId: row.session_id,
    quantity: row.quantity,
    resourceName: row.resource?.name ?? null,
    serviceName: row.service?.name ?? "",
    // Unit-rate resource bookings (rentals) price by days × resource rate.
    servicePrice: computeResourceTotal({
      metadata: row.resource?.metadata ?? null,
      startTime: row.start_time,
      endTime: row.end_time,
      fallbackPrice: Number(row.service?.price ?? 0),
    }),
    serviceDurationMinutes: row.service?.duration_minutes ?? 0,
    customerName: row.customer?.name ?? "",
    customerPhone: row.customer?.phone ?? "",
    customerEmail: row.customer?.email ?? null,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    googleEventId: row.google_event_id,
    manageToken: row.manage_token,
    previousStartTime: row.previous_start_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeBookingRow(
  row: BookingRow,
  service: Pick<ServiceRow, "name" | "duration_minutes" | "price">,
  customer: { name: string; phone: string; email: string | null },
): Booking {
  return mapBooking({ ...row, service, customer });
}

/**
 * Attaches the real business identity to an API-facing booking so headers,
 * summaries and timezone formatting never fall back to a hardcoded demo name,
 * and re-booking links resolve to the booking's OWN business page.
 */
function withBusinessContext(
  booking: Booking,
  business: Pick<BusinessRow, "name" | "timezone"> & { slug?: string | null },
): Booking {
  return {
    ...booking,
    businessName: business.name,
    businessTimezone: business.timezone,
    businessSlug: business.slug ?? null,
  };
}

// ---------------------------------------------------------------------------
// Shared RPC call (mode-agnostic)
// ---------------------------------------------------------------------------

function decodeRpcResult(result: {
  ok: boolean;
  code?: string;
  booking?: BookingRow;
}): BookingRow {
  if (!result.ok) {
    switch (result.code) {
      case "SLOT_UNAVAILABLE":
        throw new ApiError(409, "SLOT_UNAVAILABLE", SLOT_UNAVAILABLE_MESSAGE);
      case "CAPACITY_FULL":
        throw new ApiError(409, "CAPACITY_FULL", CAPACITY_FULL_MESSAGE);
      case "SESSION_NOT_FOUND":
        throw new ApiError(
          400,
          "SESSION_NOT_FOUND",
          "That departure isn't available right now.",
        );
      case "VALIDATION":
        throw new ApiError(400, "VALIDATION", "Please check your booking details.");
      default:
        throw new ApiError(
          500,
          "INTERNAL",
          "We couldn't save your booking. Please try again.",
        );
    }
  }
  return result.booking as unknown as BookingRow;
}

async function insertBooking(rpcArgs: Record<string, unknown>): Promise<BookingRow> {
  const db = getSupabase();
  const { data, error } = await db.rpc("create_booking", rpcArgs);
  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't save your booking.");
  }
  return decodeRpcResult(
    data as { ok: boolean; code?: string; booking?: BookingRow },
  );
}

// ---------------------------------------------------------------------------
// Public operations
// ---------------------------------------------------------------------------

export type CreateBookingInput = NewBookingInput;

export interface CreateBookingResult {
  booking: Booking;
  /**
   * Non-throwing notification dispatch summary. Lets the UI be honest about
   * whether a confirmation was actually sent (KIVO-025/040) instead of
   * promising one unconditionally.
   */
  notifications: NotificationDispatchResult;
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const contact = validateContact(input);
  const attemptId = generateAttemptId();

  // Fire-and-forget funnel tracking — never blocks the booking response.
  const service = await fetchService(input.serviceId);
  if (!service || !service.active) {
    void recordFailure(
      "booking_submit_attempted",
      "SERVICE_NOT_FOUND",
      "expected",
      attemptId,
    );
    throw new ApiError(
      400,
      "SERVICE_NOT_FOUND",
      "That service isn't available right now.",
    );
  }
  const business = await fetchBusiness(service.business_id);

  void recordFunnelEvent(
    "booking_submit_attempted",
    attemptId,
    business.id,
    undefined,
    { serviceId: service.id, mode: business.booking_mode },
  );

  const customerId = await findOrCreateCustomer(business.id, contact);
  const token = generateManageToken();

  switch (business.booking_mode) {
    case "appointment": {
      const start = parseInstant(input.startTime);
      if (!start) {
        throw new ApiError(400, "VALIDATION", "Please choose a valid time.");
      }
      await requireAppointmentSlot(business, service, start);

      const end = new Date(start.getTime() + service.duration_minutes * 60000);
      const startIso = start.toISOString();
      const endIso = end.toISOString();

      const blocks = await fetchBlocks({ businessId: business.id, startIso, endIso });
      if (blocks.length > 0) {
        throw new ApiError(409, "SLOT_UNAVAILABLE", SLOT_UNAVAILABLE_MESSAGE);
      }

      const row = await insertBooking({
        p_business_id: business.id,
        p_service_id: service.id,
        p_customer_id: customerId,
        p_start_time: startIso,
        p_end_time: endIso,
        p_manage_token: token,
      }).catch((err) => {
        void recordFailure(
          "booking_failed",
          "DATABASE_ERROR",
          "technical",
          attemptId,
          business.id,
        );
        throw err;
      });

      const booking = normalizeBookingRow(row, service, contact);
      await syncAfterCreate({
        business,
        service,
        row,
        customerName: contact.name,
        customerPhone: contact.phone,
        customerEmail: contact.email,
      });

      // Fire-and-forget: WhatsApp failure never blocks the booking response
      // (notification dispatch is fully non-throwing — §22 failure isolation).
      const notifications = await dispatchBookingEvent({
        business,
        serviceName: service.name,
        booking: row,
        customer: contact,
        type: "booking.created",
      });

      void recordFunnelEvent(
        "booking_created",
        attemptId,
        business.id,
        row.id,
      );

      return { booking: withBusinessContext(booking, business), notifications };
    }

    case "resource": {
      if (!input.resourceId) {
        throw new ApiError(
          400,
          "VALIDATION",
          "Please choose one of the available items.",
        );
      }
      const resource = await validateResourceBooking({
        businessId: business.id,
        resourceId: input.resourceId,
      });

      const start = parseInstant(input.startTime);
      const end = parseInstant(input.endTime);
      if (!start || !end || start.getTime() >= end.getTime()) {
        throw new ApiError(
          400,
          "VALIDATION",
          "Please choose a valid start and end time.",
        );
      }
      if (end.getTime() <= Date.now()) {
        throw new ApiError(
          400,
          "VALIDATION",
          "This time has already passed. Please choose another.",
        );
      }

      const startIso = start.toISOString();
      const endIso = end.toISOString();
      await assertResourceFree({
        businessId: business.id,
        resourceId: input.resourceId,
        startIso,
        endIso,
      });

      const row = await insertBooking({
        p_business_id: business.id,
        p_service_id: service.id,
        p_customer_id: customerId,
        p_start_time: startIso,
        p_end_time: endIso,
        p_manage_token: token,
        p_resource_id: input.resourceId,
      }).catch((err) => {
        void recordFailure(
          "booking_failed",
          "DATABASE_ERROR",
          "technical",
          attemptId,
          business.id,
        );
        throw err;
      });

      const displayTotal = formatMauritianRupees(
        computeResourceTotal({
          metadata: resource.metadata,
          startTime: startIso,
          endTime: endIso,
          fallbackPrice: Number(service.price),
        }),
      );
      const bookingResource = normalizeBookingRow(row, service, contact);
      await syncAfterCreate({
        business,
        service,
        row,
        customerName: contact.name,
        customerPhone: contact.phone,
        customerEmail: contact.email,
        resourceName: resource.name,
        displayTotal,
      });
      const notifications = await dispatchBookingEvent({
        business,
        serviceName: service.name,
        booking: row,
        customer: contact,
        type: "booking.created",
        resourceName: resource.name,
        displayTotal,
      });

      void recordFunnelEvent(
        "booking_created",
        attemptId,
        business.id,
        row.id,
        { mode: "resource", resourceId: resource.id },
      );

      return {
        booking: withBusinessContext(bookingResource, business),
        notifications,
      };
    }

    case "capacity": {
      if (!input.sessionId) {
        throw new ApiError(
          400,
          "VALIDATION",
          "Please choose one of the available departures.",
        );
      }
      const quantity =
        Number.isFinite(input.quantity) && (input.quantity ?? 0) > 0
          ? Math.floor(input.quantity ?? 1)
          : 1;

      const session = await validateCapacityBooking({
        sessionId: input.sessionId,
        quantity,
      });

      const row = await insertBooking({
        p_business_id: business.id,
        p_service_id: service.id,
        p_customer_id: customerId,
        p_start_time: session.start_time,
        p_end_time: session.end_time ?? session.start_time,
        p_manage_token: token,
        p_session_id: session.id,
        p_quantity: quantity,
      }).catch((err) => {
        void recordFailure(
          "booking_failed",
          "DATABASE_ERROR",
          "technical",
          attemptId,
          business.id,
        );
        throw err;
      });
      const bookingCapacity = normalizeBookingRow(row, service, contact);
      const notifications = await dispatchBookingEvent({
        business,
        serviceName: service.name,
        booking: row,
        customer: contact,
        type: "booking.created",
      });

      void recordFunnelEvent(
        "booking_created",
        attemptId,
        business.id,
        row.id,
        { mode: "capacity", sessionId: session.id },
      );

      return {
        booking: withBusinessContext(bookingCapacity, business),
        notifications,
      };
    }
  }
}

export async function getBookingByToken(token: string): Promise<Booking> {
  const found = await fetchBookingByToken(token);
  if (!found) {
    throw new ApiError(
      404,
      "BOOKING_NOT_FOUND",
      "We couldn't find this appointment. The link may be incorrect.",
    );
  }
  const business = await fetchBusiness(found.row.business_id);
  return withBusinessContext(mapBooking(found.row), business);
}

export async function rescheduleBooking(
  token: string,
  startTimeRaw: string,
  endTimeRaw?: string,
): Promise<Booking> {
  const db = getSupabase();
  const attemptId = generateAttemptId();
  const found = await fetchBookingByToken(token);
  if (!found) {
    throw new ApiError(
      404,
      "BOOKING_NOT_FOUND",
      "We couldn't find this appointment. The link may be incorrect.",
    );
  }
  const { row } = found;

  if (row.status === "cancelled") {
    throw new ApiError(
      409,
      "BOOKING_CANCELLED",
      "This appointment has already been cancelled.",
    );
  }

  const service = await fetchService(row.service_id);
  if (!service) {
    throw new ApiError(500, "INTERNAL", "We couldn't load this service.");
  }
  const business = await fetchBusiness(row.business_id);

  if (business.booking_mode !== "appointment" && business.booking_mode !== "resource") {
    throw new ApiError(
      400,
      "VALIDATION",
      "Rescheduling isn't available for this booking type yet.",
    );
  }

  let startIso: string;
  let endIso: string;
  if (business.booking_mode === "appointment") {
    const start = parseInstant(startTimeRaw);
    if (!start) {
      throw new ApiError(400, "VALIDATION", "Please choose a valid time.");
    }
    await requireAppointmentSlot(business, service, start);

    const end = new Date(start.getTime() + service.duration_minutes * 60000);
    startIso = start.toISOString();
    endIso = end.toISOString();

    const blocks = await fetchBlocks({
      businessId: business.id,
      startIso,
      endIso,
      excludeBookingId: row.id,
    });
    if (blocks.length > 0) {
      throw new ApiError(409, "SLOT_UNAVAILABLE", SLOT_UNAVAILABLE_MESSAGE);
    }
  } else {
    // Resource mode: the booking keeps its item; only the interval moves.
    // Self-exclusion is derived server-side from the looked-up row.
    if (!row.resource_id) {
      throw new ApiError(
        400,
        "VALIDATION",
        "This booking has no item attached and can't be moved.",
      );
    }
    await validateResourceBooking({
      businessId: business.id,
      resourceId: row.resource_id,
    });
    const start = parseInstant(startTimeRaw);
    const end = endTimeRaw ? parseInstant(endTimeRaw) : null;
    if (!start || !end || start.getTime() >= end.getTime()) {
      throw new ApiError(
        400,
        "VALIDATION",
        "Please choose a valid start and end time.",
      );
    }
    if (end.getTime() <= Date.now()) {
      throw new ApiError(
        400,
        "VALIDATION",
        "This time has already passed. Please choose another.",
      );
    }
    startIso = start.toISOString();
    endIso = end.toISOString();
    await assertResourceFree({
      businessId: business.id,
      resourceId: row.resource_id,
      startIso,
      endIso,
      excludeBookingId: row.id,
    });
  }

  // Final Calendar availability check (ignores this booking's own event).
  await assertNewTimeCalendarFree({
    business,
    row,
    newStartIso: startIso,
    newEndIso: endIso,
  });

  const { data, error } = await db.rpc("update_booking_time", {
    p_booking_id: row.id,
    p_start_time: startIso,
    p_end_time: endIso,
  });

  if (error) {
    void recordFailure(
      "reschedule_failed",
      "DATABASE_ERROR",
      "technical",
      attemptId,
      row.business_id,
      row.id,
    );
    throw new ApiError(
      500,
      "INTERNAL",
      "We couldn't reschedule your appointment. Please try again.",
    );
  }

  const result = data as { ok: boolean; code?: string; booking?: BookingRow };

  if (!result.ok) {
    if (result.code === "SLOT_UNAVAILABLE") {
      throw new ApiError(409, "SLOT_UNAVAILABLE", SLOT_UNAVAILABLE_MESSAGE);
    }
    // BOOKING_INVALID — the booking may have been cancelled concurrently.
    const latest = await fetchBookingByToken(token);
    if (latest && latest.row.status === "cancelled") {
      throw new ApiError(
        409,
        "BOOKING_CANCELLED",
        "This appointment has already been cancelled.",
      );
    }
    throw new ApiError(409, "SLOT_UNAVAILABLE", SLOT_UNAVAILABLE_MESSAGE);
  }

  const movedRow = result.booking as unknown as BookingRow;

  // Move the existing Google event; reverts the DB move on failure.
  // If the event was manually deleted on the calendar, recreate it at the
  // new time instead of failing the reschedule.
  await moveCalendarEvent({
    business,
    row,
    newStartIso: startIso,
    newEndIso: endIso,
    previousStartIso: row.start_time,
    previousEndIso: row.end_time,
    recreate: {
      service,
      customerName: row.customer?.name ?? "",
      customerPhone: row.customer?.phone ?? "",
      customerEmail: row.customer?.email ?? null,
      resourceName: row.resource?.name ?? undefined,
      displayTotal: row.resource?.metadata
        ? formatMauritianRupees(
            computeResourceTotal({
              metadata: row.resource.metadata,
              startTime: startIso,
              endTime: endIso,
              fallbackPrice: Number(service.price),
            }),
          )
        : undefined,
    },
  });

  void recordFunnelEvent(
    "reschedule_attempted",
    attemptId,
    business.id,
    row.id,
  );

  await dispatchBookingEvent({
    business,
    serviceName: service.name,
    booking: movedRow,
    customer: row.customer ?? { name: "", phone: "" },
    type: "booking.rescheduled",
    previous: { startTime: row.start_time, endTime: row.end_time },
    resourceName: row.resource?.name ?? undefined,
  });

  void recordFunnelEvent(
    "reschedule_completed",
    attemptId,
    business.id,
    movedRow.id,
  );

  return withBusinessContext(
    normalizeBookingRow(
      movedRow,
      service,
      row.customer ?? { name: "", phone: "", email: null },
    ),
    business,
  );
}

export interface CapacityRescheduleInput {
  /** Target departure. Defaults to the booking's current session. */
  sessionId?: string;
  /** New guest count. Defaults to the booking's current quantity. */
  quantity?: number;
}

/**
 * Capacity reschedule: change the guest count on the current departure,
 * move to another departure, or both — atomically.
 *
 * Capacity math never double-counts the customer's own seats: the
 * pre-flight check excludes this booking, and the authoritative
 * `update_booking_session` RPC re-checks inside the transaction with the
 * session row locked. Friendly validation errors are explicit; the
 * quantity is never silently clamped.
 */
export async function rescheduleCapacityBooking(
  token: string,
  input: CapacityRescheduleInput,
): Promise<Booking> {
  const db = getSupabase();
  const attemptId = generateAttemptId();
  const found = await fetchBookingByToken(token);
  if (!found) {
    throw new ApiError(
      404,
      "BOOKING_NOT_FOUND",
      "We couldn't find this appointment. The link may be incorrect.",
    );
  }
  const { row } = found;

  if (row.status === "cancelled") {
    throw new ApiError(
      409,
      "BOOKING_CANCELLED",
      "This appointment has already been cancelled.",
    );
  }

  const service = await fetchService(row.service_id);
  if (!service) {
    throw new ApiError(500, "INTERNAL", "We couldn't load this service.");
  }
  const business = await fetchBusiness(row.business_id);

  if (business.booking_mode !== "capacity" || !row.session_id) {
    throw new ApiError(
      400,
      "VALIDATION",
      "Guest changes are only available for session bookings.",
    );
  }

  let quantity = row.quantity;
  if (input.quantity !== undefined) {
    if (typeof input.quantity !== "number" || !Number.isInteger(input.quantity)) {
      throw new ApiError(
        400,
        "VALIDATION",
        "Please choose a whole number of guests.",
      );
    }
    if (input.quantity < 1) {
      throw new ApiError(
        400,
        "VALIDATION",
        "You need at least 1 guest. To remove everyone, cancel the booking instead.",
      );
    }
    quantity = input.quantity;
  }

  const targetSessionId =
    typeof input.sessionId === "string" && input.sessionId.length > 0
      ? input.sessionId
      : row.session_id;
  if (typeof input.sessionId === "string" && input.sessionId.length === 0) {
    throw new ApiError(400, "VALIDATION", "Please choose a departure.");
  }
  const session = await fetchBookingSession(targetSessionId);
  if (!session || !session.active) {
    throw new ApiError(
      400,
      "SESSION_NOT_FOUND",
      "That departure isn't available right now.",
    );
  }
  if (session.business_id !== business.id) {
    throw new ApiError(
      400,
      "VALIDATION",
      "That departure belongs to another business.",
    );
  }
  if (session.service_id !== row.service_id) {
    throw new ApiError(
      400,
      "VALIDATION",
      "You can only move within departures of the same service.",
    );
  }
  if (new Date(session.start_time).getTime() <= Date.now()) {
    throw new ApiError(
      400,
      "VALIDATION",
      "That departure has already started. Please choose another.",
    );
  }
  if (quantity > session.capacity) {
    throw new ApiError(
      400,
      "VALIDATION",
      `That departure fits ${session.capacity} guest${session.capacity === 1 ? "" : "s"} at most.`,
    );
  }

  // Friendly pre-flight: effective capacity excludes this booking's own
  // seats, so 2 -> 3 is judged on (capacity - others), not (capacity -
  // others - 2). The RPC re-checks authoritatively.
  const bookedOthers = await fetchSessionBookedQuantity({
    sessionId: session.id,
    excludeBookingId: row.id,
  });
  if (quantity > session.capacity - bookedOthers) {
    const remaining = Math.max(session.capacity - bookedOthers, 0);
    throw new ApiError(
      409,
      "CAPACITY_FULL",
      remaining === 0
        ? CAPACITY_FULL_MESSAGE
        : `Only ${remaining} spot${remaining === 1 ? "" : "s"} still available on that departure.`,
    );
  }

  void recordFunnelEvent("reschedule_attempted", attemptId, business.id, row.id, {
    mode: "capacity",
    sessionId: session.id,
    quantity,
  });

  const { data, error } = await db.rpc("update_booking_session", {
    p_booking_id: row.id,
    p_session_id: session.id,
    p_quantity: quantity,
  });

  if (error) {
    void recordFailure(
      "reschedule_failed",
      "DATABASE_ERROR",
      "technical",
      attemptId,
      row.business_id,
      row.id,
    );
    throw new ApiError(
      500,
      "INTERNAL",
      "We couldn't update your booking. Please try again.",
    );
  }

  const result = data as { ok: boolean; code?: string; booking?: BookingRow };

  if (!result.ok) {
    switch (result.code) {
      case "CAPACITY_FULL":
        throw new ApiError(409, "CAPACITY_FULL", CAPACITY_FULL_MESSAGE);
      case "SESSION_NOT_FOUND":
        throw new ApiError(
          400,
          "SESSION_NOT_FOUND",
          "That departure isn't available right now.",
        );
      case "BOOKING_INVALID": {
        // The booking may have been cancelled concurrently.
        const latest = await fetchBookingByToken(token);
        if (latest && latest.row.status === "cancelled") {
          throw new ApiError(
            409,
            "BOOKING_CANCELLED",
            "This appointment has already been cancelled.",
          );
        }
        throw new ApiError(409, "SLOT_UNAVAILABLE", SLOT_UNAVAILABLE_MESSAGE);
      }
      default:
        throw new ApiError(400, "VALIDATION", "Please check your booking details.");
    }
  }

  const movedRow = result.booking as unknown as BookingRow;

  // Move the existing Google event when the times changed (no duplicate).
  // Guest-count-only edits skip the calendar API entirely. On failure the
  // session move is reverted atomically, mirroring the time-move revert.
  if (
    movedRow.start_time !== row.start_time ||
    movedRow.end_time !== row.end_time
  ) {
    try {
      await moveCalendarEvent({
        business,
        row,
        newStartIso: movedRow.start_time,
        newEndIso: movedRow.end_time,
        previousStartIso: row.start_time,
        previousEndIso: row.end_time,
        recreate: {
          service,
          customerName: row.customer?.name ?? "",
          customerPhone: row.customer?.phone ?? "",
          customerEmail: row.customer?.email ?? null,
        },
      });
    } catch (calendarError) {
      await revertBookingSession(row.id, row.session_id, row.quantity).catch(
        () => false,
      );
      throw calendarError;
    }
  }

  await dispatchBookingEvent({
    business,
    serviceName: service.name,
    booking: movedRow,
    customer: row.customer ?? { name: "", phone: "" },
    type: "booking.rescheduled",
    previous: { startTime: row.start_time, endTime: row.end_time },
  });

  void recordFunnelEvent("reschedule_completed", attemptId, business.id, movedRow.id, {
    mode: "capacity",
    sessionId: session.id,
    quantity,
  });

  return withBusinessContext(
    normalizeBookingRow(
      movedRow,
      service,
      row.customer ?? { name: "", phone: "", email: null },
    ),
    business,
  );
}

export async function cancelBooking(token: string): Promise<Booking> {
  const db = getSupabase();
  const cancelAttemptId = generateAttemptId();

  void recordFunnelEvent(
    "cancellation_attempted",
    cancelAttemptId,
    undefined,
    undefined,
    { token },
  );

  const { data, error } = await db
    .from("bookings")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("manage_token", token)
    .neq("status", "cancelled")
    .select(BOOKING_SELECT)
    .maybeSingle();

  if (error) {
    void recordFailure(
      "cancellation_failed",
      "DATABASE_ERROR",
      "technical",
      cancelAttemptId,
    );
    throw new ApiError(
      500,
      "INTERNAL",
      "We couldn't cancel your appointment. Please try again.",
    );
  }

  if (!data) {
    // Either the token doesn't exist or the booking was already cancelled.
    const found = await fetchBookingByToken(token);
    if (!found) {
      throw new ApiError(
        404,
        "BOOKING_NOT_FOUND",
        "We couldn't find this appointment. The link may be incorrect.",
      );
    }
    throw new ApiError(
      409,
      "BOOKING_CANCELLED",
      "This appointment has already been cancelled.",
    );
  }

  const cancelled = data as unknown as BookingRow;

  // Load the business so the cancellation message renders with its real name
  // and timezone. This is notification bookkeeping — a failure here must never
  // break the cancellation, which is already committed.
  let cancelBusiness: { id: string; name: string; timezone: string; phone?: string | null; slug?: string | null } = {
    id: cancelled.business_id,
    name: "",
    timezone: "",
    slug: null,
  };
  try {
    cancelBusiness = await fetchBusiness(cancelled.business_id);
  } catch {
    // Fall back to the placeholder above; the cancellation still succeeds.
  }

  // Remove the calendar event (idempotent if it was already deleted). The DB
  // cancellation is already committed, so availability is freed regardless.
  await syncAfterCancel({
    business: { id: cancelled.business_id },
    row: cancelled,
  });

  await dispatchBookingEvent({
    business: cancelBusiness,
    serviceName: cancelled.service?.name ?? "",
    booking: cancelled,
    customer: cancelled.customer ?? { name: "", phone: "" },
    type: "booking.cancelled",
    resourceName: cancelled.resource?.name ?? undefined,
  });

  void recordFunnelEvent(
    "cancellation_completed",
    cancelAttemptId,
    cancelBusiness.id,
    cancelled.id,
  );

  return withBusinessContext(mapBooking(cancelled), cancelBusiness);
}