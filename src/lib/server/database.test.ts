/**
 * Manage-token lookup regression tests (Part A).
 *
 * Proves the lookup behind /manage/[token] resolves strictly by the unique
 * manage_token: token A → booking A, token B → booking B, a cancelled
 * booking C still resolves under its OWN token C, token A never returns C,
 * unknown tokens 404, and reschedule/cancel preserve the manage token.
 *
 * The Supabase client is faked at the `@/lib/supabase/server` boundary; the
 * fake implements exactly the query operators these paths use
 * (select/eq/neq/in/lt/gt/limit/update/rpc).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchBookingByToken } from "./database";
import {
  getBookingByToken,
  rescheduleBooking,
  cancelBooking,
} from "./booking-service";
import { ApiError } from "./errors";
import { getSlotsForDay, isoToDateKey } from "@/lib/availability";

type Row = Record<string, unknown>;

/** Generate a future ISO timestamp relative to now. */
function futureIso(daysOffset: number, hours = 0, minutes = 0): string {
  const d = new Date(Date.now() + daysOffset * 86_400_000 + hours * 3_600_000 + minutes * 60_000);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Fake Supabase surface
// ---------------------------------------------------------------------------

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private patch: Row | null = null;

  constructor(
    private tables: Record<string, Row[]>,
    private tableName: string,
    private onUpdate?: (table: string, patch: Row) => void,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  select(..._args: unknown[]): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push((row) => (row[column] as string) < (value as string));
    return this;
  }

  gt(column: string, value: unknown): this {
    this.filters.push((row) => (row[column] as string) > (value as string));
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  limit(_n: number): this {
    return this;
  }

  update(patch: Row): this {
    this.patch = patch;
    this.onUpdate?.(this.tableName, patch);
    return this;
  }

  private table(name: string): Row[] {
    if (!this.tables[name]) this.tables[name] = [];
    return this.tables[name];
  }

  private matching(table: string): Row[] {
    return this.table(table).filter((row) =>
      this.filters.every((pred) => pred(row)),
    );
  }

  /**
   * PostgREST update…select…maybeSingle semantics: filters match pre-update
   * rows, the patch applies, and RETURNING yields those same rows (which may
   * no longer match the filters afterwards).
   */
  private flushed: Row[] | null = null;

  private flush(table: string): void {
    if (!this.patch) {
      this.flushed = null;
      return;
    }
    const patch = this.patch;
    this.patch = null;
    const matched = this.matching(table);
    for (const row of matched) Object.assign(row, patch);
    this.flushed = matched;
  }

  private result(table: string): Row[] {
    return this.flushed ?? this.matching(table);
  }

  async maybeSingle(): Promise<{ data: unknown; error: null }> {
    this.flush(this.tableName);
    return { data: this.result(this.tableName)[0] ?? null, error: null };
  }

  async single(): Promise<{ data: unknown; error: null }> {
    this.flush(this.tableName);
    return { data: this.result(this.tableName)[0] ?? null, error: null };
  }

  then<TResult = { data: unknown; error: null }>(
    onfulfilled?: (value: { data: unknown; error: null }) => TResult,
  ) {
    this.flush(this.tableName);
    return Promise.resolve({
      data: this.result(this.tableName),
      error: null,
    }).then(onfulfilled as never);
  }
}

interface FakeDb {
  tables: Record<string, Row[]>;
  rpcImpl: ((fn: string, args: Row) => unknown) | null;
  appliedPatches: Row[];
  from: (table: string) => FakeQuery;
  rpc: (fn: string, args: Row) => Promise<{ data: unknown; error: null }>;
}

function createFakeDb(): FakeDb {
  const store: FakeDb = {
    tables: {},
    rpcImpl: null,
    appliedPatches: [],
    from(table: string) {
      return new FakeQuery(store.tables, table, (t, patch) => {
        store.appliedPatches.push({ table: t, ...patch });
      });
    },
    async rpc(fn: string, args: Row) {
      if (!store.rpcImpl) throw new Error(`unexpected rpc ${fn}`);
      return { data: store.rpcImpl(fn, args), error: null };
    },
  };
  return store;
}

const holder: { db: FakeDb | null } = { db: null };

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => {
    if (!holder.db) throw new Error("fake db not installed");
    return holder.db;
  },
}));

