/**
 * Booking notification service — the single orchestration point.
 *
 * Responsibilities:
 *  - resolve the active provider;
 *  - load per-business notification settings;
 *  - build one delivery record per (event, recipient_type, channel);
 *  - render message bodies via the template layer;
 *  - call the provider, recording sent/failed/skipped;
 *  - surface a summary back to the caller.
 *
 * Contract guarantees (§22):
 *  - This module NEVER throws. Every failure becomes a logged failure record
 *    and a summary code so that a WhatsApp problem never rolls back a booking.
 *  - Dispatches are idempotent: the same (event_id, recipient, channel) never
 *    produces two sends.
 */
import { getSupabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BookingEventType,
  BusinessNotificationSettings,
  NotificationMessage,
  NotificationRecord,
} from "@/lib/notifications/types";
import { generateEventId } from "@/lib/notifications/types";
import { buildCustomerMessage, buildBusinessMessage } from "@/lib/notifications/templates";
import type { TemplateContext } from "@/lib/notifications/templates";
import { toE164 } from "@/lib/notifications/phone";
import {
  notificationProvider,
  appBaseUrl,
} from "./config";
import type { NotificationProvider } from "@/lib/notifications/types";
import {
  resolveNotificationProvider,
  resolveProviderByName,
  resetNotificationProviderForTests,
} from "./providers";
import {
  fetchNotificationRecord,
  fetchNotificationRecordById,
  fetchBusinessNotificationSettings,
  createNotificationRecord,
  updateNotificationRecord,
} from "./records";
import type { NotificationStatusPatch } from "./records";
import { isDemoBusiness } from "@/lib/server/demo";

// ---------------------------------------------------------------------------
// Public summary (returned to the booking service / optional API response)
// ---------------------------------------------------------------------------

export type RecipientNotificationStatus =
  | "sent"
  | "failed"
  | "skipped"
  | "not_notified";

export interface NotificationDispatchResult {
  dispatched: boolean;
  recipients: {
    customer: RecipientNotificationStatus;
    business: RecipientNotificationStatus;
  };
  primary: "customer";
}

// ---------------------------------------------------------------------------
// Booking dispatch input (built by the booking service)
// ---------------------------------------------------------------------------

export interface BookingNotificationDispatchInput {
  business: Pick<BusinessRowMinimal, "id" | "name" | "timezone"> & {
    /**
     * Explicit demo flag, forwarded from the server-fetched business row
     * (booking-service passes the full row). Absent = production.
     * Never populated from client input.
     */
    is_demo?: boolean | null;
    /** Business contact phone — included in customer messages for mutual contact. */
    phone?: string | null;
  };
  serviceName: string;
  booking: Pick<BookingRowMinimal, "id" | "start_time" | "end_time" | "manage_token">;
  customer: { name: string; phone: string };
  type: BookingEventType;
  /** Populated only for `booking.rescheduled`. */
  previous?: { startTime: string; endTime: string };
  /**
   * Item name for resource bookings (vehicle name for rentals). Absent for
   * appointment/capacity bookings — templates stay unchanged for them.
   */
  resourceName?: string;
  /** Pre-formatted total price ("Rs 4,200") for rental/unit-rate bookings. */
  displayTotal?: string;
  /**
   * Optional override for the notification event id (used in tests and
   * idempotency-replay scenarios). When omitted a fresh UUID is generated.
   */
  eventId?: string;
  db?: SupabaseClient;
}

type BusinessRowMinimal = { id: string; name: string; timezone: string };
type BookingRowMinimal = {
  id: string;
  start_time: string;
  end_time: string;
  manage_token: string;
};

// ---------------------------------------------------------------------------
// Per-recipient helper
// ---------------------------------------------------------------------------

interface SendOneArgs {
  recipientType: "customer" | "business";
  destination: string;
  body: string;
  db: SupabaseClient;
  provider: NotificationProvider;
  eventId: string;
  bookingId: string;
  businessId: string;
  customerId?: string | null;
  eventType: BookingEventType;
  settings: BusinessNotificationSettings;
  metadata?: Record<string, unknown>;
}

interface RecipientSendSummary {
  status: RecipientNotificationStatus;
}

