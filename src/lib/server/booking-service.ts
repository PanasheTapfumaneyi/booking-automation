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
  fetchBlocks,
  findOrCreateCustomer,
  normalizePhone,
} from "@/lib/server/database";
import { requireAppointmentSlot } from "@/lib/server/strategies/appointment";
import {
  assertResourceFree,
  validateResourceBooking,
} from "@/lib/server/strategies/resource";
import {
  validateCapacityBooking,
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
    resourceName: row.resource?.name ?? null,
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
 * summaries and timezone formatting never fall back to a hardcoded demo name.
 */
function withBusinessContext(
  booking: Booking,
  business: Pick<BusinessRow, "name" | "timezone">,
): Booking {
  return {
    ...booking,
    businessName: business.name,
    businessTimezone: business.timezone,
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

  const service = await fetchService(input.serviceId);
  if (!service || !service.active) {
    throw new ApiError(
      400,
      "SERVICE_NOT_FOUND",
      "That service isn't available right now.",
    );
  }
  const business = await fetchBusiness(service.business_id);

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
      });
      const bookingCapacity = normalizeBookingRow(row, service, contact);
      const notifications = await dispatchBookingEvent({
        business,
        serviceName: service.name,
        booking: row,
        customer: contact,
        type: "booking.created",
      });
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

  await dispatchBookingEvent({
    business,
    serviceName: service.name,
    booking: movedRow,
    customer: row.customer ?? { name: "", phone: "" },
    type: "booking.rescheduled",
    previous: { startTime: row.start_time, endTime: row.end_time },
    resourceName: row.resource?.name ?? undefined,
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

  const { data, error } = await db
    .from("bookings")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("manage_token", token)
    .neq("status", "cancelled")
    .select(BOOKING_SELECT)
    .maybeSingle();

  if (error) {
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
  let cancelBusiness: { id: string; name: string; timezone: string } = {
    id: cancelled.business_id,
    name: "",
    timezone: "",
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

  return withBusinessContext(mapBooking(cancelled), cancelBusiness);
}