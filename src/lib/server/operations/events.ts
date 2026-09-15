/**
 * Booking funnel and operations event tracking.
 *
 * Privacy-conscious: no passwords, tokens, OAuth credentials, or
 * unnecessary customer PII are stored in events.
 *
 * The attempt_id is a correlation identifier for funnel sequences.
 * It grants no access and is never a manage token or auth token.
 */
import { randomUUID } from "node:crypto";
import { getSupabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateEventInput, ErrorCode, OperationsEvent } from "./types";

/**
 * Generate a safe correlation ID for a booking attempt.
 * Format: `attempt_{uuid}` — grants no access, contains no tokens.
 */
export function generateAttemptId(): string {
  return `attempt_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/**
 * Record an operations event. Non-throwing: failures are silently logged
 * to console and never break the booking flow.
 */
export async function recordEvent(
  input: CreateEventInput,
  db?: SupabaseClient,
): Promise<OperationsEvent | null> {
  try {
    const client = db ?? getSupabase();
    const { data, error } = await client
      .from("operations_events")
      .insert({
        event_name: input.eventName,
        category: input.category,
        business_id: input.businessId ?? null,
        booking_id: input.bookingId ?? null,
        attempt_id: input.attemptId,
        severity: input.severity ?? null,
        error_code: input.errorCode ?? null,
        provider: input.provider ?? null,
        metadata: input.metadata ?? {},
      })
      .select()
      .single();
    if (error) {
      console.error("[operations] failed to record event:", error.message);
      return null;
    }
    return data as OperationsEvent;
  } catch (err) {
    console.error("[operations] unexpected error recording event:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Convenience wrappers for common event patterns
// ---------------------------------------------------------------------------

export function recordFunnelEvent(
  eventName: string,
  attemptId: string,
  businessId?: string,
  bookingId?: string,
  metadata?: Record<string, unknown>,
  db?: SupabaseClient,
): Promise<OperationsEvent | null> {
  return recordEvent(
    {
      eventName,
      category: "funnel",
      businessId,
      bookingId,
      attemptId,
      metadata,
    },
    db,
  );
}

export function recordFailure(
  eventName: string,
  errorCode: ErrorCode,
  severity: "expected" | "technical",
  attemptId: string,
  businessId?: string,
  bookingId?: string,
  provider?: string,
  metadata?: Record<string, unknown>,
  db?: SupabaseClient,
): Promise<OperationsEvent | null> {
  return recordEvent(
    {
      eventName,
      category: "failure",
      businessId,
      bookingId,
      attemptId,
      severity,
      errorCode,
      provider,
      metadata,
    },
    db,
  );
}

export function recordNotificationEvent(
  eventName: string,
  businessId: string,
  bookingId: string,
  provider: string,
  success: boolean,
  errorCode?: string,
  metadata?: Record<string, unknown>,
  db?: SupabaseClient,
): Promise<OperationsEvent | null> {
  return recordEvent(
    {
      eventName,
      category: "notification",
      businessId,
      bookingId,
      attemptId: `notif_${bookingId}`,
      provider,
      severity: success ? undefined : "technical",
      errorCode: errorCode as CreateEventInput["errorCode"],
      metadata,
    },
    db,
  );
}

export function recordCalendarEvent(
  eventName: string,
  businessId: string,
  bookingId: string,
  success: boolean,
  errorCode?: string,
  metadata?: Record<string, unknown>,
  db?: SupabaseClient,
): Promise<OperationsEvent | null> {
  return recordEvent(
    {
      eventName,
      category: "calendar",
      businessId,
      bookingId,
      attemptId: `cal_${bookingId}`,
      severity: success ? undefined : "technical",
      errorCode: errorCode as CreateEventInput["errorCode"],
      metadata,
    },
    db,
  );
}

export function recordReminderEvent(
  eventName: string,
  businessId: string,
  bookingId: string,
  success: boolean,
  errorCode?: string,
  metadata?: Record<string, unknown>,
  db?: SupabaseClient,
): Promise<OperationsEvent | null> {
  return recordEvent(
    {
      eventName,
      category: "reminder",
      businessId,
      bookingId,
      attemptId: `rem_${bookingId}`,
      severity: success ? undefined : "technical",
      errorCode: errorCode as CreateEventInput["errorCode"],
      metadata,
    },
    db,
  );
}