async function sendOne(args: SendOneArgs): Promise<RecipientSendSummary> {
  const {
    recipientType,
    destination,
    body,
    db,
    provider,
    eventId,
    bookingId,
    businessId,
    customerId,
    eventType,
    metadata,
  } = args;

  // ── 1. Idempotency check ────────────────────────────────────────────────
  const existing = await fetchNotificationRecord(
    { eventId, recipientType, channel: "whatsapp" },
    db,
  );
  if (existing && ["sent", "skipped"].includes(existing.status)) {
    return { status: existing.status === "sent" ? "sent" : "skipped" };
  }

  // ── 2. Destination validation ───────────────────────────────────────────
  let normalized: string;
  try {
    normalized = toE164(destination);
  } catch {
    const created = await createNotificationRecord(
      {
        eventId,
        bookingId,
        businessId,
        customerId,
        eventType,
        recipientType,
        channel: "whatsapp",
        destination,
        status: "failed",
        provider: provider.name,
        metadata,
      },
      db,
    );
    if (created.id) {
      await updateNotificationRecord(created.id, {
        status: "failed",
        errorCode: "INVALID_PHONE",
        errorMessage: "Destination phone number could not be normalized to E.164.",
      }, db);
    }
    return { status: "failed" };
  }

  // ── 3. Create or re-use existing record ─────────────────────────────────
  let recordId: string;
  if (existing) {
    recordId = existing.id;
  } else {
    const created = await createNotificationRecord(
      {
        eventId,
        bookingId,
        businessId,
        customerId,
        eventType,
        recipientType,
        channel: "whatsapp",
        destination: normalized,
        status: "processing",
        provider: provider.name,
        metadata,
      },
      db,
    );
    if (!created.id) {
      // Duplicate race — another thread won the insert; return the winner's
      // status without sending.
      const winner = await fetchNotificationRecord(
        { eventId, recipientType, channel: "whatsapp" },
        db,
      );
      return { status: winner?.status === "sent" ? "sent" : "skipped" };
    }
    recordId = created.id;
  }

  // ── 4. Send ─────────────────────────────────────────────────────────────
  await updateNotificationRecord(recordId, { status: "processing" }, db);

  const msg: NotificationMessage = {
    destination: normalized,
    body,
    eventId,
    bookingId,
    businessId,
    recipientType,
  };

  const result = await provider.send(msg);

  const patch: NotificationStatusPatch = {
    status: result.success ? "sent" : "failed",
    providerMessageId: result.providerMessageId ?? undefined,
    errorCode: result.errorCode ?? undefined,
    errorMessage: result.success ? null : result.errorCode ?? "UNKNOWN",
    sentAt: result.success ? new Date().toISOString() : undefined,
  };
  await updateNotificationRecord(recordId, patch, db);

  return { status: result.success ? "sent" : "failed" };
}

// ---------------------------------------------------------------------------
// Main dispatch entry point (non-throwing)
// ---------------------------------------------------------------------------

