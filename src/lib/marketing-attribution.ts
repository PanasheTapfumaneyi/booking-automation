/**
 * Marketing analytics attribution + sanitization (pure — no browser or
 * server dependencies, fully unit-testable).
 *
 * Privacy rules enforced here:
 * - Only pathname is ever recorded (query strings are dropped: they can
 *   carry tokens, emails, and search terms).
 * - Paths under /manage/* (token-bearing) are scrubbed to "/manage".
 * - Metadata keys that smell like credentials, tokens, or contact PII
 *   are stripped, as are suspiciously token-shaped values.
 */

/** Event taxonomy. Marketing events are namespaced; booking-funnel names live elsewhere. */
export const MARKETING_EVENTS = [
  "marketing_page_viewed",
  "featured_business_clicked",
  "pricing_viewed",
  "start_free_clicked",
  "see_how_it_works_clicked",
  "contact_clicked",
  "signup_started",
  "signup_completed",
  "plan_selected",
  "business_details_submitted",
  "setup_choice_viewed",
  "managed_setup_selected",
  "self_setup_selected",
  "onboarding_completed",
  "temporary_business_page_viewed",
] as const;

export type MarketingEventName = (typeof MARKETING_EVENTS)[number];

export function isMarketingEventName(value: unknown): value is MarketingEventName {
  return (
    typeof value === "string" &&
    (MARKETING_EVENTS as readonly string[]).includes(value)
  );
}

/** Keys that must never reach analytics storage. */
const BLOCKED_KEYS = new Set([
  "password",
  "token",
  "manage_token",
  "auth_token",
  "access_token",
  "refresh_token",
  "secret",
  "api_key",
  "apikey",
  "authorization",
  "phone",
  "email",
  "name",
  "customer_name",
  "customer_phone",
  "customer_email",
  "whatsapp_number",
  "contact_number",
  "card",
  "cvv",
]);

/** Values shaped like tokens/secrets are dropped regardless of key. */
function looksLikeSecret(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  // Long opaque strings (UUIDs, JWTs, manage tokens) or Bearer material.
  if (/^[A-Za-z0-9_-]{32,}$/.test(v)) return true;
  if (v.includes(".")) {
    const parts = v.split(".");
    if (parts.length === 3 && parts.every((p) => /^[A-Za-z0-9_-]{8,}$/.test(p))) return true;
  }
  if (/^Bearer\s+/i.test(v)) return true;
  // A long hex run anywhere (token fragment inside a URL or id).
  if (/[0-9a-f]{16,}/i.test(v)) return true;
  return false;
}

/** Strip PII/secret-like entries from event properties. */
export function sanitizeMarketingProps(
  props: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!props || typeof props !== "object") return out;
  for (const [key, value] of Object.entries(props)) {
    if (BLOCKED_KEYS.has(key.toLowerCase())) continue;
    if (looksLikeSecret(value)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Keep only the pathname (drop query/hash), and scrub token-bearing
 * manage URLs down to "/manage".
 */
export function scrubPathname(pathname: unknown): string | null {
  if (typeof pathname !== "string" || pathname.length === 0) return null;
  const path = pathname.split("?")[0].split("#")[0] || "/";
  if (path === "/manage" || path.startsWith("/manage/")) return "/manage";
  return path.slice(0, 200);
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Derive an acquisition source. Prefers explicit UTM, otherwise maps a
 * known referrer host. Returns "direct" only when there is genuinely
 * nothing to attribute (empty referrer); returns "other" for unknown
 * referrers/hosts rather than guessing.
 */
export function deriveSource(input: {
  utmSource?: string | null;
  referrer?: string | null;
  siteHost?: string | null;
}): string {
  const utm = (input.utmSource ?? "").trim().toLowerCase();
  if (utm) {
    if (utm.includes("instagram")) return "instagram";
    if (utm.includes("facebook") || utm === "fb" || utm.includes("meta")) return "facebook";
    if (utm.includes("whatsapp") || utm === "wa") return "whatsapp";
    if (utm.includes("google")) return "google";
    if (utm.includes("tiktok")) return "tiktok";
    if (utm === "x" || utm.includes("twitter")) return "twitter";
    if (utm.includes("linkedin")) return "linkedin";
    if (utm.includes("youtube")) return "youtube";
    return "other";
  }
  const ref = (input.referrer ?? "").trim();
  if (!ref) return "direct";
  const host = hostOf(ref);
  if (!host) return "other";
  if (input.siteHost && host === input.siteHost.toLowerCase()) return "direct";
  if (host.includes("instagram.")) return "instagram";
  if (host.includes("facebook.") || host === "fb.me" || host.includes("fb.")) return "facebook";
  if (host.includes("whatsapp.")) return "whatsapp";
  if (host.includes("google.") || host.includes("googleusercontent.")) return "google";
  if (host.includes("bing.")) return "search";
  if (host.includes("duckduckgo.")) return "search";
  if (host.includes("tiktok.")) return "tiktok";
  if (host.includes("twitter.") || host === "x.com" || host.endsWith(".x.com")) return "twitter";
  if (host.includes("linkedin.")) return "linkedin";
  if (host.includes("youtube.") || host.includes("youtu.be")) return "youtube";
  return "other";
}

export type DeviceKind = "mobile" | "tablet" | "desktop";

/** Coarse device class from a User-Agent string. No fingerprinting. */
export function deriveDevice(userAgent: string | null | undefined): DeviceKind {
  if (!userAgent) return "desktop";
  const ua = userAgent.toLowerCase();
  if (/\bipad\b/.test(ua) || /\btablet\b/.test(ua)) return "tablet";
  // Android tablets report "mobile"? No — Android phones report "mobile",
  // Android tablets don't. Kindle/Silk tablets:
  if (/silk|kindle|playbook/.test(ua) && !/mobile/.test(ua)) return "tablet";
  if (/\bmobile\b|iphone|ipod|android|blackberry|iemobile|opera mini|windows phone/.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

/** Browser family from a User-Agent string (order matters). */
export function deriveBrowser(userAgent: string | null | undefined): string {
  if (!userAgent) return "other";
  const ua = userAgent.toLowerCase();
  if (/\bedg(e|a|ios)?\//.test(ua)) return "edge";
  if (/\bopr\//.test(ua) || /\bopera\b/.test(ua)) return "opera";
  if (/\bchrome\//.test(ua) && !/\bchromium\//.test(ua)) return "chrome";
  if (/\bchromium\//.test(ua)) return "chromium";
  if (/\bfirefox\//.test(ua) || /\bfxiOS\//.test(ua)) return "firefox";
  if (/\bsafari\//.test(ua) && /\bversion\//.test(ua)) return "safari";
  return "other";
}