const asDb = (db: FakeDb) => db as unknown as SupabaseClient;

function fake(): FakeDb {
  if (!holder.db) throw new Error("fake db not installed");
  return holder.db;
}

afterEach(() => {
  vi.unstubAllEnvs();
  holder.db = null;
});

// ---------------------------------------------------------------------------
// Row factories
// ---------------------------------------------------------------------------

const BIZ = {
  id: "biz-1",
  name: "Fade District",
  phone: null,
  email: null,
  timezone: "Indian/Mauritius",
  booking_mode: "appointment",
  calendar_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const SERVICE = {
  id: "svc-1",
  business_id: "biz-1",
  name: "Haircut",
  duration_minutes: 45,
  price: 500,
  active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function bookingRow(overrides: Row = {}): Row {
  return {
    id: "b-1",
    business_id: "biz-1",
    service_id: "svc-1",
    customer_id: "cust-1",
    resource_id: null,
    session_id: null,
    quantity: 1,
    start_time: futureIso(1, 6, 0),
    end_time: futureIso(1, 6, 45),
    status: "confirmed",
    google_event_id: null,
    manage_token: "tok-1",
    previous_start_time: null,
    created_at: "2026-09-06T00:00:00.000Z",
    updated_at: "2026-09-06T00:00:00.000Z",
    service: { name: "Haircut", duration_minutes: 45, price: 500 },
    customer: { name: "Jean-Marc", phone: "+23057123456", email: null },
    ...overrides,
  };
}

/** A real future on-grid slot so requireAppointmentSlot passes. */
function nextBookableSlot(): { startIso: string; endIso: string } {
  const tz = "Indian/Mauritius";
  for (let dayOffset = 4; dayOffset < 14; dayOffset += 1) {
    const date = new Date(Date.now() + dayOffset * 86_400_000);
    const key = isoToDateKey(date.toISOString(), tz);
    const slots = getSlotsForDay(key, { durationMinutes: 45 }, [], tz);
    if (slots.length > 0) {
      const start = new Date(slots[0].startTime).getTime();
      return {
        startIso: new Date(start).toISOString(),
        endIso: new Date(start + 45 * 60_000).toISOString(),
      };
    }
  }
  throw new Error("no bookable slot found in test window");
}

// ---------------------------------------------------------------------------
// Lookup correctness
// ---------------------------------------------------------------------------

describe("fetchBookingByToken", () => {
  beforeEach(() => {
    holder.db = createFakeDb();
    holder.db.tables.bookings = [
      bookingRow({ id: "b-A", manage_token: "tok-A", status: "confirmed" }),
      bookingRow({ id: "b-B", manage_token: "tok-B", status: "confirmed" }),
      bookingRow({ id: "b-C", manage_token: "tok-C", status: "cancelled" }),
    ];
  });

  it("token A returns booking A", async () => {
    const found = await fetchBookingByToken("tok-A", asDb(fake()));
    expect(found?.row.id).toBe("b-A");
    expect(found?.row.manage_token).toBe("tok-A");
  });

  it("token B returns booking B even with many rows present", async () => {
    const found = await fetchBookingByToken("tok-B", asDb(fake()));
    expect(found?.row.id).toBe("b-B");
    expect(found?.row.manage_token).toBe("tok-B");
  });

  it("cancelled booking C resolves under its OWN token", async () => {
    const found = await fetchBookingByToken("tok-C", asDb(fake()));
    expect(found?.row.id).toBe("b-C");
    expect(found?.row.status).toBe("cancelled");
  });

  it("an unknown token returns null (never another row)", async () => {
    const found = await fetchBookingByToken("tok-nope", asDb(fake()));
    expect(found).toBeNull();
  });
});

describe("getBookingByToken", () => {
  beforeEach(() => {
    holder.db = createFakeDb();
    holder.db.tables.bookings = [
      bookingRow({ id: "b-A", manage_token: "tok-A", status: "confirmed" }),
      bookingRow({ id: "b-C", manage_token: "tok-C", status: "cancelled" }),
    ];
  });

  it("token A never returns booking C", async () => {
    const booking = await getBookingByToken("tok-A");
    expect(booking.id).toBe("b-A");
    expect(booking.manageToken).toBe("tok-A");
  });

  it("an invalid token returns the safe not-found error", async () => {
    const err = await getBookingByToken("tok-nope").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).code).toBe("BOOKING_NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// Token stability across operations
// ---------------------------------------------------------------------------

describe("manage token stability", () => {
  beforeEach(() => {
    holder.db = createFakeDb();
    holder.db.tables.businesses = [{ ...BIZ }];
    holder.db.tables.services = [{ ...SERVICE }];
  });

  it("cancelling does not change the manage token", async () => {
    fake().tables.bookings = [
      bookingRow({ id: "b-1", manage_token: "tok-keep", status: "confirmed" }),
    ];
    const cancelled = await cancelBooking("tok-keep");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.manageToken).toBe("tok-keep");
    // The cancellation write touched status only — never the token.
    for (const patch of fake().appliedPatches) {
      expect(patch).not.toHaveProperty("manage_token");
    }
    const stored = fake().tables.bookings[0];
    expect(stored.status).toBe("cancelled");
    expect(stored.manage_token).toBe("tok-keep");
  });

  it("rescheduling does not change the manage token", async () => {
    const oldStart = "2026-09-08T06:00:00.000Z";
    fake().tables.bookings = [
      bookingRow({ id: "b-1", manage_token: "tok-keep", status: "confirmed", start_time: oldStart }),
    ];
    const { startIso, endIso } = nextBookableSlot();
    fake().rpcImpl = (fn, args) => {
      expect(fn).toBe("update_booking_time");
      expect(args).not.toHaveProperty("p_manage_token");
      const row = { ...(fake().tables.bookings[0] as Row) };
      row.start_time = args.p_start_time;
      row.end_time = args.p_end_time;
      row.previous_start_time = oldStart;
      return { ok: true, booking: row };
    };

    const moved = await rescheduleBooking("tok-keep", startIso);
    expect(moved.startTime).toBe(startIso);
    expect(moved.endTime).toBe(endIso);
    expect(moved.previousStartTime).toBe(oldStart);
    expect(moved.manageToken).toBe("tok-keep");
    for (const patch of fake().appliedPatches) {
      expect(patch).not.toHaveProperty("manage_token");
    }
  });
});

// ---------------------------------------------------------------------------
// Resource-mode reschedule (Phase 6C)
// ---------------------------------------------------------------------------

describe("resource-mode reschedule", () => {
  const RESOURCE_BIZ = {
    ...BIZ,
    id: "biz-res",
    booking_mode: "resource",
  };

  const RESOURCE = {
    id: "res-1",
    business_id: "biz-res",
    name: "Corolla",
    resource_type: "vehicle",
    active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    holder.db = createFakeDb();
    holder.db.tables.businesses = [{ ...RESOURCE_BIZ }];
    holder.db.tables.services = [{ ...SERVICE, business_id: "biz-res" }];
    holder.db.tables.resources = [{ ...RESOURCE }];
  });

  function resourceBooking(overrides: Row = {}): Row {
    return bookingRow({
      id: "b-res-1",
      business_id: "biz-res",
      service_id: "svc-1",
      resource_id: "res-1",
      manage_token: "tok-res-1",
      status: "confirmed",
      start_time: futureIso(3, 8, 0),
      end_time: futureIso(3, 12, 0),
      ...overrides,
    });
  }

  it("moves the booking to a new interval on the same resource", async () => {
    fake().tables.bookings = [resourceBooking()];

    const bookingStart = futureIso(3, 8, 0);
    // assertResourceFree queries bookings for overlap — no other rows = free.
    fake().rpcImpl = (fn, args) => {
      expect(fn).toBe("update_booking_time");
      const row = { ...(fake().tables.bookings[0] as Row) };
      row.start_time = args.p_start_time;
      row.end_time = args.p_end_time;
      row.previous_start_time = bookingStart;
      return { ok: true, booking: row };
    };

    const newStart = futureIso(5, 14, 0);
    const newEnd = futureIso(5, 18, 0);
    const moved = await rescheduleBooking("tok-res-1", newStart, newEnd);
    expect(moved.startTime).toBe(newStart);
    expect(moved.endTime).toBe(newEnd);
    expect(moved.previousStartTime).toBe(bookingStart);
    expect(moved.manageToken).toBe("tok-res-1");
  });

  it("rejects when the new interval overlaps another active booking on the same resource", async () => {
    const b1Start = futureIso(3, 8, 0);
    const b1End = futureIso(3, 12, 0);
    const b2Start = futureIso(4, 10, 0);
    const b2End = futureIso(4, 14, 0);
    fake().tables.bookings = [
      resourceBooking({ id: "b-res-1", start_time: b1Start, end_time: b1End }),
      resourceBooking({ id: "b-res-2", manage_token: "tok-res-2", start_time: b2Start, end_time: b2End }),
    ];

    const overlapStart = futureIso(4, 12, 0);
    const overlapEnd = futureIso(4, 16, 0);
    await expect(
      rescheduleBooking("tok-res-1", overlapStart, overlapEnd),
    ).rejects.toMatchObject({ status: 409, code: "SLOT_UNAVAILABLE" });
  });

  it("self-excludes: rescheduling to the same time is not rejected", async () => {
    const sameStart = futureIso(3, 8, 0);
    const sameEnd = futureIso(3, 12, 0);
    fake().tables.bookings = [
      resourceBooking({ start_time: sameStart, end_time: sameEnd }),
    ];

    fake().rpcImpl = (fn, args) => {
      const row = { ...(fake().tables.bookings[0] as Row) };
      row.start_time = args.p_start_time;
      row.end_time = args.p_end_time;
      row.previous_start_time = sameStart;
      return { ok: true, booking: row };
    };

    const moved = await rescheduleBooking("tok-res-1", sameStart, sameEnd);
    expect(moved.startTime).toBe(sameStart);
  });

  it("rejects when the resource belongs to another business", async () => {
    fake().tables.resources = [
      { ...RESOURCE, id: "res-other", business_id: "biz-other" },
    ];
    fake().tables.bookings = [
      resourceBooking({ resource_id: "res-other" }),
    ];

    const newStart = futureIso(5, 14, 0);
    const newEnd = futureIso(5, 18, 0);
    await expect(
      rescheduleBooking("tok-res-1", newStart, newEnd),
    ).rejects.toMatchObject({ status: 400, code: "RESOURCE_NOT_FOUND" });
  });

  it("rejects when the booking has no resource_id", async () => {
    fake().tables.bookings = [
      resourceBooking({ resource_id: null }),
    ];

    const newStart = futureIso(5, 14, 0);
    const newEnd = futureIso(5, 18, 0);
    await expect(
      rescheduleBooking("tok-res-1", newStart, newEnd),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION" });
  });

  it("rejects when endTime is missing", async () => {
    fake().tables.bookings = [resourceBooking()];

    const newStart = futureIso(5, 14, 0);
    await expect(
      rescheduleBooking("tok-res-1", newStart),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION" });
  });

  it("rejects when end is before start", async () => {
    fake().tables.bookings = [resourceBooking()];

    const newStart = futureIso(5, 18, 0);
    const newEnd = futureIso(5, 14, 0);
    await expect(
      rescheduleBooking("tok-res-1", newStart, newEnd),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION" });
  });

  it("rejects when the new time is in the past", async () => {
    fake().tables.bookings = [resourceBooking()];

    await expect(
      rescheduleBooking(
        "tok-res-1",
        "2020-01-01T00:00:00.000Z",
        "2020-01-01T04:00:00.000Z",
      ),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION" });
  });

  it("rejects when the resource is deactivated", async () => {
    fake().tables.resources = [
      { ...RESOURCE, active: false },
    ];
    fake().tables.bookings = [resourceBooking()];

    const newStart = futureIso(5, 14, 0);
    const newEnd = futureIso(5, 18, 0);
    await expect(
      rescheduleBooking("tok-res-1", newStart, newEnd),
    ).rejects.toMatchObject({ status: 400, code: "RESOURCE_NOT_FOUND" });
  });
});
