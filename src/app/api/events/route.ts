import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { toApiErrorResponse } from "@/lib/server/route-helper";
import {
  deriveBrowser,
  deriveDevice,
  deriveSource,
  isMarketingEventName,
  sanitizeMarketingProps,
  scrubPathname,
} from "@/lib/marketing-attribution";

/**
 * POST /api/events
 *
 * Two independent streams, one integration point:
 *
 * 1. Booking funnel (existing, unchanged): allowlisted booking-flow
 *    events → `operations_events`. Answers "Is Kivo working?"
 * 2. Marketing analytics (kind: "marketing"): namespaced marketing
 *    events → `marketing_events`. Answers "Is the marketing working?"
 *
 * Both are privacy-conscious (no PII, tokens, or form contents) and
 * non-breaking (failures never surface to the frontend).
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

    // Marketing stream: namespaced taxonomy → marketing_events.
    if ((body as { kind?: string }).kind === "marketing") {
      return recordMarketingEvent(request, body as Record<string, unknown>);
    }

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

function siteHost(): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) return null;
  try {
    return new URL(site).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function referrerHost(referrer: unknown): string | null {
  if (typeof referrer !== "string" || referrer.length === 0) return null;
  try {
    return new URL(referrer).hostname.toLowerCase().slice(0, 200);
  } catch {
    return null;
  }
}

function textProp(value: unknown, max = 120): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Marketing stream receiver. Validates against the taxonomy, sanitizes
 * properties, derives acquisition source + device server-side (the client
 * never sends them), and stores in `marketing_events`. Always resolves —
 * analytics failure must never break the frontend.
 */
async function recordMarketingEvent(
  request: Request,
  body: Record<string, unknown>,
): Promise<NextResponse> {
  try {
    const { eventName, sessionId } = body as {
      eventName?: string;
      sessionId?: string;
    };
    if (!isMarketingEventName(eventName)) {
      return NextResponse.json({ error: "Unknown event name." }, { status: 400 });
    }
    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 64) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    const pathname = scrubPathname(body.pathname);
    const refHost = referrerHost(body.referrer);
    const utmSource = textProp(body.utmSource);
    const source = deriveSource({
      utmSource,
      referrer: typeof body.referrer === "string" ? body.referrer : null,
      siteHost: siteHost(),
    });
    const userAgent = request.headers.get("user-agent");

    const db = getSupabase();
    const { error } = await db.from("marketing_events").insert({
      event_name: eventName,
      session_id: sessionId.slice(0, 64),
      pathname,
      referrer: refHost,
      utm_source: utmSource,
      utm_medium: textProp(body.utmMedium),
      utm_campaign: textProp(body.utmCampaign),
      utm_content: textProp(body.utmContent),
      utm_term: textProp(body.utmTerm),
      source,
      device: deriveDevice(userAgent),
      browser: deriveBrowser(userAgent),
      metadata: sanitizeMarketingProps(
        body.metadata as Record<string, unknown> | undefined,
      ),
    });

    if (error) {
      console.error("[events] failed to record marketing event:", error.message);
      // Non-throwing: never break the frontend.
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
