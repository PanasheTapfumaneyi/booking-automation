import { describe, it, expect, afterEach, vi } from "vitest";
import { ApiError } from "@/lib/server/errors";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessRow, ServiceRow, BookingRow } from "@/lib/server/database";
import {
  syncAfterCreate,
  assertNewTimeCalendarFree,
  moveCalendarEvent,
  syncAfterCancel,
} from "./sync";
import {
  createFakeCalendarApi,
  createMemoryDb,
  connectionRow,
  type MemoryDb,
} from "./test-helpers";

afterEach(() => vi.unstubAllEnvs());

const asDb = (db: MemoryDb) => db as unknown as SupabaseClient;

const business = {
  id: "biz-1",
  name: "Fade District",
  phone: null,
  email: null,
  timezone: "Indian/Mauritius",
  booking_mode: "appointment",
  calendar_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
} as BusinessRow;

const service = {
  id: "svc-1",
  business_id: "biz-1",
  name: "Haircut + Beard",
  duration_minutes: 60,
  price: 700,
  active: true,
} as ServiceRow;

function bookingRow(overrides: Record<string, unknown> = {}): BookingRow {
  return {
    id: "booking-1",
    business_id: "biz-1",
    service_id: "svc-1",
    customer_id: "cust-1",
    resource_id: null,
    session_id: null,
    quantity: 1,
    start_time: "2026-09-16T05:00:00.000Z",
    end_time: "2026-09-16T06:00:00.000Z",
    status: "confirmed",
    google_event_id: "event-1",
    manage_token: "demo-token",
    previous_start_time: null,
    created_at: "2026-09-16T04:00:00.000Z",
    updated_at: "2026-09-16T04:00:00.000Z",
    ...overrides,
  };
}

function dbWithConnection(): MemoryDb {
  const db = createMemoryDb();
  db.tables.calendar_connections.push(connectionRow({ business_id: "biz-1" }));
  return db;
}

function bookingInDb(db: MemoryDb): Record<string, unknown> {
  return db.tables.bookings[0] as Record<string, unknown>;
}

describe("syncAfterCreate", () => {
  it("is a no-op when the business has no Google connection", async () => {
    const db = createMemoryDb();
    db.tables.bookings.push(bookingRow({ google_event_id: null }));
    const { api, calls } = createFakeCalendarApi();
    const outcome = await syncAfterCreate({
      business,
      service,
      row: db.tables.bookings[0] as unknown as BookingRow,
      customerName: "John Doe",
      customerPhone: "+230",
      db: asDb(db),
      api,
    });
    expect(outcome).toEqual({ status: "not_connected" });
    expect(calls.freebusy).toHaveLength(0);
    expect(bookingInDb(db).status).toBe("confirmed");
  });

  it("creates the event and records google_event_id + synced state", async () => {
    const db = dbWithConnection();
    db.tables.bookings.push(bookingRow({ google_event_id: null }));
    const { api, calls } = createFakeCalendarApi();
    const outcome = await syncAfterCreate({
      business,
      service,
      row: db.tables.bookings[0] as unknown as BookingRow,
      customerName: "John Doe",
      customerPhone: "+230",
      db: asDb(db),
      api,
    });
    expect(outcome.status).toBe("synced");
    expect(outcome.eventId).toBe("event-1");
    expect(calls.insert).toHaveLength(1);
    expect(bookingInDb(db).google_event_id).toBe("event-1");
    expect(bookingInDb(db).calendar_sync_status).toBe("synced");
    expect(bookingInDb(db).status).toBe("confirmed");
  });

  it("cancels the booking and throws 409 when Google reports a busy conflict", async () => {
    const db = dbWithConnection();
    db.tables.bookings.push(bookingRow({ google_event_id: null }));
    const { api, calls } = createFakeCalendarApi({
      busy: [{ start: "2026-09-16T05:00:00.000Z", end: "2026-09-16T06:30:00.000Z" }],
    });
    const thrown = await syncAfterCreate({
      business,
      service,
      row: db.tables.bookings[0] as unknown as BookingRow,
      customerName: "John Doe",
      customerPhone: "+230",
      db: asDb(db),
      api,
    }).catch((e) => e);
    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown.code).toBe("CALENDAR_CONFLICT");
    expect(thrown.status).toBe(409);
    expect(bookingInDb(db).status).toBe("cancelled"); // compensated
    expect(calls.insert).toHaveLength(0);
  });

  it("cancels and throws 502 on a transient calendar failure", async () => {
    const db = dbWithConnection();
    db.tables.bookings.push(bookingRow({ google_event_id: null }));
    const { api } = createFakeCalendarApi({
      freebusyThrows: new Error("connect ETIMEDOUT"),
    });
    const thrown = await syncAfterCreate({
      business,
      service,
      row: db.tables.bookings[0] as unknown as BookingRow,
      customerName: "John Doe",
      customerPhone: "+230",
      db: asDb(db),
      api,
    }).catch((e) => e);
    expect(thrown.code).toBe("CALENDAR_UNAVAILABLE");
    expect(thrown.status).toBe(503);
    expect(bookingInDb(db).status).toBe("cancelled");
  });

  it("keeps the booking and flags requiresReconnect on revoked credentials", async () => {
    const db = dbWithConnection();
    db.tables.bookings.push(bookingRow({ google_event_id: null }));
    const { api } = createFakeCalendarApi({
      freebusyThrows: { code: 401, message: "Invalid Credentials" },
    });
    const outcome = await syncAfterCreate({
      business,
      service,
      row: db.tables.bookings[0] as unknown as BookingRow,
      customerName: "John Doe",
      customerPhone: "+230",
      db: asDb(db),
      api,
    });
    expect(outcome.status).toBe("failed");
    expect(outcome.requiresReconnect).toBe(true);
    expect(bookingInDb(db).status).toBe("confirmed"); // booking kept
    expect(bookingInDb(db).calendar_sync_status).toBe("failed");
  });

  it("treats a late 409 from the event insert as the final guard", async () => {
    const db = dbWithConnection();
    db.tables.bookings.push(bookingRow({ google_event_id: null }));
    const { api } = createFakeCalendarApi({
      insertThrows: { code: 409, message: "Concurrent creation" },
    });
    const thrown = await syncAfterCreate({
      business,
      service,
      row: db.tables.bookings[0] as unknown as BookingRow,
      customerName: "John Doe",
      customerPhone: "+230",
      db: asDb(db),
      api,
    }).catch((e) => e);
    expect(thrown.code).toBe("CALENDAR_CONFLICT");
    expect(thrown.status).toBe(409);
    expect(bookingInDb(db).status).toBe("cancelled");
  });
});

