/**
 * Business booking layer tests (Phase 6B).
 *
 * Covers: sanitizer (no manage_token), business-timezone day bounds
 * (incl. Mauritius midnight-crossing and west-of-UTC), scoped listing with
 * filters/pagination, cross-business isolation, customer search scoping,
 * safe notification summaries, counts, and create/reschedule/cancel reuse
 * of the shared core (constraints, tokens, idempotency preserved).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  sanitizeBooking,
  getBusinessDayBounds,
  listBusinessBookings,
  fetchBusinessBookingById,
  searchBusinessCustomers,
  fetchBookingNotificationSummary,
  fetchBusinessBookingCounts,
  createBusinessBooking,
  rescheduleBusinessBooking,
  cancelBusinessBooking,
} from "./business-bookings";
import { getSlotsForDay, isoToDateKey } from "@/lib/availability";
import type { Booking } from "@/types/booking";

/** A real future on-grid slot so engine slot validation passes. */
function nextBookableSlot(durationMinutes = 45): { startIso: string; endIso: string } {
  const tz = "Indian/Mauritius";
  for (let dayOffset = 4; dayOffset < 14; dayOffset += 1) {
    const date = new Date(Date.now() + dayOffset * 86400000);
    const key = isoToDateKey(date.toISOString(), tz);
    const slots = getSlotsForDay(key, { durationMinutes }, [], tz);
    if (slots.length > 0) {
      const start = new Date(slots[0].startTime).getTime();
      return {
        startIso: new Date(start).toISOString(),
        endIso: new Date(start + durationMinutes * 60_000).toISOString(),
      };
    }
  }
  throw new Error("no bookable slot found in test window");
}

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private patch: Row | null = null;
  private insertRow: Row | null = null;
  private ordering: Array<{ column: string; ascending: boolean }> = [];
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private limitCount: number | null = null;
  private headCount = false;
  private flushed: Row[] | null = null;

  constructor(
    private tables: Record<string, Row[]>,
    private tableName: string,
    private rpcImpl: ((fn: string, args: Row) => unknown) | null,
  ) {}

  select(..._args: unknown[]): this {
    const opts = _args[1] as { count?: string; head?: boolean } | undefined;
    if (opts?.head) this.headCount = true;
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

  lte(column: string, value: unknown): this {
    this.filters.push((row) => (row[column] as string) <= (value as string));
    return this;
  }

  gt(column: string, value: unknown): this {
    this.filters.push((row) => (row[column] as string) > (value as string));
    return this;
  }

  gte(column: string, value: unknown): this {
    this.filters.push((row) => (row[column] as string) >= (value as string));
    return this;
  }

  or(condition: string): this {
    const alternatives: Array<{ column: string; needle: string }> = [];
    for (const part of condition.split(",")) {
      const match = /^(\w+)\.ilike\.(.*)$/.exec(part);
      if (!match) continue;
      alternatives.push({ column: match[1], needle: match[2].replace(/%/g, "").toLowerCase() });
    }
    this.filters.push((row) =>
      alternatives.some(({ column, needle }) =>
        String(row[column] ?? "").toLowerCase().includes(needle),
      ),
    );
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    this.ordering.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }

  range(from: number, to: number): this {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  limit(n: number): this {
    this.limitCount = n;
    return this;
  }

  update(patch: Row): this {
    this.patch = patch;
    return this;
  }

  insert(row: Row): this {
    this.insertRow = { ...row };
    return this;
  }

  private rows(): Row[] {
    if (!this.tables[this.tableName]) this.tables[this.tableName] = [];
    return this.tables[this.tableName];
  }

  private matching(): Row[] {
    let out = this.rows().filter((row) => this.filters.every((p) => p(row)));
    for (const { column, ascending } of this.ordering) {
      out = [...out].sort((a, b) => {
        const av = a[column] as string;
        const bv = b[column] as string;
        if (av === bv) return 0;
        return ascending ? (av < bv ? -1 : 1) : av > bv ? -1 : 1;
      });
    }
    if (this.rangeFrom !== null && this.rangeTo !== null) {
      out = out.slice(this.rangeFrom, this.rangeTo + 1);
    } else if (this.limitCount !== null) {
      out = out.slice(0, this.limitCount);
    }
    return out;
  }

  private flush(): void {
    if (this.insertRow) return;
    if (!this.patch) {
      this.flushed = null;
      return;
    }
    const matched = this.matching();
    const patch = this.patch;
    this.patch = null;
    for (const row of matched) Object.assign(row, patch);
    this.flushed = matched;
  }

  private result(): Row[] {
    return this.flushed ?? this.matching();
  }

  async maybeSingle(): Promise<{ data: unknown; error: null }> {
    if (this.insertRow) {
      const record = { ...this.insertRow, id: (this.insertRow.id as string) ?? `gen-${this.rows().length}` };
      this.rows().push(record);
      this.insertRow = null;
      return { data: { id: record.id }, error: null };
    }
    this.flush();
    return { data: this.result()[0] ?? null, error: null };
  }

  async single(): Promise<{ data: unknown; error: null }> {
    return this.maybeSingle();
  }

  then<TResult = { data: unknown; error: unknown; count?: number }>(
    onfulfilled?: (value: { data: unknown; error: unknown; count?: number }) => TResult,
  ) {
    this.flush();
    const matched = this.result();
    const value = this.headCount
      ? { data: [], error: null, count: matched.length }
      : { data: matched, error: null };
    return Promise.resolve(value).then(onfulfilled as never);
  }
}

interface FakeDb {
  tables: Record<string, Row[]>;
  rpcImpl: ((fn: string, args: Row) => unknown) | null;
  from: (table: string) => FakeQuery;
  rpc: (fn: string, args: Row) => Promise<{ data: unknown; error: null }>;
}

function createFakeDb(): FakeDb {
  const store: FakeDb = {
    tables: {},
    rpcImpl: null,
    from(table: string) {
      return new FakeQuery(store.tables, table, store.rpcImpl);
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

const BUSINESS = {
  id: "biz-1",
  name: "Fade District",
  phone: null,
  email: null,
  timezone: "Indian/Mauritius",
  booking_mode: "appointment",
  calendar_id: null,
  slug: "fade-district",
  availability: null,
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
    start_time: "2026-09-08T06:00:00.000Z",
    end_time: "2026-09-08T06:45:00.000Z",
    status: "confirmed",
    google_event_id: null,
    manage_token: "tok-secret-1",
    previous_start_time: null,
    calendar_sync_status: "synced",
    calendar_sync_error: null,
    calendar_synced_at: "2026-09-06T00:00:00.000Z",
    created_at: "2026-09-06T00:00:00.000Z",
    updated_at: "2026-09-06T00:00:00.000Z",
    service: { id: "svc-1", name: "Haircut", duration_minutes: 45, price: 500 },
    customer: { id: "cust-1", name: "Jean-Marc", phone: "+23057123456", email: null },
    resource: null,
    session: null,
    ...overrides,
  };
}

function seedCore(db: FakeDb): void {
  db.tables.businesses = [{ ...BUSINESS }];
  db.tables.services = [{ ...SERVICE }];
  db.tables.customers = [
    { id: "cust-1", business_id: "biz-1", name: "Jean-Marc", phone: "+23057123456", email: null },
    { id: "cust-2", business_id: "biz-1", name: "Ravi", phone: "+23057222222", email: null },
    { id: "cust-9", business_id: "biz-9", name: "Stranger", phone: "+23057999999", email: null },
  ];
  db.tables.bookings = [];
  db.tables.notifications = [];
  db.tables.calendar_connections = [];
}

beforeEach(() => {
  holder.db = createFakeDb();
});

afterEach(() => {
  vi.unstubAllEnvs();
  holder.db = null;
});

// ---------------------------------------------------------------------------

describe("sanitizeBooking", () => {
  it("strips manage_token and google_event_id, keeps everything else", () => {
    const full = {
      id: "b-1",
      manageToken: "tok-secret",
      googleEventId: "evt-1",
      serviceName: "Haircut",
    } as unknown as Booking;
    const clean = sanitizeBooking(full);
    expect(clean).not.toHaveProperty("manageToken");
    expect(clean).not.toHaveProperty("googleEventId");
    expect(clean.id).toBe("b-1");
    expect(JSON.stringify(clean)).not.toContain("tok-secret");
  });
});

describe("getBusinessDayBounds", () => {
  it("uses the business timezone across the Mauritius midnight boundary", () => {
    // 23:30 local on Sep 7 in Mauritius == 19:30Z Sep 7.
    const bounds = getBusinessDayBounds(
      "Indian/Mauritius",
      new Date("2026-09-07T19:30:00.000Z"),
    );
    expect(bounds.todayKey).toBe("2026-09-07");
    expect(bounds.dayStartUtc).toBe("2026-09-06T20:00:00.000Z");
    expect(bounds.dayEndUtc).toBe("2026-09-07T20:00:00.000Z");
  });

  it("handles west-of-UTC zones (local date differs from UTC date)", () => {
    // 03:30Z Sep 7 == 23:30 local Sep 6 in New York (EDT, UTC-4).
    const bounds = getBusinessDayBounds(
      "America/New_York",
      new Date("2026-09-07T03:30:00.000Z"),
    );
    expect(bounds.todayKey).toBe("2026-09-06");
    expect(bounds.dayStartUtc).toBe("2026-09-06T04:00:00.000Z");
    expect(bounds.dayEndUtc).toBe("2026-09-07T04:00:00.000Z");
  });
});

describe("listing + isolation", () => {
  function seedBookings(db: FakeDb): void {
    seedCore(db);
    db.tables.bookings = [
      bookingRow({ id: "b-today", start_time: "2026-09-08T06:00:00.000Z", end_time: "2026-09-08T06:45:00.000Z", status: "confirmed" }),
      bookingRow({ id: "b-later", start_time: "2026-09-09T06:00:00.000Z", end_time: "2026-09-09T06:45:00.000Z", status: "confirmed" }),
      bookingRow({ id: "b-cancelled", start_time: "2026-09-08T08:00:00.000Z", end_time: "2026-09-08T08:45:00.000Z", status: "cancelled" }),
      bookingRow({ id: "b-other", business_id: "biz-9", start_time: "2026-09-08T06:00:00.000Z", end_time: "2026-09-08T06:45:00.000Z", status: "confirmed", manage_token: "tok-other" }),
    ];
  }

  it("filters by status + date range and never leaks other businesses", async () => {
    const db = holder.db as FakeDb;
    seedBookings(db);
    const rows = await listBusinessBookings(
      "biz-1",
      {
        statuses: ["confirmed", "rescheduled"],
        fromIso: "2026-09-08T00:00:00.000Z",
        toIso: "2026-09-09T00:00:00.000Z",
      },
      db as never,
    );
    expect(rows.map((r) => r.id)).toEqual(["b-today"]);
    for (const row of rows) {
      expect(row).not.toHaveProperty("manageToken");
    }
  });

  it("paginates and orders", async () => {
    const db = holder.db as FakeDb;
    seedBookings(db);
    const first = await listBusinessBookings("biz-1", { limit: 2, offset: 0 }, db as never);
    const second = await listBusinessBookings("biz-1", { limit: 2, offset: 2 }, db as never);
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(1);
    expect(first[0].startTime <= first[1].startTime).toBe(true);
    const desc = await listBusinessBookings("biz-1", { order: "desc", limit: 10 }, db as never);
    expect(desc[0].startTime >= desc[desc.length - 1].startTime).toBe(true);
  });

  it("fetchBusinessBookingById returns null across businesses", async () => {
    const db = holder.db as FakeDb;
    seedBookings(db);
    expect(await fetchBusinessBookingById("biz-1", "b-today", db as never)).not.toBeNull();
    expect(await fetchBusinessBookingById("biz-1", "b-other", db as never)).toBeNull();
    expect(await fetchBusinessBookingById("biz-1", "missing", db as never)).toBeNull();
  });
});

describe("searchBusinessCustomers", () => {
  it("matches name and phone within the business only", async () => {
    const db = holder.db as FakeDb;
    seedCore(db);
    expect(await searchBusinessCustomers("biz-1", "jean", db as never)).toEqual([
      { id: "cust-1", name: "Jean-Marc", phone: "+23057123456", email: null },
    ]);
    expect(await searchBusinessCustomers("biz-1", "57222222", db as never)).toEqual([
      { id: "cust-2", name: "Ravi", phone: "+23057222222", email: null },
    ]);
    // Same-name customer of another business is not exposed.
    expect(await searchBusinessCustomers("biz-1", "stranger", db as never)).toEqual([]);
  });

  it("requires at least two characters", async () => {
    const db = holder.db as FakeDb;
    seedCore(db);
    await expect(searchBusinessCustomers("biz-1", "j", db as never)).resolves.toEqual([]);
  });
});

describe("fetchBookingNotificationSummary", () => {
  it("returns safe status fields in chronological order", async () => {
    const db = holder.db as FakeDb;
    seedCore(db);
    db.tables.notifications = [
      {
        id: "n-2",
        event_type: "booking.rescheduled",
        recipient_type: "customer",
        channel: "whatsapp",
        status: "sent",
        error_code: null,
        sent_at: "2026-09-07T00:00:00.000Z",
        created_at: "2026-09-07T00:00:00.000Z",
        booking_id: "b-1",
        destination: "+23057123456",
        provider_message_id: "secret-id",
      },
      {
        id: "n-1",
        event_type: "booking.created",
        recipient_type: "customer",
        channel: "whatsapp",
        status: "sent",
        error_code: null,
        sent_at: "2026-09-06T00:00:00.000Z",
        created_at: "2026-09-06T00:00:00.000Z",
        booking_id: "b-1",
        destination: "+23057123456",
        provider_message_id: "secret-id",
      },
    ];
    const rows = await fetchBookingNotificationSummary("b-1", db as never);
    expect(rows).toHaveLength(2);
    expect(rows[0].event_type).toBe("booking.created");
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(
        ["created_at", "error_code", "event_type", "recipient_type", "sent_at", "status"],
      );
    }
    expect(JSON.stringify(rows)).not.toContain("secret-id");
    expect(JSON.stringify(rows)).not.toContain("+23057123456");
  });
});

describe("fetchBusinessBookingCounts", () => {
  it("counts today/upcoming/failed/sync-issues with bounded queries", async () => {
    const db = holder.db as FakeDb;
    seedCore(db);
    // Mauritius Sep 8: local day == 2026-09-07T20:00Z .. 2026-09-08T20:00Z.
    const now = new Date("2026-09-08T06:00:00.000Z");
    db.tables.bookings = [
      bookingRow({ id: "b-today", start_time: "2026-09-08T06:00:00.000Z", status: "confirmed" }),
      bookingRow({ id: "b-tomorrow", start_time: "2026-09-09T06:00:00.000Z", status: "confirmed" }),
      bookingRow({ id: "b-past", start_time: "2026-09-07T06:00:00.000Z", status: "confirmed" }),
      bookingRow({ id: "b-cancelled", start_time: "2026-09-08T08:00:00.000Z", status: "cancelled" }),
      bookingRow({ id: "b-sync-bad", start_time: "2026-09-09T08:00:00.000Z", status: "confirmed", calendar_sync_status: "failed" }),
    ];
    db.tables.notifications = [
      { id: "n-f", business_id: "biz-1", booking_id: "b-today", status: "failed", created_at: "2026-09-08T05:00:00.000Z" },
      { id: "n-old", business_id: "biz-1", booking_id: "b-past", status: "failed", created_at: "2026-08-01T00:00:00.000Z" },
    ];
    const result = await fetchBusinessBookingCounts({ id: "biz-1", timezone: "Indian/Mauritius" }, now, db as never);
    expect(result.today).toBe(1);
    expect(result.upcoming).toBe(2);
    expect(result.failedNotifications).toBe(1);
    expect(result.calendarIssues).toBe(1);
  });
});

describe("business mutations reuse the shared core", () => {
  function rpcForBooking(overrides: Row = {}) {
    return (_fn: string, args: Row) => ({
      ok: true,
      booking: bookingRow({
        id: "b-new",
        business_id: args.p_business_id,
        service_id: args.p_service_id,
        customer_id: args.p_customer_id,
        start_time: args.p_start_time,
        end_time: args.p_end_time,
        manage_token: args.p_manage_token,
        ...overrides,
      }),
    });
  }

  it("creates an appointment booking without leaking the token", async () => {
    const db = holder.db as FakeDb;
    seedCore(db);
    db.rpcImpl = rpcForBooking();
    const slot = nextBookableSlot();
    const created = await createBusinessBooking(
      { ...BUSINESS, booking_mode: "appointment" } as never,
      {
        serviceId: "svc-1",
        startTime: slot.startIso,
        endTime: slot.endIso,
        name: "New Guy",
        phone: "+23057333333",
      },
      db as never,
    );
    expect(created.serviceName).toBe("Haircut");
    expect(created).not.toHaveProperty("manageToken");
    expect(JSON.stringify(created)).not.toContain("tok-");
  });

  it("refuses services of another business", async () => {
    const db = holder.db as FakeDb;
    seedCore(db);
    db.tables.services = [
      { ...SERVICE, id: "svc-x", business_id: "biz-9", name: "X", duration_minutes: 30, price: 1, active: true },
    ];
    await expect(
      createBusinessBooking({ ...BUSINESS } as never, {
        serviceId: "svc-x",
        startTime: "2026-09-10T06:00:00.000Z",
        endTime: "2026-09-10T06:45:00.000Z",
        name: "New Guy",
        phone: "+23057333333",
      }, db as never),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("propagates conflicts (409) from the core", async () => {
    const db = holder.db as FakeDb;
    seedCore(db);
    db.rpcImpl = () => ({ ok: false, code: "SLOT_UNAVAILABLE" });
    const slot = nextBookableSlot();
    await expect(
      createBusinessBooking({ ...BUSINESS } as never, {
        serviceId: "svc-1",
        startTime: slot.startIso,
        endTime: slot.endIso,
        name: "New Guy",
        phone: "+23057333333",
      }, db as never),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("reuses an existing customer by id within the business", async () => {
    const db = holder.db as FakeDb;
    seedCore(db);
    db.rpcImpl = rpcForBooking();
    const slot = nextBookableSlot();
    const created = await createBusinessBooking({ ...BUSINESS } as never, {
      serviceId: "svc-1",
      startTime: slot.startIso,
      endTime: slot.endIso,
      name: "",
      phone: "",
      customerId: "cust-2",
    }, db as never);
    expect(created.customerName).toBe("Ravi");
    await expect(
      createBusinessBooking({ ...BUSINESS } as never, {
        serviceId: "svc-1",
        startTime: slot.startIso,
        endTime: slot.endIso,
        name: "",
        phone: "",
        customerId: "cust-9",
      }, db as never),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("reschedules through the core and keeps the token server-side", async () => {
    const db = holder.db as FakeDb;
    seedCore(db);
    db.tables.bookings = [bookingRow({ id: "b-1", manage_token: "tok-keep", status: "confirmed" })];
    db.rpcImpl = (_fn, args) => {
      // Mirror the real RPC: the stored row actually moves.
      Object.assign(db.tables.bookings[0], {
        status: "rescheduled",
        start_time: args.p_start_time,
        end_time: args.p_end_time,
        previous_start_time: "2026-09-08T06:00:00.000Z",
      });
      return {
        ok: true,
        booking: bookingRow({
          id: "b-1",
          manage_token: "tok-keep",
          status: "rescheduled",
          start_time: args.p_start_time,
          end_time: args.p_end_time,
          previous_start_time: "2026-09-08T06:00:00.000Z",
        }),
      };
    };
    const slot = nextBookableSlot();
    const moved = await rescheduleBusinessBooking("biz-1", "b-1", slot.startIso, db as never);
    expect(moved.startTime).toBe(slot.startIso);
    expect(moved.status).toBe("rescheduled");
    expect(moved).not.toHaveProperty("manageToken");
    expect(JSON.stringify(moved)).not.toContain("tok-keep");
    // Cross-business reschedule is a safe 404 (token never involved).
    await expect(
      rescheduleBusinessBooking("biz-9", "b-1", slot.startIso, db as never),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("cancels through the core: cancelled, kept, idempotent-safe", async () => {
    const db = holder.db as FakeDb;
    seedCore(db);
    db.tables.bookings = [bookingRow({ id: "b-1", manage_token: "tok-keep", status: "confirmed" })];
    const cancelled = await cancelBusinessBooking("biz-1", "b-1", db as never);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled).not.toHaveProperty("manageToken");
    expect(db.tables.bookings).toHaveLength(1);
    // Repeat → safe 409, still present.
    await expect(cancelBusinessBooking("biz-1", "b-1", db as never)).rejects.toMatchObject({
      status: 409,
    });
    expect(db.tables.bookings).toHaveLength(1);
    // Other business → 404.
    await expect(cancelBusinessBooking("biz-9", "b-1", db as never)).rejects.toMatchObject({
      status: 404,
    });
  });
});
