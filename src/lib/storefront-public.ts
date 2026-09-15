/**
 * Storefront 2.0 public presentation helpers (pure / server-safe).
 *
 * Display-only logic for the appointment storefront: opening status in
 * the business timezone, section visibility, section ordering, and
 * social entries. Never touches availability rules, pricing, or booking
 * semantics — those stay in the operational layers.
 */
import { STOREFRONT_SECTIONS } from "@/lib/storefront-config";
import type { BusinessHours } from "@/lib/availability/hours";

export interface TodayStatus {
  open: boolean;
  /** e.g. "Open today until 7:30 PM" or "Closed today". */
  label: string;
}

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** 0=Monday…6=Sunday in the business timezone (for "today" highlights). */
export function getTodayIndex(timezone: string, now: Date = new Date()): number {
  return weekdayIndexInZone(timezone, now);
}

function weekdayIndexInZone(timezone: string, now: Date): number {
  try {
    const short = new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      timeZone: timezone,
    }).format(now);
    const map: Record<string, number> = {
      Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
    };
    if (short in map) return map[short];
  } catch {
    // Invalid timezone — fall through to server-local day.
  }
  return (now.getDay() + 6) % 7;
}

function minutesInZone(timezone: string, now: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    const minute = Number(parts.find((p) => p.type === "minute")?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return (hour % 24) * 60 + minute;
  } catch {
    return null;
  }
}

function toMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function formatHourLabel(hhmm: string): string {
  const minutes = toMinutes(hhmm);
  if (minutes === null) return hhmm;
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/**
 * Today's opening status derived from business-local wall time (never
 * the browser or server timezone). Returns null when hours are absent
 * or unparseable — callers render nothing.
 */
export function getTodayStatus(
  hours: BusinessHours | null | undefined,
  timezone: string,
  now: Date = new Date(),
): TodayStatus | null {
  if (!hours) return null;
  const dayKey = WEEKDAY_KEYS[weekdayIndexInZone(timezone, now)];
  const today = (hours as Record<string, { open: string; close: string } | null>)[dayKey];
  if (!today) {
    // A day explicitly without hours reads as closed — but an hours
    // object with no usable days at all means "unconfigured", not
    // "closed", so callers render nothing.
    const hasAnyDay = WEEKDAY_KEYS.some((key) => {
      const entry = (hours as Record<string, { open: string; close: string } | null>)[key];
      return entry !== null && entry !== undefined;
    });
    return hasAnyDay ? { open: false, label: "Closed today" } : null;
  }
  const openMinutes = toMinutes(today.open);
  const closeMinutes = toMinutes(today.close);
  const nowMinutes = minutesInZone(timezone, now);
  if (openMinutes === null || closeMinutes === null || nowMinutes === null) return null;
  if (nowMinutes >= openMinutes && nowMinutes < closeMinutes) {
    return { open: true, label: `Open today until ${formatHourLabel(today.close)}` };
  }
  return { open: false, label: "Closed today" };
}

export interface SectionAvailability {
  services: boolean;
  gallery: boolean;
  team: boolean;
  reviews: boolean;
  about: boolean;
  hours: boolean;
  location: boolean;
  social: boolean;
  contact: boolean;
}

/**
 * Which sections have content AND permission. Visibility flags grant
 * permission; empty data always hides regardless of flags.
 */
export function resolveVisibleSections(input: {
  flags?: {
    showGallery?: boolean;
    showTeam?: boolean;
    showReviews?: boolean;
    showAbout?: boolean;
    showHours?: boolean;
    showLocation?: boolean;
    showSocial?: boolean;
  } | null;
  hasServices: boolean;
  galleryCount: number;
  visibleTeamCount: number;
  reviewCount: number;
  hasAbout: boolean;
  hasHours: boolean;
  hasLocation: boolean;
  socialCount: number;
}): SectionAvailability {
  const flags = input.flags ?? {};
  const on = (value: boolean | undefined) => value !== false;
  return {
    services: input.hasServices,
    gallery: on(flags.showGallery) && input.galleryCount > 0,
    team: on(flags.showTeam) && input.visibleTeamCount > 0,
    reviews: on(flags.showReviews) && input.reviewCount > 0,
    about: on(flags.showAbout) && input.hasAbout,
    hours: on(flags.showHours) && input.hasHours,
    location: on(flags.showLocation) && input.hasLocation,
    social: on(flags.showSocial) && input.socialCount > 0,
    contact: true,
  };
}

/** Canonical section order, honouring a validated custom override. */
export function resolveSectionOrder(custom: string[] | null | undefined): string[] {
  const defaults = [...STOREFRONT_SECTIONS];
  if (!custom || custom.length === 0) return defaults;
  const allowed: Set<string> = new Set(defaults);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const key of custom) {
    if (allowed.has(key) && !seen.has(key)) {
      seen.add(key);
      ordered.push(key);
    }
  }
  // Sections missing from the override keep their relative default order.
  for (const key of defaults) {
    if (!seen.has(key)) ordered.push(key);
  }
  return ordered;
}

export interface SocialEntry {
  network: string;
  label: string;
  href: string;
}

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  website: "Website",
  whatsapp: "WhatsApp",
};

/** Configured social links only, in a stable network order. */
export function resolveSocialEntries(
  socialLinks: Record<string, unknown> | null | undefined,
): SocialEntry[] {
  if (!socialLinks || typeof socialLinks !== "object") return [];
  const entries: SocialEntry[] = [];
  for (const network of Object.keys(SOCIAL_LABELS)) {
    const href = (socialLinks as Record<string, unknown>)[network];
    if (typeof href === "string" && href.trim().length > 0) {
      entries.push({ network, label: SOCIAL_LABELS[network], href: href.trim() });
    }
  }
  return entries;
}

/** Aggregate rating from legitimate rows only (null when none rated). */
export function aggregateRating(
  reviews: Array<{ rating: number | null }>,
): { average: number; count: number } | null {
  const rated = reviews.filter(
    (review): review is { rating: number } =>
      typeof review.rating === "number" && review.rating >= 1 && review.rating <= 5,
  );
  if (rated.length === 0) return null;
  const sum = rated.reduce((total, review) => total + review.rating, 0);
  return { average: Math.round((sum / rated.length) * 10) / 10, count: rated.length };
}
