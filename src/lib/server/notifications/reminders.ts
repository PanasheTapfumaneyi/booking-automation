/**
 * Timed booking reminders — exactly ONE per booking: 1 hour before start.
 *
 * Architecture:
 *  - Reminder is a notification event (`booking.reminder.1h`) persisted in
 *    the existing `notifications` table.
 *  - One row per (booking, customer, whatsapp), keyed by a STABLE event id
 *    `reminder:{bookingId}:1h` that does NOT contain the start time.
 *    Eligibility is always computed from the CURRENT booking start, which
 *    gives the reschedule policy for free:
 *      - unsent reminder + reschedule → same row, evaluated against the new
 *        start → "follows" the new time, no duplicate row;
 *      - sent reminder + reschedule → the sent row is found by the stable id
 *        → never re-sent;
 *      - cancelled booking → excluded from the scan → no future reminders.
 *    Failed reminders stay eligible while inside their window and are
 *    retried against the SAME row (attempt_count grows, no duplicates).
 *  - Concurrency safety is database-backed, never in-memory: rows are
 *    claimed with an atomic compare-and-swap on (status, attempt_count)
 *    (`claimNotificationRow`). Overlapping runs race the claim; exactly one
 *    wins, losers skip. No locks, no maps, no process state.
 *  - Failure isolation: one bad reminder never stops the run and never
 *    touches the booking.
 *
 * Timing precision:
 *  - The cron/scheduler runs every 5–15 minutes.
 *  - A booking becomes eligible when its T-1h threshold has been reached,
 *    provided the reminder has not already been sent.
 *  - Expected precision: within 5–15 minutes of T-1h depending on cron interval.
 *  - No retroactive reminders: if T-1h has already passed when the booking
 *    is created, no reminder is sent.
 */
import { getSupabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationProvider } from "@/lib/notifications/types";
import { toE164 } from "@/lib/notifications/phone";
import {
  buildReminderMessage,
  type TemplateContext,
} from "@/lib/notifications/templates";
import { appBaseUrl } from "./config";
import { resolveNotificationProvider } from "./providers";
import {
  fetchNotificationRecord,
  fetchBusinessNotificationSettings,
  createNotificationRecord,
  claimNotificationRow,
  updateNotificationRecord,
} from "./records";
import type { NotificationStatusPatch } from "./records";
import { fetchBusiness } from "../database";

/** Exactly ONE reminder type: 1 hour before booking start. */
export const REMINDER_OFFSET_MS = 1 * 60 * 60_000; // 1 hour

/**
 * Eligibility window: a reminder fires once the booking is within T-1h
 * and no earlier than T-1h - WINDOW. Sized for a scheduler running every
 * 5–15 minutes — tolerant of jitter, never early, never exact-second.
 */
export const REMINDER_WINDOW_MS = 15 * 60_000;

/** A `processing` row older than this is treated as crashed, not active. */
export const REMINDER_STALE_PROCESSING_MS = 15 * 60_000;

/** Upper bound on bookings scanned per run. */
export const REMINDER_BATCH_LIMIT = 200;

/** Live (sendable) booking statuses — mirrors availability semantics. */
const LIVE_BOOKING_STATUSES = ["confirmed", "rescheduled"];

export interface ReminderRunSummary {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}

export interface RunDueRemindersArgs {
  db?: SupabaseClient;
  /** Injectable clock (tests). Defaults to Date.now(). */
  now?: number;
  /** Injectable transport (tests). Defaults to the configured provider. */
  provider?: NotificationProvider;
}

/** Stable identity: one row per booking across reschedules. */
export function reminderEventId(bookingId: string): string {
  return `reminder:${bookingId}:1h`;
}

/** True when a booking `startIso` falls inside the T-1h firing window at `now`. */
export function isReminderDue(startIso: string, now: number): boolean {
  const msUntil = Date.parse(startIso) - now;
  if (!Number.isFinite(msUntil)) return false;
  return msUntil <= REMINDER_OFFSET_MS && msUntil > REMINDER_OFFSET_MS - REMINDER_WINDOW_MS;
}

interface DueBooking {
  id: string;
  business_id: string;
  start_time: string;
  end_time: string;
  status: string;
  manage_token: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  service_name: string;
}

async function fetchDueBookings(
  db: SupabaseClient,
  now: number,
): Promise<DueBooking[]> {
  const horizon = new Date(
    now + REMINDER_OFFSET_MS + REMINDER_WINDOW_MS,
  ).toISOString();
  const { data, error } = await db
    .from("bookings")
    .select(
      "id, business_id, start_time, end_time, status, manage_token, customer_id, " +
        "customer:customers(id, name, phone), service:services(name)",
    )
    .in("status", LIVE_BOOKING_STATUSES)
    .gt("start_time", new Date(now).toISOString())
    .lte("start_time", horizon)
    .order("start_time", { ascending: true })
    .limit(REMINDER_BATCH_LIMIT);
  if (error || !Array.isArray(data)) return [];
  const rows: DueBooking[] = [];
  for (const raw of data) {
    const r = raw as unknown as Record<string, unknown>;
    const customer = (r.customer ?? {}) as Record<string, unknown>;
    const service = (r.service ?? {}) as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.start_time !== "string") continue;
    rows.push({
      id: r.id,
      business_id: r.business_id as string,
      start_time: r.start_time,
      end_time: r.end_time as string,
      status: r.status as string,
      manage_token: r.manage_token as string,
      customer_id: (r.customer_id as string | null) ?? null,
      customer_name: (customer.name as string) ?? "",
      customer_phone: (customer.phone as string) ?? "",
      service_name: (service.name as string) ?? "",
    });
  }
  return rows;
}

