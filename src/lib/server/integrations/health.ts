/**
 * Integration health computation for Kivo.
 *
 * Derives real health status from actual operational state:
 *   - Google Calendar: active connection row + absence of recent auth failures
 *   - Messaging (WhatsApp): notification settings + recent notification records
 *   - Reminder scheduler: recency of reminder_scheduler_run operations events
 *
 * Health thresholds are explicit constants documented below.
 * Nothing here exposes tokens, secrets, or raw provider data.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/server";
import { getActiveConnection } from "@/lib/server/google-calendar/repository";
import { fetchBusinessNotificationSettings } from "@/lib/server/notifications/records";

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/**
 * Calendar: a business is considered to have a meaningful calendar auth
 * failure if any `calendar` category event with severity `technical` (i.e.
 * auth/token problem) appears within this window.
 */
const CALENDAR_FAILURE_WINDOW_MS = 24 * 60 * 60_000; // 24 hours

/**
 * Messaging: "Needs attention" if there are notification failures more recent
 * than any successful send within this window.
 */
const MESSAGING_FAILURE_WINDOW_MS = 24 * 60 * 60_000; // 24 hours

/**
 * Messaging: the maximum number of recent notification failures shown to the
 * business owner.
 */
export const MESSAGING_RECENT_FAILURE_LIMIT = 5;

/**
 * Reminder scheduler: "Healthy" only when a `reminder_scheduler_run` event
 * was recorded within this many milliseconds of now.
 *
 * Cron runs every 5 minutes; we allow 15 minutes (3× the cron interval)
 * to tolerate normal execution jitter and a single missed run.
 */
export const SCHEDULER_HEALTHY_THRESHOLD_MS = 15 * 60_000; // 15 minutes

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type HealthStatus = "healthy" | "needs_attention" | "not_connected" | "disabled";

export interface CalendarHealth {
  status: HealthStatus;
  /** Safe: only account email and calendar id — never tokens. */
  accountEmail: string | null;
  calendarId: string | null;
  requiresReconnect: boolean;
  lastFailureAt: string | null;
}

export interface MessagingHealth {
  status: HealthStatus;
  enabled: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  recentFailureCount: number;
  recentFailures: RecentNotificationFailure[];
}

export interface RecentNotificationFailure {
  at: string;
  /** Human-readable type, e.g. "Booking reminder" */
  type: string;
  /** Human-readable reason, e.g. "Provider unavailable" — never raw error codes */
  reason: string;
}

export interface SchedulerHealth {
  status: HealthStatus;
  lastRunAt: string | null;
  /** A scheduler run with zero eligible reminders is still healthy. */
  lastRunProcessed: number | null;
}

export interface IntegrationHealth {
  calendar: CalendarHealth;
  messaging: MessagingHealth;
  scheduler: SchedulerHealth;
  /** ISO timestamp this health snapshot was computed. */
  computedAt: string;
}

// ---------------------------------------------------------------------------
// Label helpers (owner-safe copy, no raw error codes)
// ---------------------------------------------------------------------------

const EVENT_TYPE_LABELS: Record<string, string> = {
  "booking.created": "Booking confirmation",
  "booking.rescheduled": "Reschedule notification",
  "booking.cancelled": "Cancellation notification",
  "booking.reminder.1h": "Booking reminder",
  "booking.reminder.24h": "Booking reminder",
  "booking.reminder.2h": "Booking reminder",
};

function eventTypeLabel(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] ?? "Notification";
}

const ERROR_CODE_LABELS: Record<string, string> = {
  INVALID_PHONE: "Invalid customer phone number",
  BAILEYS_AUTH_FAILED: "Messaging service not authenticated",
  BAILEYS_SESSION_NOT_READY: "Messaging session not ready",
  BAILEYS_UNAVAILABLE: "Messaging service unavailable",
  BAILEYS_SEND_FAILED: "Delivery failed",
  OPENWA_AUTH_FAILED: "Messaging service not authenticated",
  OPENWA_SESSION_NOT_READY: "Messaging session not ready",
  OPENWA_UNAVAILABLE: "Messaging service unavailable",
  OPENWA_SEND_FAILED: "Delivery failed",
};

