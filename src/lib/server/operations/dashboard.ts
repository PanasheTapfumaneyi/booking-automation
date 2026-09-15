/**
 * Dashboard queries for the Kivo operations page.
 *
 * All queries are read-only and scoped to a time window.
 * No sensitive data (tokens, credentials, PII) is exposed.
 */
import { getSupabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OperationsSummary,
  BusinessHealth,
  FunnelStep,
  RecentFailure,
} from "./types";

/** Default lookback period: 24 hours. */
const HOURS_24_MS = 24 * 60 * 60 * 1000;

/**
 * Global operations summary for the last 24 hours.
 */
export async function getOperationsSummary(
  db?: SupabaseClient,
): Promise<OperationsSummary> {
  const client = db ?? getSupabase();
  const since = new Date(Date.now() - HOURS_24_MS).toISOString();

  // Funnel counts
  const funnelEvents = await client
    .from("operations_events")
    .select("event_name")
    .eq("category", "funnel")
    .gte("created_at", since);

  const funnel = funnelEvents.data ?? [];
  const bookingAttempts = funnel.filter(
    (e) => e.event_name === "business_page_viewed",
  ).length;
  const submitAttempts = funnel.filter(
    (e) => e.event_name === "booking_submit_attempted",
  ).length;
  const bookingsCreated = funnel.filter(
    (e) => e.event_name === "booking_created",
  ).length;
  const bookingsFailed = funnel.filter(
    (e) => e.event_name === "booking_failed",
  ).length;

  // Failure counts
  const failures = await client
    .from("operations_events")
    .select("severity")
    .eq("category", "failure")
    .gte("created_at", since);

  const failureRows = failures.data ?? [];
  const expectedConflicts = failureRows.filter(
    (f) => f.severity === "expected",
  ).length;
  const technicalFailures = failureRows.filter(
    (f) => f.severity === "technical",
  ).length;

  // Notification counts
  const notifs = await client
    .from("operations_events")
    .select("event_name")
    .eq("category", "notification")
    .gte("created_at", since);

  const notifRows = notifs.data ?? [];
  const notificationsSent = notifRows.filter(
    (n) => n.event_name === "notification_sent",
  ).length;
  const notificationsFailed = notifRows.filter(
    (n) => n.event_name === "notification_failed",
  ).length;

  // Calendar counts
  const cals = await client
    .from("operations_events")
    .select("event_name")
    .eq("category", "calendar")
    .gte("created_at", since);

  const calRows = cals.data ?? [];
  const calendarSyncsSuccessful = calRows.filter(
    (c) => c.event_name === "calendar_synced",
  ).length;
  const calendarSyncsFailed = calRows.filter(
    (c) => c.event_name === "calendar_sync_failed",
  ).length;

  // Reminder counts
  const rems = await client
    .from("operations_events")
    .select("event_name")
    .eq("category", "reminder")
    .gte("created_at", since);

  const remRows = rems.data ?? [];
  const remindersSent = remRows.filter(
    (r) => r.event_name === "reminder_sent",
  ).length;
  const remindersFailed = remRows.filter(
    (r) => r.event_name === "reminder_failed",
  ).length;

  const submitSuccessRate =
    submitAttempts > 0
      ? Math.round((bookingsCreated / submitAttempts) * 1000) / 10
      : 0;

  return {
    period: "Last 24 hours",
    bookingAttempts,
    submitAttempts,
    bookingsCreated,
    bookingsFailed,
    expectedConflicts,
    technicalFailures,
    submitSuccessRate,
    notificationsSent,
    notificationsFailed,
    calendarSyncsSuccessful,
    calendarSyncsFailed,
    remindersDue: submitAttempts, // approximate
    remindersSent,
    remindersFailed,
  };
}

/**
 * Per-business health for the last 24 hours.
 */
