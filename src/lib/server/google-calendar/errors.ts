import type { CalendarErrorCode } from "./types";

/**
 * Raised when an interaction with the Google Calendar API fails. Carries the
 * coarse taxonomy from CalendarErrorCode; callers translate to user-facing
 * ApiErrors / responses.
 */
export class CalendarIntegrationError extends Error {
  constructor(
    public readonly code: CalendarErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CalendarIntegrationError";
  }
}

/** True when a Google Calendar conversation has been revoked/invalidated. */
function looksLikeAuthFailure(err: unknown): boolean {
  if (err instanceof CalendarIntegrationError) {
    return err.code === "CALENDAR_AUTH_REQUIRED";
  }
  const message =
    err instanceof Error || (err && typeof err === "object" && "message" in err)
      ? String((err as { message?: unknown }).message ?? "")
      : String(err);
  return /invalid_grant|invalid_client|token[_-]?expired|access[_-]?denied|invalid.{0,20}credential|credential.{0,20}invalid/i.test(
    message,
  );
}

function codeOf(err: unknown): number | undefined {
  if (err && typeof err === "object" && "code" in err) {
    const c = (err as { code?: unknown }).code;
    return typeof c === "number" ? c : undefined;
  }
  return undefined;
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message?: unknown }).message ?? "");
  }
  return String(err);
}

/**
 * Maps an arbitrary thrown value (gaxios error, google-auth-library error,
 * timeout, CalendarIntegrationError, ...) to the stable CalendarErrorCode
 * taxonomy used across the app.
 */
export function classifyCalendarError(
  err: unknown,
  fallback: CalendarErrorCode = "CALENDAR_SYNC_FAILED",
): CalendarErrorCode {
  if (err instanceof CalendarIntegrationError) return err.code;

  const code = codeOf(err);
  if (code === 404) return "CALENDAR_EVENT_NOT_FOUND";
  if (code === 409) return "CALENDAR_CONFLICT";
  if (code === 429) return "CALENDAR_UNAVAILABLE";
  if (code === 401 || code === 403) {
    return looksLikeAuthFailure(err) ? "CALENDAR_AUTH_REQUIRED" : fallback;
  }

  const message = messageOf(err);
  if (/ETIMEDOUT|ECONNABORTED|timeout|ECONNREFUSED|ENOTFOUND|socket hang up/i.test(message)) {
    return "CALENDAR_UNAVAILABLE";
  }
  if (looksLikeAuthFailure(err)) return "CALENDAR_AUTH_REQUIRED";

  return fallback;
}