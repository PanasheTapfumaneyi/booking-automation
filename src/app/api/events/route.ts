import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { toApiErrorResponse } from "@/lib/server/route-helper";

/**
 * POST /api/events
 *
 * Lightweight first-party funnel event tracking. Privacy-conscious:
 * - No customer PII (phone, email, name) is stored.
 * - Only booking-flow progression events are tracked.
 * - The attempt_id is a random correlation ID, not a token.
 *
 * Protected: requires a valid Supabase session (anonymous or authenticated).
 */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { eventName, businessId, attemptId, metadata } = body as {
      eventName?: string;
      businessId?: string;
      attemptId?: string;
      metadata?: Record<string, unknown>;
    };

    // Validate required fields.
    if (!eventName || typeof eventName !== "string") {
      return NextResponse.json({ error: "eventName is required." }, { status: 400 });
    }
    if (!attemptId || typeof attemptId !== "string") {
      return NextResponse.json({ error: "attemptId is required." }, { status: 400 });
    }

    // Allowlist of frontend funnel events.
    const ALLOWED_EVENTS = new Set([
      "business_page_viewed",
      "booking_started",
      "offering_selected",
      "date_selected",
      "time_selected",
      "customer_details_started",
    ]);
    if (!ALLOWED_EVENTS.has(eventName)) {
      return NextResponse.json({ error: "Unknown event name." }, { status: 400 });
    }

    // Sanitize metadata: strip any PII-like keys.
    const safeMetadata: Record<string, unknown> = {};
    const BLOCKED_KEYS = new Set([
      "phone", "email", "name", "customer_name", "customer_phone",
      "customer_email", "token", "manage_token", "auth_token",
      "password", "secret", "api_key",
    ]);
    if (metadata && typeof metadata === "object") {
      for (const [k, v] of Object.entries(metadata)) {
        if (!BLOCKED_KEYS.has(k.toLowerCase())) {
          safeMetadata[k] = v;
        }
      }
    }

    const db = getSupabase();
    const { error } = await db.from("operations_events").insert({
      event_name: eventName,
      category: "funnel",
      business_id: businessId ?? null,
      booking_id: null,
      attempt_id: attemptId,
      metadata: safeMetadata,
    });

    if (error) {
      console.error("[events] failed to record frontend event:", error.message);
      // Non-throwing: never break the frontend.
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