export async function getBusinessHealth(
  db?: SupabaseClient,
): Promise<BusinessHealth[]> {
  const client = db ?? getSupabase();
  const since = new Date(Date.now() - HOURS_24_MS).toISOString();

  // Get all businesses with events
  const events = await client
    .from("operations_events")
    .select("business_id, event_name, category, severity")
    .not("business_id", "is", null)
    .gte("created_at", since);

  const rows = events.data ?? [];

  // Group by business
  const byBusiness = new Map<string, BusinessHealth>();

  for (const row of rows) {
    const bid = row.business_id as string;
    if (!byBusiness.has(bid)) {
      byBusiness.set(bid, {
        businessId: bid,
        businessName: bid, // will resolve below
        bookingAttempts: 0,
        submitAttempts: 0,
        completed: 0,
        technicalFailures: 0,
        notificationFailures: 0,
        calendarFailures: 0,
      });
    }
    const h = byBusiness.get(bid)!;
    if (row.category === "funnel") {
      if (row.event_name === "business_page_viewed") h.bookingAttempts++;
      if (row.event_name === "booking_submit_attempted") h.submitAttempts++;
      if (row.event_name === "booking_created") h.completed++;
    }
    if (row.category === "failure" && row.severity === "technical") {
      h.technicalFailures++;
    }
    if (row.category === "notification" && row.event_name === "notification_failed") {
      h.notificationFailures++;
    }
    if (row.category === "calendar" && row.event_name === "calendar_sync_failed") {
      h.calendarFailures++;
    }
  }

  // Resolve business names
  const businessIds = [...byBusiness.keys()];
  if (businessIds.length > 0) {
    const businesses = await client
      .from("businesses")
      .select("id, name")
      .in("id", businessIds);
    for (const b of businesses.data ?? []) {
      const h = byBusiness.get(b.id);
      if (h) h.businessName = b.name;
    }
  }

  return [...byBusiness.values()];
}

/**
 * Booking funnel breakdown for the last 24 hours.
 */
export async function getBookingFunnel(
  db?: SupabaseClient,
): Promise<FunnelStep[]> {
  const client = db ?? getSupabase();
  const since = new Date(Date.now() - HOURS_24_MS).toISOString();

  const events = await client
    .from("operations_events")
    .select("event_name")
    .eq("category", "funnel")
    .gte("created_at", since);

  const rows = events.data ?? [];

  const steps = [
    "business_page_viewed",
    "booking_started",
    "offering_selected",
    "date_selected",
    "time_selected",
    "customer_details_started",
    "booking_submit_attempted",
    "booking_created",
    "booking_failed",
  ];

  const counts = steps.map((step) => ({
    step,
    count: rows.filter((r) => r.event_name === step).length,
  }));

  const maxCount = Math.max(...counts.map((c) => c.count), 1);

  return counts.map((c) => ({
    step: c.step.replace(/_/g, " "),
    count: c.count,
    percentage: Math.round((c.count / maxCount) * 100),
  }));
}

/**
 * Recent failures for the last 24 hours (max 50).
 */
export async function getRecentFailures(
  db?: SupabaseClient,
): Promise<RecentFailure[]> {
  const client = db ?? getSupabase();
  const since = new Date(Date.now() - HOURS_24_MS).toISOString();

  const events = await client
    .from("operations_events")
    .select("id, created_at, business_id, event_name, error_code, category, severity, provider, metadata")
    .eq("category", "failure")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = events.data ?? [];

  // Resolve business names
  const businessIds = [...new Set(rows.map((r) => r.business_id).filter(Boolean))];
  const businessNameMap = new Map<string, string>();
  if (businessIds.length > 0) {
    const businesses = await client
      .from("businesses")
      .select("id, name")
      .in("id", businessIds);
    for (const b of businesses.data ?? []) {
      businessNameMap.set(b.id, b.name);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    timestamp: r.created_at,
    businessId: r.business_id,
    businessName: r.business_id ? businessNameMap.get(r.business_id) ?? null : null,
    eventName: r.event_name,
    errorCode: r.error_code,
    category: r.category,
    severity: r.severity,
    provider: r.provider,
    metadata: (typeof r.metadata === "object" && r.metadata !== null ? r.metadata : {}) as Record<string, unknown>,
  }));
}