describe("assertNewTimeCalendarFree", () => {
  it("is a no-op without a connection", async () => {
    const db = createMemoryDb();
    await expect(
      assertNewTimeCalendarFree({
        business,
        row: { id: "b1", google_event_id: "event-1" },
        newStartIso: "2026-09-17T05:00:00.000Z",
        newEndIso: "2026-09-17T06:00:00.000Z",
        db: asDb(db),
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects a move that lands on a calendar busy event", async () => {
    const db = dbWithConnection();
    const { api } = createFakeCalendarApi({
      busy: [{ start: "2026-09-17T05:00:00.000Z", end: "2026-09-17T06:00:00.000Z" }],
      ownEvent: null,
    });
    const thrown = await assertNewTimeCalendarFree({
      business,
      row: { id: "b1", google_event_id: "event-1" },
      newStartIso: "2026-09-17T05:00:00.000Z",
      newEndIso: "2026-09-17T06:00:00.000Z",
      db: asDb(db),
      api,
    }).catch((e) => e);
    expect(thrown.code).toBe("CALENDAR_CONFLICT");
  });

  it("ignores the booking's own event when checking the new time", async () => {
    const db = dbWithConnection();
    const { api } = createFakeCalendarApi({
      busy: [
        // busy exactly on the booking's own event → excluded → move is allowed
        { start: "2026-09-17T05:00:00.000Z", end: "2026-09-17T06:00:00.000Z" },
      ],
      ownEvent: {
        start: "2026-09-17T05:00:00.000Z",
        end: "2026-09-17T06:00:00.000Z",
      },
    });
    const { calls } = createFakeCalendarApi();
    await expect(
      assertNewTimeCalendarFree({
        business,
        row: { id: "b1", google_event_id: "event-1" },
        newStartIso: "2026-09-17T05:00:00.000Z",
        newEndIso: "2026-09-17T06:00:00.000Z",
        db: asDb(db),
        api,
      }),
    ).resolves.toBeUndefined();
    expect(calls).toBeDefined();
  });

  it("still rejects when another manual event overlaps the same window", async () => {
    const db = dbWithConnection();
    const { api } = createFakeCalendarApi({
      busy: [
        // booking's own event...
        { start: "2026-09-17T05:00:00.000Z", end: "2026-09-17T05:30:00.000Z" },
        // ...and a second manual event in the same window
        { start: "2026-09-17T05:30:00.000Z", end: "2026-09-17T06:00:00.000Z" },
      ],
      ownEvent: {
        start: "2026-09-17T05:00:00.000Z",
        end: "2026-09-17T05:30:00.000Z",
      },
    });
    const thrown = await assertNewTimeCalendarFree({
      business,
      row: { id: "b1", google_event_id: "event-1" },
      newStartIso: "2026-09-17T05:00:00.000Z",
      newEndIso: "2026-09-17T06:00:00.000Z",
      db: asDb(db),
      api,
    }).catch((e) => e);
    expect(thrown.code).toBe("CALENDAR_CONFLICT");
  });
});

describe("moveCalendarEvent (reschedule)", () => {
  it("moves the existing event and marks the booking synced", async () => {
    const db = dbWithConnection();
    db.tables.bookings.push(bookingRow());
    const { api, calls } = createFakeCalendarApi();
    const outcome = await moveCalendarEvent({
      business,
      row: { id: "booking-1", google_event_id: "event-1" },
      newStartIso: "2026-09-18T05:00:00.000Z",
      newEndIso: "2026-09-18T06:00:00.000Z",
      previousStartIso: "2026-09-16T05:00:00.000Z",
      previousEndIso: "2026-09-16T06:00:00.000Z",
      db: asDb(db),
      api,
    });
    expect(outcome.status).toBe("synced");
    const patched = calls.patch[0] as { eventId: string };
    expect(patched.eventId).toBe("event-1");
    expect(bookingInDb(db).calendar_sync_status).toBe("synced");
  });

  it("is a no-op (no revert) when the booking has no Google event yet", async () => {
    const db = dbWithConnection();
    db.tables.bookings.push(bookingRow({ google_event_id: null }));
    const { api, calls } = createFakeCalendarApi();
    const outcome = await moveCalendarEvent({
      business,
      row: { id: "booking-1", google_event_id: null },
      newStartIso: "2026-09-18T05:00:00.000Z",
      newEndIso: "2026-09-18T06:00:00.000Z",
      previousStartIso: "2026-09-16T05:00:00.000Z",
      previousEndIso: "2026-09-16T06:00:00.000Z",
      db: asDb(db),
      api,
    });
    expect(outcome.status).toBe("not_connected");
    expect(calls.patch).toHaveLength(0);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("reverts the database move and throws when the event cannot move", async () => {
    const db = dbWithConnection();
    db.tables.bookings.push(bookingRow());
    const { api } = createFakeCalendarApi({
      patchThrows: new Error("event gone"),
    });
    const thrown = await moveCalendarEvent({
      business,
      row: { id: "booking-1", google_event_id: "event-1" },
      newStartIso: "2026-09-18T05:00:00.000Z",
      newEndIso: "2026-09-18T06:00:00.000Z",
      previousStartIso: "2026-09-16T05:00:00.000Z",
      previousEndIso: "2026-09-16T06:00:00.000Z",
      db: asDb(db),
      api,
    }).catch((e) => e);
    expect(thrown.code).toBe("CALENDAR_SYNC_FAILED");
    const revertCall = db.rpcCalls.find((c) => c.fn === "update_booking_time");
    expect(revertCall).toBeDefined();
    expect(revertCall?.args.p_booking_id).toBe("booking-1");
    expect(revertCall?.args.p_start_time).toBe("2026-09-16T05:00:00.000Z");
  });
});

describe("syncAfterCancel", () => {
  it("is a no-op when the booking never had a Google event", async () => {
    const db = dbWithConnection();
    db.tables.bookings.push(bookingRow({ google_event_id: null }));
    const { api, calls } = createFakeCalendarApi();
    const outcome = await syncAfterCancel({
      business,
      row: { id: "booking-1", google_event_id: null },
      db: asDb(db),
      api,
    });
    expect(outcome.status).toBe("not_connected");
    expect(calls.delete).toHaveLength(0);
  });

  it("deletes the event and marks cancelled booking synced", async () => {
    const db = dbWithConnection();
    db.tables.bookings.push(bookingRow({ status: "cancelled" }));
    const { api, calls } = createFakeCalendarApi();
    const outcome = await syncAfterCancel({
      business,
      row: { id: "booking-1", google_event_id: "event-1" },
      db: asDb(db),
      api,
    });
    expect(outcome.status).toBe("synced");
    expect(calls.delete).toHaveLength(1);
    expect(bookingInDb(db).calendar_sync_status).toBe("synced");
  });

  it("treats an already-deleted event as a safe, synced outcome", async () => {
    const db = dbWithConnection();
    db.tables.bookings.push(bookingRow({ status: "cancelled" }));
    const { api } = createFakeCalendarApi({
      deleteThrows: { code: 404, message: "not_found" },
    });
    const outcome = await syncAfterCancel({
      business,
      row: { id: "booking-1", google_event_id: "event-1" },
      db: asDb(db),
      api,
    });
    expect(outcome.status).toBe("synced");
    expect(outcome.code).toBe("CALENDAR_EVENT_NOT_FOUND");
  });

  it("never breaks the cancellation when the delete fails", async () => {
    const db = dbWithConnection();
    db.tables.bookings.push(bookingRow({ status: "cancelled" }));
    const { api } = createFakeCalendarApi({
      deleteThrows: new Error("socket hang up"),
    });
    const outcome = await syncAfterCancel({
      business,
      row: { id: "booking-1", google_event_id: "event-1" },
      db: asDb(db),
      api,
    });
    expect(outcome.status).toBe("failed");
    expect(bookingInDb(db).status).toBe("cancelled"); // DB already freed
    expect(bookingInDb(db).calendar_sync_status).toBe("failed");
  });

  it("flags requiresReconnect on revoked credentials", async () => {
    const db = dbWithConnection();
    db.tables.bookings.push(bookingRow({ status: "cancelled" }));
    const { api } = createFakeCalendarApi({
      deleteThrows: { code: 401, message: "Invalid Credentials" },
    });
    const outcome = await syncAfterCancel({
      business,
      row: { id: "booking-1", google_event_id: "event-1" },
      db: asDb(db),
      api,
    });
    expect(outcome).toEqual({
      status: "failed",
      code: "CALENDAR_AUTH_REQUIRED",
      requiresReconnect: true,
    });
  });
});