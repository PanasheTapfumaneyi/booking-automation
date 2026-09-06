// Server-only types for the Google Calendar integration layer.
// Nothing in this module is safe to send to the browser.

/** Minimum Calendar scopes required for Phase 3. */
export const GOOGLE_CALENDAR_SCOPES = [
  // write access to events on the connected calendar (create/update/delete)
  "https://www.googleapis.com/auth/calendar.events",
  // read access needed for free/busy queries and reading calendar list
  // metadata; `calendar.calendars.readonly` alone is insufficient for the
  // freebusy and calendarList APIs, which require `calendar.readonly`.
  "https://www.googleapis.com/auth/calendar.readonly",
] as const;

export type GoogleCalendarScope = (typeof GOOGLE_CALENDAR_SCOPES)[number];

/** Sync state stored per booking. */
export type CalendarSyncStatus =
  | "not_connected"
  | "pending"
  | "synced"
  | "failed";

/** Coarse error taxonomy used to classify Google Calendar failures. */
export type CalendarErrorCode =
  | "CALENDAR_NOT_CONNECTED"
  | "CALENDAR_AUTH_REQUIRED"
  | "CALENDAR_CONFLICT"
  | "CALENDAR_SYNC_FAILED"
  | "CALENDAR_UNAVAILABLE"
  | "CALENDAR_EVENT_NOT_FOUND";

/** Body of a Google Calendar event as the platform writes it. */
export interface CalendarEventBody {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  extendedProperties?: { private: Record<string, string> };
}

/**
 * The slice of the Calendar API the booking system uses, expressed as a plain
 * interface so unit tests can inject fakes instead of hitting Google.
 */
export interface CalendarApi {
  events: {
    insert(
      input: { calendarId: string; requestBody: CalendarEventBody },
      options?: { timeout?: number },
    ): Promise<{ data: { id?: string } }>;
    patch(
      input: {
        calendarId: string;
        eventId: string;
        requestBody: Partial<CalendarEventBody>;
      },
      options?: { timeout?: number },
    ): Promise<{ data: unknown }>;
    delete(
      input: { calendarId: string; eventId: string },
      options?: { timeout?: number },
    ): Promise<{ data: unknown }>;
    get(
      input: { calendarId: string; eventId: string },
      options?: { timeout?: number },
    ): Promise<{
      data: {
        start?: { dateTime?: string; timeZone?: string };
        end?: { dateTime?: string; timeZone?: string };
      };
    }>;
  };
  freebusy: {
    query(
      input: {
        requestBody: {
          timeMin: string;
          timeMax: string;
          timeZone: string;
          items: Array<{ id: string }>;
        };
      },
      options?: { timeout?: number },
    ): Promise<{
      data: {
        calendars?: Record<
          string,
          { busy?: Array<{ start?: string; end?: string }>; errors?: unknown[] }
        >;
      };
    }>;
  };
  calendarList: {
    get(
      input: { calendarId: string },
      options?: { timeout?: number },
    ): Promise<{ data: { id?: string } }>;
  };
}

/** Timeouts for outbound Google API calls (ms). */
export function googleApiTimeoutMs(): number {
  const raw = Number(process.env.GOOGLE_API_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 10_000;
}

/**
 * Business identifiers that may be connected/disconnected through the internal
 * integration routes. For the MVP the allowed set defaults to the Fade District
 * demo business; a real business-owner authentication gate must replace this
 * before public self-service onboarding.
 */
export function allowedBusinessIds(): string[] {
  const configured = process.env.GOOGLE_CAL_ALLOWED_BUSINESS_IDS;
  if (configured && configured.trim().length > 0) {
    return configured
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return ["00000000-0000-4000-8000-000000000001"];
}