function errorCodeLabel(errorCode: string | null): string {
  if (!errorCode) return "Unknown reason";
  return ERROR_CODE_LABELS[errorCode] ?? "Delivery failed";
}

// ---------------------------------------------------------------------------
// Calendar health
// ---------------------------------------------------------------------------

async function computeCalendarHealth(
  businessId: string,
  db: SupabaseClient,
): Promise<CalendarHealth> {
  const connection = await getActiveConnection(businessId, db).catch(() => null);
  if (!connection) {
    return {
      status: "not_connected",
      accountEmail: null,
      calendarId: null,
      requiresReconnect: false,
      lastFailureAt: null,
    };
  }

  // Look for recent technical calendar failures for this business.
  const since = new Date(Date.now() - CALENDAR_FAILURE_WINDOW_MS).toISOString();
  const { data: failureRows } = await db
    .from("operations_events")
    .select("created_at")
    .eq("business_id", businessId)
    .eq("category", "calendar")
    .eq("severity", "technical")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);

  const lastFailureAt =
    Array.isArray(failureRows) && failureRows.length > 0
      ? (failureRows[0] as Record<string, string>).created_at
      : null;

  const status =
    connection.refreshToken === null
      ? "needs_attention"
      : lastFailureAt !== null
        ? "needs_attention"
        : "healthy";

  return {
    status,
    // Safe: only email and calendarId — never refresh/access tokens
    accountEmail: connection.googleAccountEmail,
    calendarId: connection.calendarId,
    requiresReconnect: connection.refreshToken === null,
    lastFailureAt,
  };
}

// ---------------------------------------------------------------------------
// Messaging health
// ---------------------------------------------------------------------------

async function computeMessagingHealth(
  businessId: string,
  db: SupabaseClient,
): Promise<MessagingHealth> {
  const settings = await fetchBusinessNotificationSettings(businessId, db).catch(
    () => null,
  );

  if (
    !settings ||
    !settings.customer_notifications_enabled ||
    !settings.whatsapp_enabled
  ) {
    return {
      status: "disabled",
      enabled: false,
      lastSuccessAt: null,
      lastFailureAt: null,
      recentFailureCount: 0,
      recentFailures: [],
    };
  }

  const since = new Date(Date.now() - MESSAGING_FAILURE_WINDOW_MS).toISOString();

  // Last successful customer notification for this business
  const { data: successRows } = await db
    .from("notifications")
    .select("sent_at, event_type")
    .eq("business_id", businessId)
    .eq("recipient_type", "customer")
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(1);

  const lastSuccessAt =
    Array.isArray(successRows) && successRows.length > 0
      ? (successRows[0] as Record<string, string | null>).sent_at
      : null;

  // Recent failures for this business (customer only, last 24h)
  const { data: failureRows } = await db
    .from("notifications")
    .select("created_at, event_type, error_code")
    .eq("business_id", businessId)
    .eq("recipient_type", "customer")
    .eq("status", "failed")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MESSAGING_RECENT_FAILURE_LIMIT + 1);

  const rawFailures = Array.isArray(failureRows) ? (failureRows as Array<Record<string, string | null>>) : [];
  const recentFailureCount = rawFailures.length;
  const recentFailures: RecentNotificationFailure[] = rawFailures
    .slice(0, MESSAGING_RECENT_FAILURE_LIMIT)
    .map((r) => ({
      at: r.created_at ?? "",
      type: eventTypeLabel(r.event_type ?? ""),
      reason: errorCodeLabel(r.error_code ?? null),
    }));

  // Healthy if enabled and no recent failures, or last success is more recent than last failure
  const lastFailureAt = recentFailures[0]?.at ?? null;
  const status: HealthStatus =
    recentFailureCount > 0 &&
    (lastSuccessAt === null || (lastFailureAt !== null && lastFailureAt > lastSuccessAt))
      ? "needs_attention"
      : "healthy";

  return {
    status,
    enabled: true,
    lastSuccessAt: lastSuccessAt ?? null,
    lastFailureAt,
    recentFailureCount,
    recentFailures,
  };
}

