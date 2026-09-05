import type { BusinessRow, ServiceRow } from "@/lib/server/database";
import type { CalendarApi, CalendarEventBody } from "./types";
import { CalendarIntegrationError } from "./errors";
import { classifyCalendarError } from "./errors";

export interface EventPayloadInput {
  business: Pick<BusinessRow, "id" | "timezone">;
  service: Pick<ServiceRow, "name" | "price">;
  bookingId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  startIso: string;
  endIso: string;
}

/**
 * Builds the Google Calendar event payload for a booking.
 *
 * - Uses the booking's exact start/end instants.
 * - Sets the event timezone to the business timezone (the instants are
 *   absolute, the timezone only affects display).
 * - Embeds booking/business ids in private extended properties for later
 *   reconciliation.
 * - Never includes the manage token or any credential.
 */
export function buildEventPayload(input: EventPayloadInput): CalendarEventBody {
  const lines = [
    `Service: ${input.service.name}`,
    `Customer: ${input.customerName}`,
    `Phone: ${input.customerPhone}`,
    input.customerEmail ? `Email: ${input.customerEmail}` : null,
    `Price: Rs${Number(input.service.price)}`,
    `Booking ID: ${input.bookingId}`,
    "Managed by the Booking Platform",
  ].filter((line): line is string => line !== null);

  return {
    summary: `${input.service.name} - ${input.customerName}`,
    description: lines.join("\n"),
    start: { dateTime: input.startIso, timeZone: input.business.timezone },
    end: { dateTime: input.endIso, timeZone: input.business.timezone },
    extendedProperties: {
      private: {
        platform_booking_id: input.bookingId,
        platform_business_id: input.business.id,
      },
    },
  };
}

export interface CreateEventArgs {
  calendarId: string;
  requestBody: CalendarEventBody;
  timeoutMs?: number;
}

/** Creates an event and returns Google's event id. */
export async function createCalendarEvent(
  api: CalendarApi,
  args: CreateEventArgs,
): Promise<string> {
  const { data } = await api.events.insert(
    { calendarId: args.calendarId, requestBody: args.requestBody },
    { timeout: args.timeoutMs },
  );
  if (!data?.id) {
    throw new CalendarIntegrationError(
      "CALENDAR_SYNC_FAILED",
      "Google Calendar did not return an event id.",
    );
  }
  return data.id;
}

export interface UpdateEventTimeArgs {
  calendarId: string;
  eventId: string;
  startIso: string;
  endIso: string;
  timeZone: string;
  timeoutMs?: number;
}

/**
 * Moves an existing event to new start/end times (a PATCH, not delete+recreate).
 * The same event id survives, which keeps reconciliation stable.
 */
export async function updateCalendarEventTime(
  api: CalendarApi,
  args: UpdateEventTimeArgs,
): Promise<void> {
  await api.events.patch(
    {
      calendarId: args.calendarId,
      eventId: args.eventId,
      requestBody: {
        start: { dateTime: args.startIso, timeZone: args.timeZone },
        end: { dateTime: args.endIso, timeZone: args.timeZone },
      },
    },
    { timeout: args.timeoutMs },
  );
}

export interface DeleteEventArgs {
  calendarId: string;
  eventId: string;
  timeoutMs?: number;
}

/**
 * Deletes an event. A 404 (already manually deleted, or callback race) is
 * treated as an idempotent success so cancellation never breaks on it.
 */
export async function deleteCalendarEvent(
  api: CalendarApi,
  args: DeleteEventArgs,
): Promise<"deleted" | "not-found"> {
  try {
    await api.events.delete(
      { calendarId: args.calendarId, eventId: args.eventId },
      { timeout: args.timeoutMs },
    );
    return "deleted";
  } catch (err) {
    if (classifyCalendarError(err) === "CALENDAR_EVENT_NOT_FOUND") {
      return "not-found";
    }
    throw err;
  }
}

export interface GetEventTimeArgs {
  calendarId: string;
  eventId: string;
  timeoutMs?: number;
}

/** Returns the current start/end of an event, or null when it no longer exists. */
export async function getCalendarEventTime(
  api: CalendarApi,
  args: GetEventTimeArgs,
): Promise<{ start: string; end: string } | null> {
  try {
    const { data } = await api.events.get(
      { calendarId: args.calendarId, eventId: args.eventId },
      { timeout: args.timeoutMs },
    );
    const start = data?.start?.dateTime;
    const end = data?.end?.dateTime;
    if (!start || !end) return null;
    return { start, end };
  } catch (err) {
    if (classifyCalendarError(err) === "CALENDAR_EVENT_NOT_FOUND") {
      return null;
    }
    throw err;
  }
}