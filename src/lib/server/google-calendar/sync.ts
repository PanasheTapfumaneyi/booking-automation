import { ApiError } from "@/lib/server/errors";
import type { BusinessRow, ServiceRow, BookingRow } from "@/lib/server/database";
import {
  updateBookingCalendarSync,
  cancelBookingById,
  revertBookingTime,
} from "@/lib/server/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveConnection } from "./repository";
import { createCalendarApiClient } from "./client";
import {
  buildEventPayload,
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEventTime,
} from "./events";
import {
  getBusyRanges,
  hasIntervalOverlap,
} from "./availability";
import { classifyCalendarError } from "./errors";
import { isDemoBusiness } from "@/lib/server/demo";
import { googleApiTimeoutMs, type CalendarSyncStatus } from "./types";
import type { CalendarErrorCode } from "./types";

export interface CalendarSyncOutcome {
  status: CalendarSyncStatus;
  requiresReconnect?: boolean;
  code?: CalendarErrorCode;
  eventId?: string;
}

const CALENDAR_CONFLICT_MESSAGE =
  "That time now conflicts with the business owner's calendar. Please choose another available time.";
const CALENDAR_RECONNECT_MESSAGE =
  "The business Google Calendar needs to be reconnected before that can happen. Please try again later.";
const CALENDAR_UNAVAILABLE_MESSAGE =
  "We couldn't check the business calendar right now. Please try again shortly.";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const nowIso = () => new Date().toISOString();