// ---------------------------------------------------------------------------
// Scheduler health
// ---------------------------------------------------------------------------

async function computeSchedulerHealth(db: SupabaseClient): Promise<SchedulerHealth> {
  const threshold = new Date(Date.now() - SCHEDULER_HEALTHY_THRESHOLD_MS).toISOString();

  const { data: runRows } = await db
    .from("operations_events")
    .select("created_at, metadata")
    .eq("event_name", "reminder_scheduler_run")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!Array.isArray(runRows) || runRows.length === 0) {
    return { status: "needs_attention", lastRunAt: null, lastRunProcessed: null };
  }

  const row = runRows[0] as Record<string, unknown>;
  const lastRunAt = row.created_at as string;
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const lastRunProcessed =
    typeof meta.processed === "number" ? meta.processed : null;

  const status = lastRunAt >= threshold ? "healthy" : "needs_attention";

  return { status, lastRunAt, lastRunProcessed };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the full integration health snapshot for a single business.
 * All data comes from existing operational records — no new tables needed.
 */
export async function getIntegrationHealth(
  businessId: string,
  db?: SupabaseClient,
): Promise<IntegrationHealth> {
  const client = db ?? getSupabase();
  const [calendar, messaging, scheduler] = await Promise.all([
    computeCalendarHealth(businessId, client),
    computeMessagingHealth(businessId, client),
    computeSchedulerHealth(client),
  ]);
  return { calendar, messaging, scheduler, computedAt: new Date().toISOString() };
}

/**
 * Cross-business integration health summary for the admin console.
 * Returns one row per business — safe, no tokens.
 */
export interface BusinessIntegrationSummary {
  businessId: string;
  businessName: string;
  businessSlug: string | null;
  isDemo: boolean;
  isActive: boolean;
  calendar: Pick<CalendarHealth, "status" | "accountEmail">;
  messaging: Pick<MessagingHealth, "status" | "recentFailureCount">;
  scheduler: Pick<SchedulerHealth, "status" | "lastRunAt">;
}

export async function getAllBusinessIntegrationHealth(
  db?: SupabaseClient,
): Promise<BusinessIntegrationSummary[]> {
  const client = db ?? getSupabase();

  // Fetch all businesses
  const { data: businesses } = await client
    .from("businesses")
    .select("id, name, slug, is_demo, is_active")
    .order("name", { ascending: true });

  if (!Array.isArray(businesses) || businesses.length === 0) return [];

  // Scheduler health is platform-wide (one scheduler serves all)
  const scheduler = await computeSchedulerHealth(client);

  const results: BusinessIntegrationSummary[] = await Promise.all(
    (businesses as Array<Record<string, unknown>>).map(async (biz) => {
      const businessId = biz.id as string;
      const [cal, msg] = await Promise.all([
        computeCalendarHealth(businessId, client),
        computeMessagingHealth(businessId, client),
      ]);
      return {
        businessId,
        businessName: biz.name as string,
        businessSlug: (biz.slug as string | null) ?? null,
        isDemo: biz.is_demo === true,
        isActive: biz.is_active === true,
        calendar: { status: cal.status, accountEmail: cal.accountEmail },
        messaging: { status: msg.status, recentFailureCount: msg.recentFailureCount },
        scheduler: { status: scheduler.status, lastRunAt: scheduler.lastRunAt },
      };
    }),
  );

  return results;
}

// ---------------------------------------------------------------------------
// Relative time helper (safe for server-rendered output)
// ---------------------------------------------------------------------------

export function relativeTime(isoOrNull: string | null, nowMs: number = Date.now()): string {
  if (!isoOrNull) return "Never";
  const ms = nowMs - Date.parse(isoOrNull);
  if (!Number.isFinite(ms) || ms < 0) return "Just now";
  if (ms < 60_000) return "Just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(isoOrNull).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
