/**
 * Time-aware greeting helpers for the dashboard home.
 *
 * Everything here is server-safe (pure Intl date math, no browser APIs),
 * so the greeting can be computed in a Server Component from the
 * business timezone. That avoids hydration mismatch entirely: the server
 * renders the final greeting and the client never recomputes it.
 */

export type Daypart = "morning" | "afternoon" | "evening";

/** Hour of day (0-23) for `now` in the given IANA timezone. */
export function getHourInZone(timeZone: string, now: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone,
    }).formatToParts(now);
    const raw = parts.find((p) => p.type === "hour")?.value;
    const hour = Number(raw);
    if (Number.isFinite(hour)) return hour % 24;
  } catch {
    // Invalid timezone — fall through to the server-local hour.
  }
  return now.getHours();
}

/** Morning (5-11), afternoon (12-17), evening otherwise. */
export function getDaypartInZone(timeZone: string, now: Date = new Date()): Daypart {
  const hour = getHourInZone(timeZone, now);
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

export function greetingForDaypart(daypart: Daypart): string {
  switch (daypart) {
    case "morning":
      return "Good morning";
    case "afternoon":
      return "Good afternoon";
    default:
      return "Good evening";
  }
}

/**
 * Best-effort display name derived from the account email.
 * "panashe.tapfumaneyi@example.com" -> "Panashe". Returns null when no
 * usable name part exists — callers must render a greeting without a
 * name rather than inventing one.
 */
export function displayNameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const local = email.split("@")[0] ?? "";
  const token = local.split(/[._\-+]+/).find((part) => part.length > 0);
  if (!token) return null;
  return token.charAt(0).toUpperCase() + token.slice(1);
}
