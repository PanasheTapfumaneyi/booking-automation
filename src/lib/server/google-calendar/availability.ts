import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessRow } from "@/lib/server/database";
import type { CalendarApi } from "./types";
import { classifyCalendarError } from "./errors";
import { CalendarIntegrationError } from "./errors";
import { createCalendarApiClient } from "./client";
import { getActiveConnection } from "./repository";
import { googleApiTimeoutMs } from "./types";

export interface IntervalLike {
  start: string;
  end: string;
}

export type ExternalBlocksStatus =
  | "connected"
  | "not_connected"
  | "requires_reconnect"
  | "unavailable";

export interface ExternalBusyResult {
  blocks: IntervalLike[];
  status: ExternalBlocksStatus;
}

/** True when two time ranges overlap (half-open: [aStart, aEnd) ∩ [bStart, bEnd)). */
export function hasIntervalOverlap(
  a: IntervalLike,
  b: IntervalLike,
): boolean {
  return Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end);
}

/**
 * Sorts and merges overlapping/touching intervals so downstream slot logic
 * sees a minimal, non-overlapping block list.
 */
export function mergeIntervals<T extends IntervalLike>(
  intervals: T[],
): T[] {
  if (intervals.length <= 1) return [...intervals];
  const sorted = [...intervals].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  );
  const merged: T[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (
      last &&
      Date.parse(interval.start) <= Date.parse(last.end)
    ) {
      const newEnd =
        Date.parse(interval.end) > Date.parse(last.end)
          ? interval.end
          : last.end;
      merged[merged.length - 1] = { ...last, end: newEnd };
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

/**
 * Removes `remove` from a list of busy intervals (used to ignore a booking's
 * own calendar event when checking its new reschedule time). Handles partial
 * overlaps by splitting intervals.
 */
export function subtractInterval(
  busy: IntervalLike[],
  remove: IntervalLike,
): IntervalLike[] {
  const removedStart = Date.parse(remove.start);
  const removedEnd = Date.parse(remove.end);
  const result: IntervalLike[] = [];
  for (const interval of busy) {
    const start = Date.parse(interval.start);
    const end = Date.parse(interval.end);
    if (removedEnd <= start || removedStart >= end) {
      result.push(interval);
      continue;
    }
    if (removedStart > start) {
      result.push({ start: interval.start, end: remove.start });
    }
    if (removedEnd < end) {
      result.push({ start: remove.end, end: interval.end });
    }
  }
  return result;
}

export interface GetBusyRangesArgs {
  calendarId: string;
  timeMin: string;
  timeMax: string;
  timeZone: string;
  /** Event id (this booking's own Google event) to ignore when checking conflicts. */
  excludeEventId?: string;
  timeoutMs?: number;
  /** Injectable for tests; defaults to the real CalendarApi. */
  api?: CalendarApi;
}

/**
 * Queries the free/busy API for a single calendar over a bounded range — never
 * the full calendar history. Optionally subtracts one event (a booking's own).
 */
export async function getBusyRanges(
  args: GetBusyRangesArgs,
): Promise<IntervalLike[]> {
  if (!args.api) {
    throw new CalendarIntegrationError(
      "CALENDAR_SYNC_FAILED",
      "getBusyRanges requires an API client (pass api or use fetchExternalCalendarBlocks).",
    );
  }
  const { data } = await args.api.freebusy.query(
    {
      requestBody: {
        timeMin: args.timeMin,
        timeMax: args.timeMax,
        timeZone: args.timeZone,
        items: [{ id: args.calendarId }],
      },
    },
    { timeout: args.timeoutMs },
  );
  const entry = data?.calendars?.[args.calendarId];
  if (entry?.errors && entry.errors.length > 0) {
    throw new CalendarIntegrationError(
      "CALENDAR_UNAVAILABLE",
      "Google Calendar reported an error for the requested range.",
    );
  }
  let ranges: IntervalLike[] = (entry?.busy ?? [])
    .filter((b) => Boolean(b.start && b.end))
    .map((b) => ({ start: b.start as string, end: b.end as string }));

  if (args.excludeEventId) {
    try {
      const { data: event } = await args.api.events.get(
        { calendarId: args.calendarId, eventId: args.excludeEventId },
        { timeout: args.timeoutMs },
      );
      const ownStart = event?.start?.dateTime;
      const ownEnd = event?.end?.dateTime;
      if (ownStart && ownEnd) {
        ranges = subtractInterval(ranges, {
          start: ownStart,
          end: ownEnd,
        });
      }
    } catch (err) {
      if (classifyCalendarError(err) !== "CALENDAR_EVENT_NOT_FOUND") {
        throw err;
      }
      // Own event no longer exists — nothing to exclude, and that's fine.
    }
  }

  return ranges;
}

export interface FetchExternalBlocksArgs {
  business: Pick<BusinessRow, "id" | "timezone">;
  startIso: string;
  endIso: string;
  /** Booking's own Google event id to ignore (reschedule-self exclusion). */
  ignoreGoogleEventId?: string;
  timeoutMs?: number;
  /** Injectable for tests; defaults to the real Supabase client. */
  db?: SupabaseClient;
  /** Injectable for tests; defaults to a real Google Calendar client. */
  api?: CalendarApi;
}

/**
 * Returns busy blocks coming from the business's connected Google Calendar.
 *
 * Deliberately safe to call from the public availability path: it never throws
 * to the page. Failures degrade to no calendar blocks and a status value so
 * the response can hint at a problem without breaking the UI. The authoritative
 * double-booking guard stays in Postgres and each booking submitp re-checks.
 */
export async function fetchExternalCalendarBlocks(
  args: FetchExternalBlocksArgs,
): Promise<ExternalBusyResult> {
  const connection = await getActiveConnection(args.business.id, args.db);
  if (!connection?.refreshToken || !connection.calendarId) {
    return { blocks: [], status: "not_connected" };
  }
  try {
    const api = args.api ?? createCalendarApiClient(connection).api;
    const ranges = await getBusyRanges({
      api,
      calendarId: connection.calendarId,
      timeMin: args.startIso,
      timeMax: args.endIso,
      timeZone: args.business.timezone,
      excludeEventId: args.ignoreGoogleEventId,
      timeoutMs: args.timeoutMs ?? googleApiTimeoutMs(),
    });
    return { blocks: ranges, status: "connected" };
  } catch (err) {
    if (classifyCalendarError(err) === "CALENDAR_AUTH_REQUIRED") {
      return { blocks: [], status: "requires_reconnect" };
    }
    console.error("[google-calendar] free/busy lookup failed:", err);
    return { blocks: [], status: "unavailable" };
  }
}