/** Maps a classified calendar failure to a client-facing ApiError. */
function toCalendarApiError(code: CalendarErrorCode, message: string): ApiError {
  switch (code) {
    case "CALENDAR_CONFLICT":
      return new ApiError(409, "CALENDAR_CONFLICT", CALENDAR_CONFLICT_MESSAGE);
    case "CALENDAR_AUTH_REQUIRED":
      return new ApiError(503, "CALENDAR_AUTH_REQUIRED", CALENDAR_RECONNECT_MESSAGE);
    case "CALENDAR_UNAVAILABLE":
      return new ApiError(503, "CALENDAR_UNAVAILABLE", CALENDAR_UNAVAILABLE_MESSAGE);
    default:
      return new ApiError(502, "CALENDAR_SYNC_FAILED", message);
  }
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

export interface SyncAfterCreateArgs {
  business: BusinessRow;
  service: ServiceRow;
  row: BookingRow;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  /** Item name for resource bookings (vehicle title in the event). */
  resourceName?: string;
  /** Pre-formatted total ("Rs 4,200") for unit-rate resource bookings. */
  displayTotal?: string;
  db?: SupabaseClient;
  /** Test seam: a prebuilt CalendarApi (fake) to run against instead of Google. */
  api?: ReturnType<typeof createCalendarApiClient>["api"];
}

/**
 * Runs after the database insert. Guarantees the booking and its Google event
 * stay consistent:
 *
 * - busy range conflict     → cancels the just-created booking, throws 409
 * - transient calendar error → cancels the booking, throws 502/503
 * - revoked credentials     → keeps the booking, flags sync failed (business
 *                             config problem, not a customer booking problem)
 */
export async function syncAfterCreate(
  args: SyncAfterCreateArgs,
): Promise<CalendarSyncOutcome> {
  // Demo safety: skip Google Calendar operations for demo businesses,
  // resolved server-side from businesses.is_demo (never from client input).
  if (isDemoBusiness(args.business)) {
    return { status: "not_connected" };
  }

  const connection = await getActiveConnection(args.business.id, args.db);
  if (!connection?.refreshToken || !connection.calendarId) {
    return { status: "not_connected" };
  }
  const api = args.api ?? createCalendarApiClient(connection).api;
  const timeoutMs = googleApiTimeoutMs();

  try {
    const busy = await getBusyRanges({
      api,
      calendarId: connection.calendarId,
      timeMin: args.row.start_time,
      timeMax: args.row.end_time,
      timeZone: args.business.timezone,
      timeoutMs,
    });
    const overlap = busy.find((b) =>
      hasIntervalOverlap(b, {
        start: args.row.start_time,
        end: args.row.end_time,
      }),
    );
    if (overlap) {
      await cancelBookingById(args.row.id, args.db);
      throw new ApiError(409, "CALENDAR_CONFLICT", CALENDAR_CONFLICT_MESSAGE);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const code = classifyCalendarError(err);
    if (code === "CALENDAR_AUTH_REQUIRED") {
      await updateBookingCalendarSync(
        args.row.id,
        { status: "failed", error: code },
        args.db,
      );
      return { status: "failed", requiresReconnect: true, code };
    }
    await cancelBookingById(args.row.id, args.db);
    throw toCalendarApiError(
      code,
      "We couldn't confirm your appointment against the business calendar. Please try again.",
    );
  }

  try {
    const eventId = await createCalendarEvent(api, {
      calendarId: connection.calendarId,
      requestBody: buildEventPayload({
        business: args.business,
        service: args.service,
        bookingId: args.row.id,
        customerName: args.customerName,
        customerPhone: args.customerPhone,
        customerEmail: args.customerEmail,
        startIso: args.row.start_time,
        endIso: args.row.end_time,
        resourceName: args.resourceName,
        displayTotal: args.displayTotal,
      }),
      timeoutMs,
    });
    await updateBookingCalendarSync(
      args.row.id,
      { status: "synced", eventId, syncedAt: nowIso(), error: null },
      args.db,
    );
    return { status: "synced", eventId };
  } catch (err) {
    const code = classifyCalendarError(err);
    if (code === "CALENDAR_AUTH_REQUIRED") {
      await updateBookingCalendarSync(
        args.row.id,
        { status: "failed", error: code },
        args.db,
      );
      return { status: "failed", requiresReconnect: true, code };
    }
    await cancelBookingById(args.row.id, args.db);
    throw toCalendarApiError(
      code,
      "Your appointment could not be confirmed on the business calendar. Please try again.",
    );
  }
}

// ---------------------------------------------------------------------------
// RESCHEDULE
// ---------------------------------------------------------------------------

export interface CalendarFreeCheckArgs {
  business: BusinessRow;
  /** The booking being moved — its own event id is ignored in the check. */
  row: Pick<BookingRow, "id" | "google_event_id">;
  newStartIso: string;
  newEndIso: string;
  db?: SupabaseClient;
  /** Test seam: a prebuilt CalendarApi (fake). */
  api?: ReturnType<typeof createCalendarApiClient>["api"];
}

/**
 * Pre-insertion check: the new time must be free on the business calendar,
 * ignoring this booking's own event. Throws 409/503 on conflict/failure —
 * nothing has been moved in the database yet at this point.
 */
export async function assertNewTimeCalendarFree(
  args: CalendarFreeCheckArgs,
): Promise<void> {
  const connection = await getActiveConnection(args.business.id, args.db);
  if (!connection?.refreshToken || !connection.calendarId) {
    return; // no calendar → Supabase is the only guard
  }
  const api = args.api ?? createCalendarApiClient(connection).api;
  try {
    const busy = await getBusyRanges({
      api,
      calendarId: connection.calendarId,
      timeMin: args.newStartIso,
      timeMax: args.newEndIso,
      timeZone: args.business.timezone,
      excludeEventId: args.row.google_event_id ?? undefined,
      timeoutMs: googleApiTimeoutMs(),
    });
    const overlap = busy.find((b) =>
      hasIntervalOverlap(b, { start: args.newStartIso, end: args.newEndIso }),
    );
    if (overlap) {
      throw new ApiError(409, "CALENDAR_CONFLICT", CALENDAR_CONFLICT_MESSAGE);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw toCalendarApiError(
      classifyCalendarError(err),
      "We couldn't check the business calendar. Please try again.",
    );
  }
}

export interface SyncRescheduleMoveArgs {
  business: BusinessRow;
  /** Booking row AFTER the database move succeeded (new start/end). */
  row: Pick<BookingRow, "id" | "google_event_id">;
  newStartIso: string;
  newEndIso: string;
  previousStartIso: string;
  previousEndIso: string;
  db?: SupabaseClient;
  /** Test seam: a prebuilt CalendarApi (fake). */
  api?: ReturnType<typeof createCalendarApiClient>["api"];
  /**
   * When the stored Google event no longer exists (manually deleted on the
   * calendar), recreate it at the new time instead of failing the
   * reschedule. Omitted → legacy behavior (revert the DB move and throw).
   */
  recreate?: {
    service: Pick<ServiceRow, "name" | "price">;
    customerName: string;
    customerPhone: string;
    customerEmail?: string | null;
    /** Item name for resource bookings (vehicle title in the event). */
    resourceName?: string;
    /** Pre-formatted total ("Rs 4,200") for unit-rate resource bookings. */
    displayTotal?: string;
  };
}

/**
 * Recreates a manually-deleted Google event at the rescheduled time and
 * records the new event id on the booking. Returns null when recreation
 * itself fails so the caller falls back to reverting the database move.
 */
async function recreateMovedEvent(
  api: ReturnType<typeof createCalendarApiClient>["api"],
  calendarId: string,
  args: Pick<
    SyncRescheduleMoveArgs,
    "business" | "row" | "newStartIso" | "newEndIso" | "db"
  > & {
    recreate: NonNullable<SyncRescheduleMoveArgs["recreate"]>;
  },
): Promise<CalendarSyncOutcome | null> {
  try {
    const eventId = await createCalendarEvent(api, {
      calendarId,
      requestBody: buildEventPayload({
        business: args.business,
        service: args.recreate.service,
        bookingId: args.row.id,
        customerName: args.recreate.customerName,
        customerPhone: args.recreate.customerPhone,
        customerEmail: args.recreate.customerEmail,
        startIso: args.newStartIso,
        endIso: args.newEndIso,
        resourceName: args.recreate.resourceName,
        displayTotal: args.recreate.displayTotal,
      }),
      timeoutMs: googleApiTimeoutMs(),
    });
    await updateBookingCalendarSync(
      args.row.id,
      { status: "synced", eventId, syncedAt: nowIso(), error: null },
      args.db,
    );
    return { status: "synced", eventId, code: "CALENDAR_EVENT_NOT_FOUND" };
  } catch {
    return null;
  }
}

/**
 * Moves the booking's existing Google event to the new times (PATCH, same
 * event id). On failure the database move is reversed so the booking and the
 * calendar do not diverge; if the revert itself fails the booking is kept at
 * the new time and flagged as failed for visibility.
 */
export async function moveCalendarEvent(
  args: SyncRescheduleMoveArgs,
): Promise<CalendarSyncOutcome> {
  if (!args.row.google_event_id) return { status: "not_connected" };
  const connection = await getActiveConnection(args.business.id, args.db);
  if (!connection?.refreshToken || !connection.calendarId) {
    return { status: "not_connected" };
  }
  const api = args.api ?? createCalendarApiClient(connection).api;

  const markFailed = (code: CalendarErrorCode, error?: string) =>
    updateBookingCalendarSync(
      args.row.id,
      { status: "failed", error: error ?? code },
      args.db,
    );

  try {
    await updateCalendarEventTime(api, {
      calendarId: connection.calendarId,
      eventId: args.row.google_event_id as string,
      startIso: args.newStartIso,
      endIso: args.newEndIso,
      timeZone: args.business.timezone,
      timeoutMs: googleApiTimeoutMs(),
    });
    await updateBookingCalendarSync(
      args.row.id,
      { status: "synced", syncedAt: nowIso(), error: null },
      args.db,
    );
    return { status: "synced" };
  } catch (err) {
    const code = classifyCalendarError(err);
    const recreate = args.recreate;
    if (code === "CALENDAR_EVENT_NOT_FOUND" && recreate) {
      // The event was manually deleted on the calendar. Recreate it at the
      // new time so the reschedule still succeeds and the booking and the
      // calendar do not diverge.
      const recreated = await recreateMovedEvent(api, connection.calendarId, {
        business: args.business,
        row: args.row,
        newStartIso: args.newStartIso,
        newEndIso: args.newEndIso,
        db: args.db,
        recreate,
      }).catch(() => null);
      if (recreated) return recreated;
    }
    const reverted = await revertBookingTime(
      args.row.id,
      args.previousStartIso,
      args.previousEndIso,
      args.db,
    ).catch(() => false);
    await markFailed(code);
    if (!reverted) {
      console.error(
        "[google-calendar] reschedule sync failed and DB revert failed:",
        err,
      );
      return { status: "failed", code, requiresReconnect: code === "CALENDAR_AUTH_REQUIRED" };
    }
    throw toCalendarApiError(
      code,
      "We couldn't move this appointment on the business calendar. Please try again.",
    );
  }
}

// ---------------------------------------------------------------------------
// CANCEL
// ---------------------------------------------------------------------------

export interface SyncAfterCancelArgs {
  business: Pick<BusinessRow, "id">;
  row: Pick<BookingRow, "id" | "google_event_id">;
  db?: SupabaseClient;
  /** Test seam: a prebuilt CalendarApi (fake). */
  api?: ReturnType<typeof createCalendarApiClient>["api"];
}

/**
 * Removes the cancelled booking's Google event. "not found" is safe/idempotent
 * (the owner may have deleted it) and never breaks cancellations. The database
 * cancellation is already committed before this runs, so availability is freed
 * immediately regardless of Google's outcome.
 */
export async function syncAfterCancel(
  args: SyncAfterCancelArgs,
): Promise<CalendarSyncOutcome> {
  if (!args.row.google_event_id) return { status: "not_connected" };
  const connection = await getActiveConnection(args.business.id, args.db);
  if (!connection?.refreshToken || !connection.calendarId) {
    await updateBookingCalendarSync(
      args.row.id,
      { status: "failed", error: "CALENDAR_NOT_CONNECTED" },
      args.db,
    );
    return { status: "failed", code: "CALENDAR_NOT_CONNECTED" };
  }
  const api = args.api ?? createCalendarApiClient(connection).api;
  try {
    const result = await deleteCalendarEvent(api, {
      calendarId: connection.calendarId,
      eventId: args.row.google_event_id,
      timeoutMs: googleApiTimeoutMs(),
    });
    await updateBookingCalendarSync(
      args.row.id,
      { status: "synced", syncedAt: nowIso(), error: null },
      args.db,
    );
    return result === "not-found"
      ? { status: "synced", code: "CALENDAR_EVENT_NOT_FOUND" }
      : { status: "synced" };
  } catch (err) {
    const code = classifyCalendarError(err);
    await updateBookingCalendarSync(
      args.row.id,
      { status: "failed", error: code },
      args.db,
    ).catch(() => undefined);
    console.error("[google-calendar] event delete on cancel failed:", err);
    return { status: "failed", code, requiresReconnect: code === "CALENDAR_AUTH_REQUIRED" };
  }
}

// ---------------------------------------------------------------------------
// Availability (shared with the appointment strategy)
// ---------------------------------------------------------------------------

export { fetchExternalCalendarBlocks } from "./availability";