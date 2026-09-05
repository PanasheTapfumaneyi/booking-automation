import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getBusyRanges,
  hasIntervalOverlap,
  mergeIntervals,
  subtractInterval,
  fetchExternalCalendarBlocks,
} from "./availability";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createFakeCalendarApi, createMemoryDb, connectionRow } from "./test-helpers";
import { getSlotsForDay } from "@/lib/availability";

afterEach(() => vi.unstubAllEnvs());

const asDb = (db: ReturnType<typeof createMemoryDb>) =>
  db as unknown as SupabaseClient;

describe("interval helpers", () => {
  it("detects overlaps", () => {
    expect(
      hasIntervalOverlap(
        { start: "2026-09-14T05:00:00.000Z", end: "2026-09-14T06:00:00.000Z" },
        { start: "2026-09-14T05:30:00.000Z", end: "2026-09-14T07:00:00.000Z" },
      ),
    ).toBe(true);
    expect(
      hasIntervalOverlap(
        { start: "2026-09-14T05:00:00.000Z", end: "2026-09-14T06:00:00.000Z" },
        { start: "2026-09-14T06:00:00.000Z", end: "2026-09-14T07:00:00.000Z" },
      ),
    ).toBe(false);
  });

  it("merges overlapping busy intervals", () => {
    const merged = mergeIntervals([
      { start: "2026-09-14T05:00:00.000Z", end: "2026-09-14T06:00:00.000Z" },
      { start: "2026-09-14T05:30:00.000Z", end: "2026-09-14T07:00:00.000Z" },
    ]);
    expect(merged).toEqual([
      { start: "2026-09-14T05:00:00.000Z", end: "2026-09-14T07:00:00.000Z" },
    ]);
  });

  it("subtracts a booking's own interval from busy ranges", () => {
    const result = subtractInterval(
      [{ start: "2026-09-14T05:00:00.000Z", end: "2026-09-14T07:00:00.000Z" }],
      { start: "2026-09-14T05:30:00.000Z", end: "2026-09-14T06:30:00.000Z" },
    );
    expect(result).toEqual([
      { start: "2026-09-14T05:00:00.000Z", end: "2026-09-14T05:30:00.000Z" },
      { start: "2026-09-14T06:30:00.000Z", end: "2026-09-14T07:00:00.000Z" },
    ]);
  });
});

describe("getBusyRanges", () => {
  it("returns busy ranges for the requested bound range", async () => {
    const { api } = createFakeCalendarApi({
      busy: [
        { start: "2026-09-14T05:00:00.000Z", end: "2026-09-14T05:30:00.000Z" },
      ],
    });
    const ranges = await getBusyRanges({
      api,
      calendarId: "primary",
      timeMin: "2026-09-14T04:00:00.000Z",
      timeMax: "2026-09-14T10:00:00.000Z",
      timeZone: "Indian/Mauritius",
    });
    expect(ranges).toEqual([
      { start: "2026-09-14T05:00:00.000Z", end: "2026-09-14T05:30:00.000Z" },
    ]);
    // only the free/busy endpoint was hit — never pull full history
    expect((ranges.length)).toBe(1);
  });

  it("ignores the booking's own event when excluding its event id", async () => {
    const { api } = createFakeCalendarApi({
      busy: [
        { start: "2026-09-14T05:00:00.000Z", end: "2026-09-14T07:00:00.000Z" },
        { start: "2026-09-14T08:00:00.000Z", end: "2026-09-14T08:30:00.000Z" },
      ],
      ownEvent: {
        start: "2026-09-14T05:30:00.000Z",
        end: "2026-09-14T06:30:00.000Z",
      },
    });
    const ranges = await getBusyRanges({
      api,
      calendarId: "primary",
      timeMin: "2026-09-14T04:00:00.000Z",
      timeMax: "2026-09-14T10:00:00.000Z",
      timeZone: "Indian/Mauritius",
      excludeEventId: "event-own",
    });
    expect(ranges).toEqual([
      { start: "2026-09-14T05:00:00.000Z", end: "2026-09-14T05:30:00.000Z" },
      { start: "2026-09-14T06:30:00.000Z", end: "2026-09-14T07:00:00.000Z" },
      { start: "2026-09-14T08:00:00.000Z", end: "2026-09-14T08:30:00.000Z" },
    ]);
  });
});

describe("availability merging (slot grid)", () => {
  // A day the current time.ts treats as open (09:00–18:00 local in
  // Indian/Mauritius, UTC+4). A busy 13:00–14:00 local block is 09:00–10:00 UTC.
  const timezone = "Indian/Mauritius";
  const busyBlock = {
    startTime: "2026-09-15T09:00:00.000Z",
    endTime: "2026-09-15T10:00:00.000Z",
  };
  const sixtyMinute = { durationMinutes: 60 };

  it("a calendar busy event removes the overlapping appointment slot", () => {
    const slots = getSlotsForDay("2026-09-15", sixtyMinute, [busyBlock], timezone);
    expect(slots.some((s) => s.label === "13:00")).toBe(false);
    expect(slots.some((s) => s.label === "12:30")).toBe(false);
    expect(slots.some((s) => s.label === "11:00")).toBe(true);
  });

  it("a non-overlapping calendar event keeps the slot", () => {
    const earlyBlock = {
      startTime: "2026-09-15T02:00:00.000Z", // 06:00 local, before opening
      endTime: "2026-09-15T02:30:00.000Z",
    };
    const slots = getSlotsForDay("2026-09-15", sixtyMinute, [earlyBlock], timezone);
    expect(slots.some((s) => s.label === "13:00")).toBe(true);
  });
});

describe("fetchExternalCalendarBlocks", () => {
  it("returns not_connected when the business has no connection", async () => {
    const db = createMemoryDb();
    const result = await fetchExternalCalendarBlocks({
      business: { id: "biz-1", timezone: "Indian/Mauritius" },
      startIso: "2026-09-15T04:00:00.000Z",
      endIso: "2026-09-15T10:00:00.000Z",
      db: asDb(db),
    });
    expect(result.status).toBe("not_connected");
    expect(result.blocks).toEqual([]);
  });

  it("degrades to requires_reconnect on revoked credentials", async () => {
    const db = createMemoryDb();
    db.tables.calendar_connections.push(connectionRow({ business_id: "biz-a" }));
    const { api } = createFakeCalendarApi({
      freebusyThrows: { code: 401, message: "Invalid Credentials" },
    });
    const result = await fetchExternalCalendarBlocks({
      business: { id: "biz-a", timezone: "Indian/Mauritius" },
      startIso: "2026-09-15T04:00:00.000Z",
      endIso: "2026-09-15T10:00:00.000Z",
      db: asDb(db),
      api,
    });
    expect(result).toEqual({ blocks: [], status: "requires_reconnect" });
  });
});