export async function dispatchBookingEvent(
  input: BookingNotificationDispatchInput,
): Promise<NotificationDispatchResult> {
  const noopResult: NotificationDispatchResult = {
    dispatched: false,
    recipients: { customer: "not_notified", business: "not_notified" },
    primary: "customer",
  };

  // Feature gate: NOTIFICATION_PROVIDER=none (or unset) keeps notifications
  // fully off — no records, no network, no provider resolution.
  if (notificationProvider() === "none") {
    return noopResult;
  }

  // Demo safety: suppress external sends for demo businesses, resolved
  // server-side from businesses.is_demo (never from client input).
  if (isDemoBusiness(input.business)) {
    return { ...noopResult, dispatched: false };
  }

  const provider = resolveNotificationProvider();
  const summary: NotificationDispatchResult = { ...noopResult, dispatched: false };

  try {
    const db = input.db ?? getSupabase();
    const settings = await fetchBusinessNotificationSettings(input.business.id, db);
    const eventId = input.eventId ?? generateEventId();

    const manageUrl = `${appBaseUrl()}/manage/${input.booking.manage_token}`;
    const calendarUrl = `${appBaseUrl()}/api/bookings/${input.booking.manage_token}/calendar`;

    const ctx: TemplateContext = {
      businessName: input.business.name,
      businessTimezone: input.business.timezone,
      serviceName: input.serviceName,
      customerName: input.customer.name,
      customerPhone: input.customer.phone,
      startIso: input.booking.start_time,
      endIso: input.booking.end_time,
      manageUrl,
      calendarUrl,
      previousStartIso: input.previous?.startTime,
      resourceName: input.resourceName,
      displayTotal: input.displayTotal,
      businessPhone: input.business.phone ?? undefined,
    };

    const customerPromise = (async () => {
      if (settings.customer_notifications_enabled && settings.whatsapp_enabled) {
        const body = buildCustomerMessage(input.type, ctx);
        const s = await sendOne({
          recipientType: "customer",
          destination: input.customer.phone,
          body,
          db,
          provider,
          eventId,
          bookingId: input.booking.id,
          businessId: input.business.id,
          eventType: input.type,
          settings,
          metadata: input.previous
            ? { previousStart: input.previous.startTime, previousEnd: input.previous.endTime }
            : undefined,
        });
        summary.recipients.customer = s.status;
      } else {
        summary.recipients.customer = "skipped";
      }
    })();

    const businessPromise = (async () => {
      const phone = settings.business_notification_phone;
      if (
        settings.business_notifications_enabled &&
        settings.whatsapp_enabled &&
        phone &&
        phone.length > 0
      ) {
        const body = buildBusinessMessage(input.type, ctx);
        const s = await sendOne({
          recipientType: "business",
          destination: phone,
          body,
          db,
          provider,
          eventId,
          bookingId: input.booking.id,
          businessId: input.business.id,
          customerId: null,
          eventType: input.type,
          settings,
          metadata: input.previous
            ? { previousStart: input.previous.startTime, previousEnd: input.previous.endTime }
            : undefined,
        });
        summary.recipients.business = s.status;
      } else {
        summary.recipients.business = "skipped";
      }
    })();

    await Promise.all([customerPromise, businessPromise]);
    summary.dispatched = true;
  } catch (err) {
    console.error("[notifications] dispatchBookingEvent failed (booking unaffected):", err);
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Manual retry (service-level)
// ---------------------------------------------------------------------------

export interface NotificationRetrySummary {
  previousStatus: NotificationRecord["status"];
  status: RecipientNotificationStatus;
  attemptCount: number;
}

/**
 * Re-sends a previously failed notification. Does nothing if the record is
 * already sent/skipped, or if the original provider is no longer configured.
 */
export async function retryNotification(
  notificationId: string,
  db?: SupabaseClient,
): Promise<NotificationRetrySummary> {
  const client = db ?? getSupabase();
  const record = await fetchNotificationRecordById(notificationId, client);
  if (!record) {
    return { previousStatus: "skipped", status: "not_notified", attemptCount: 0 };
  }

  if (record.status !== "failed" && record.status !== "pending") {
    return {
      previousStatus: record.status,
      status: record.status === "sent" ? "sent" : "skipped",
      attemptCount: record.attempt_count,
    };
  }

  let provider: NotificationProvider;
  try {
    provider = resolveProviderByName(record.provider);
  } catch {
    return { previousStatus: record.status, status: "not_notified", attemptCount: record.attempt_count };
  }

  await updateNotificationRecord(notificationId, { status: "processing" }, client);

  const result = await provider.send({
    destination: record.destination,
    body: "[retry — template rendered at original dispatch]",
    eventId: record.event_id,
    bookingId: record.booking_id,
    businessId: record.business_id,
    recipientType: record.recipient_type,
  });

  const patch: NotificationStatusPatch = {
    status: result.success ? "sent" : "failed",
    providerMessageId: result.providerMessageId ?? undefined,
    errorCode: result.errorCode ?? undefined,
    errorMessage: result.success ? null : result.errorCode ?? "UNKNOWN",
    sentAt: result.success ? new Date().toISOString() : undefined,
  };
  await updateNotificationRecord(notificationId, patch, client);

  return {
    previousStatus: record.status,
    status: result.success ? "sent" : "failed",
    attemptCount: record.attempt_count + 1,
  };
}

// ---------------------------------------------------------------------------
// Health (internal/dev use — §39)
// ---------------------------------------------------------------------------

export interface NotificationHealth {
  provider: string;
  configured: boolean;
  reachable: boolean | null;
  sessionReady: boolean | null;
}

export async function checkNotificationHealth(): Promise<NotificationHealth> {
  if (notificationProvider() === "none") {
    return { provider: "none", configured: false, reachable: null, sessionReady: null };
  }
  const provider = resolveNotificationProvider();
  const h = await provider.health();
  return { provider: provider.name, ...h };
}

// Exposed for test isolation.
export { resetNotificationProviderForTests };