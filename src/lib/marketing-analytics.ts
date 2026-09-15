"use client";

/**
 * First-party marketing analytics client.
 *
 * - Same-origin POST to /api/events (ad-block resistant, no third party).
 * - Anonymous session id in localStorage (random, rotated after 30 min
 *   inactivity). First-party only, no cookies, no cross-site tracking.
 * - First-touch UTM + referrer captured once per session for acquisition
 *   attribution.
 * - Fire-and-forget: sendBeacon (falls back to keepalive fetch). Every
 *   failure path is swallowed — analytics can never break navigation,
 *   signup, onboarding, or booking.
 * - Disabled on localhost and honours NEXT_PUBLIC_ANALYTICS_ENABLED.
 */
import { useEffect, useRef } from "react";
import {
  isMarketingEventName,
  sanitizeMarketingProps,
  type MarketingEventName,
} from "@/lib/marketing-attribution";

const SESSION_KEY = "kivo_mkt_session";
const SESSION_TTL_MS = 30 * 60 * 1000;

interface SessionState {
  id: string;
  lastSeen: number;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
}

function randomId(): string {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

function readParams(): Pick<
  SessionState,
  "utmSource" | "utmMedium" | "utmCampaign" | "utmContent" | "utmTerm"
> {
  const empty = { utmSource: "", utmMedium: "", utmCampaign: "", utmContent: "", utmTerm: "" };
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      utmSource: (params.get("utm_source") ?? "").slice(0, 120),
      utmMedium: (params.get("utm_medium") ?? "").slice(0, 120),
      utmCampaign: (params.get("utm_campaign") ?? "").slice(0, 120),
      utmContent: (params.get("utm_content") ?? "").slice(0, 120),
      utmTerm: (params.get("utm_term") ?? "").slice(0, 120),
    };
  } catch {
    return empty;
  }
}

/** Current anonymous session, creating/rotating as needed. Null outside browsers. */
export function getMarketingSession(): SessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    const now = Date.now();
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SessionState>;
      if (
        typeof parsed.id === "string" &&
        parsed.id.length > 0 &&
        typeof parsed.lastSeen === "number" &&
        now - parsed.lastSeen < SESSION_TTL_MS
      ) {
        const refreshed: SessionState = {
          id: parsed.id,
          lastSeen: now,
          referrer: typeof parsed.referrer === "string" ? parsed.referrer : "",
          utmSource: typeof parsed.utmSource === "string" ? parsed.utmSource : "",
          utmMedium: typeof parsed.utmMedium === "string" ? parsed.utmMedium : "",
          utmCampaign: typeof parsed.utmCampaign === "string" ? parsed.utmCampaign : "",
          utmContent: typeof parsed.utmContent === "string" ? parsed.utmContent : "",
          utmTerm: typeof parsed.utmTerm === "string" ? parsed.utmTerm : "",
        };
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(refreshed));
        return refreshed;
      }
    }
    const fresh: SessionState = {
      id: randomId(),
      lastSeen: now,
      referrer: typeof document !== "undefined" ? document.referrer.slice(0, 500) : "",
      ...readParams(),
    };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
    return fresh;
  } catch {
    return null;
  }
}

/** Whether marketing events may be sent in this environment. */
export function isMarketingAnalyticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return false;
    const override = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED;
    if (override === "false") return false;
    if (override === "true") return true;
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (site) {
      try {
        return new URL(site).hostname === host;
      } catch {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Track one marketing event. Validates the name against the taxonomy,
 * sanitizes properties, and sends without blocking. Never throws.
 */
export function trackMarketingEvent(
  eventName: string,
  props?: Record<string, unknown>,
): void {
  try {
    if (!isMarketingEventName(eventName)) return;
    if (!isMarketingAnalyticsEnabled()) return;
    const session = getMarketingSession();
    if (!session) return;
    const body = JSON.stringify({
      kind: "marketing",
      eventName,
      sessionId: session.id,
      pathname: window.location.pathname,
      referrer: session.referrer || undefined,
      utmSource: session.utmSource || undefined,
      utmMedium: session.utmMedium || undefined,
      utmCampaign: session.utmCampaign || undefined,
      utmContent: session.utmContent || undefined,
      utmTerm: session.utmTerm || undefined,
      metadata: sanitizeMarketingProps(props),
    });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    // Analytics must never break the product.
  }
}

/**
 * Fire once when the referenced element first scrolls into view
 * (e.g. the Pricing section). Cleans up after firing.
 */
export function useViewedOnce(
  eventName: MarketingEventName,
  props?: Record<string, unknown>,
): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  const fired = useRef(false);
  // Serialized props keep the effect stable across renders (callers pass
  // fresh object literals) while still sending the latest values.
  const propsKey = JSON.stringify(props ?? {});
  useEffect(() => {
    const el = ref.current;
    if (!el || fired.current) return;
    const currentProps = JSON.parse(propsKey) as Record<string, unknown>;
    if (typeof IntersectionObserver === "undefined") {
      fired.current = true;
      trackMarketingEvent(eventName, currentProps);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !fired.current) {
          fired.current = true;
          trackMarketingEvent(eventName, currentProps);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [eventName, propsKey]);
  return ref;
}