/**
 * Runs one reminder pass. Safe to call repeatedly and concurrently:
 * idempotency + claiming are database-backed (see module docs).
 * Per-reminder failures are counted, never thrown.
 */
export async function runDueReminders(
  args: RunDueRemindersArgs = {},
): Promise<ReminderRunSummary> {
  const summary: ReminderRunSummary = { processed: 0, sent: 0, skipped: 0, failed: 0 };
  const db = args.db ?? getSupabase();
  const now = args.now ?? Date.now();
  const provider = args.provider ?? resolveNotificationProvider();

  const bookings = await fetchDueBookings(db, now);
  const settingsByBusiness = new Map<
    string,
    Awaited<ReturnType<typeof fetchBusinessNotificationSettings>>
  >();

  for (const booking of bookings) {
    if (!isReminderDue(booking.start_time, now)) continue;
    summary.processed += 1;

    let business: { id: string; name: string; timezone: string };
    try {
      business = await fetchBusiness(booking.business_id, db);
    } catch {
      continue;
    }
    let settings = settingsByBusiness.get(business.id);
    if (!settings) {
      settings = await fetchBusinessNotificationSettings(business.id, db);
      settingsByBusiness.set(business.id, settings);
    }

    try {
      const outcome = await deliverReminder({
        db,
        provider,
        booking,
        business,
        serviceName: booking.service_name,
        now,
        customerEnabled:
          settings.customer_notifications_enabled && settings.whatsapp_enabled,
      });
      summary[outcome] += 1;
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}

interface DeliverArgs {
  db: SupabaseClient;
  provider: NotificationProvider;
  booking: DueBooking;
  business: { id: string; name: string; timezone: string };
  serviceName: string;
  now: number;
  customerEnabled: boolean;
}

async function deliverReminder(args: DeliverArgs): Promise<"sent" | "skipped" | "failed"> {
  const { db, provider, booking, business, serviceName, now } = args;
  if (!args.customerEnabled) return "skipped";

  const eventId = reminderEventId(booking.id);

  const existing = await fetchNotificationRecord(
    { eventId, recipientType: "customer", channel: "whatsapp" },
    db,
  );
  if (existing && (existing.status === "sent" || existing.status === "skipped")) {
    return "skipped"; // Already delivered — reschedules never re-send.
  }

  // Ensure a row exists to claim (stable id → reschedules reuse it).
  let row = existing;
  if (!row) {
    const created = await createNotificationRecord(
      {
        eventId,
        bookingId: booking.id,
        businessId: business.id,
        customerId: booking.customer_id,
        eventType: "booking.reminder.1h",
        recipientType: "customer",
        channel: "whatsapp",
        destination: booking.customer_phone,
        status: "pending",
        provider: provider.name,
        metadata: { reminderType: "booking.reminder.1h", bookingStart: booking.start_time },
      },
      db,
    );
    if (!created.id) {
      row = await fetchNotificationRecord(
        { eventId, recipientType: "customer", channel: "whatsapp" },
        db,
      );
      if (!row) return "skipped";
    } else {
      row = await fetchNotificationRecord(
        { eventId, recipientType: "customer", channel: "whatsapp" },
        db,
      );
      if (!row) return "skipped";
    }
  }

  // Atomic claim: only the winner proceeds to send.
  const claimable =
    row.status === "processing"
      ? Date.parse(row.updated_at) < now - REMINDER_STALE_PROCESSING_MS
        ? (["processing"] as const)
        : null
      : (["pending", "failed"] as const);
  if (!claimable) return "skipped";
  const claim = await claimNotificationRow(
    row.id,
    { attemptCount: row.attempt_count, statuses: [...claimable] },
    db,
  );
  if (!claim.claimed) return "skipped";

  const metadata = { ...(row.metadata ?? {}), bookingStart: booking.start_time };

  let normalized: string;
  try {
    normalized = toE164(booking.customer_phone);
  } catch {
    await updateNotificationRecord(
      row.id,
      {
        status: "failed",
        errorCode: "INVALID_PHONE",
        errorMessage: "Customer phone number could not be normalized to E.164.",
        metadata,
      },
      db,
    );
    return "failed";
  }

  const ctx: TemplateContext = {
    businessName: business.name,
    businessTimezone: business.timezone,
    serviceName,
    customerName: booking.customer_name,
    customerPhone: booking.customer_phone,
    startIso: booking.start_time,
    endIso: booking.end_time,
    manageUrl: `${appBaseUrl()}/manage/${booking.manage_token}`,
  };

  const result = await provider.send({
    destination: normalized,
    body: buildReminderMessage(ctx),
    eventId,
    bookingId: booking.id,
    businessId: business.id,
    recipientType: "customer",
  });

  const patch: NotificationStatusPatch = {
    status: result.success ? "sent" : "failed",
    providerMessageId: result.providerMessageId ?? undefined,
    errorCode: result.errorCode ?? undefined,
    errorMessage: result.success ? null : result.errorCode ?? "UNKNOWN",
    sentAt: result.success ? new Date().toISOString() : undefined,
    metadata,
  };
  await updateNotificationRecord(row.id, patch, db);
  return result.success ? "sent" : "failed";
}
