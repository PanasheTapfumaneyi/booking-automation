/**
 * Public booking creation tests (Phase 6C).
 *
 * Proves the POST /api/bookings endpoint handles all three booking modes:
 * - appointment (unchanged from Phase 2.5)
 * - resource (new in 6C)
 * - capacity (new in 6C)
 *
 * Security: cross-business resource/session IDs are rejected safely.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { POST } from "./route";

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private insertRow: Row | null = null;

  constructor(
    private tables: Record<string, Row[]>,
    private tableName: string,
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

  gte(column: string, value: unknown): this {
    this.filters.push((row) => (row[column] as string) >= (value as string));
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  limit(_n: number): this {
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  order(_col?: string, _opts?: unknown): this {
    return this;
  }

  insert(row: Row): this {
    this.insertRow = { ...row };
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(_patch: Row): this {
    return this;
  }

  delete(): this {
    return this;
  }

  private matching(): Row[] {
    return (this.tables[this.tableName] ?? []).filter((row) =>
      this.filters.every((pred) => pred(row)),
    );
  }

  private commitInsert(): { data: unknown; error: null } {
    const row = this.insertRow as Row;
    this.insertRow = null;
    const record = { ...row, id: (row.id as string) ?? `gen-${(this.tables[this.tableName] ?? []).length}` };
    if (!this.tables[this.tableName]) this.tables[this.tableName] = [];
    this.tables[this.tableName].push(record);
    return { data: { id: record.id }, error: null };
  }

  async maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    if (this.insertRow) return this.commitInsert();
    return { data: this.matching()[0] ?? null, error: null };
  }

  async single(): Promise<{ data: unknown; error: unknown }> {
    return this.maybeSingle();
  }

  then<TResult = { data: unknown; error: unknown }>(
    onfulfilled?: (value: { data: unknown; error: unknown }) => TResult,
  ) {
    if (this.insertRow) return Promise.resolve(this.commitInsert()).then(onfulfilled as never);
    return Promise.resolve({ data: this.matching(), error: null }).then(onfulfilled as never);
  }
}

interface FakeDb {
  tables: Record<string, Row[]>;
  from: (table: string) => FakeQuery;
  rpcImpl: ((fn: string, args: Row) => unknown) | null;
  rpc: (fn: string, args: Row) => Promise<{ data: unknown; error: null }>;
}

function createFakeDb(): FakeDb {
  const store: FakeDb = {
    tables: {},
    from(table: string) {
      return new FakeQuery(store.tables, table);
    },
    rpcImpl: null,
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

vi.mock("@/lib/server/token", () => ({
  generateManageToken: () => "tok-test-123",
}));

vi.mock("@/lib/server/notifications/service", () => ({
  dispatchBookingEvent: vi.fn().mockResolvedValue({ dispatched: false }),
}));

vi.mock("@/lib/server/google-calendar/sync", () => ({
  syncAfterCreate: vi.fn().mockResolvedValue(undefined),
  assertNewTimeCalendarFree: vi.fn().mockResolvedValue(undefined),
  moveCalendarEvent: vi.fn().mockResolvedValue(undefined),
  syncAfterCancel: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  holder.db = null;
});

function makeRequest(body: unknown): Request {
  return { json: async () => body } as Request;
}

// ---------------------------------------------------------------------------
// Appointment mode (regression)
// ---------------------------------------------------------------------------

describe("POST /api/bookings — appointment mode", () => {
  function seed(): void {
    const db = createFakeDb();
    db.tables.businesses = [
      { id: "biz-1", name: "Fade", booking_mode: "appointment", timezone: "Indian/Mauritius" },
    ];
    db.tables.services = [
      { id: "svc-1", business_id: "biz-1", name: "Cut", duration_minutes: 45, price: 500, active: true },
    ];
    db.tables.customers = [];
    db.tables.bookings = [];
    db.tables.resources = [];
    db.tables.booking_sessions = [];
    db.tables.calendar_connections = [];
    db.rpcImpl = (_fn, args) => ({
      ok: true,
      booking: {
        id: "b-new",
        business_id: "biz-1",
        service_id: "svc-1",
        customer_id: "cust-new",
        resource_id: null,
        session_id: null,
        quantity: 1,
        start_time: args.p_start_time,
        end_time: args.p_end_time,
        status: "confirmed",
        google_event_id: null,
        manage_token: args.p_manage_token,
        previous_start_time: null,
        created_at: "2026-09-06T00:00:00.000Z",
        updated_at: "2026-09-06T00:00:00.000Z",
        service: { name: "Cut", duration_minutes: 45, price: 500 },
        customer: { name: "Jean-Marc", phone: "+23057123456", email: null },
      },
    });
    holder.db = db;
  }

  it("creates an appointment booking", async () => {
    seed();
    const response = await POST(
      makeRequest({
        serviceId: "svc-1",
        startTime: "2026-09-10T06:00:00.000Z",
        endTime: "2026-09-10T06:45:00.000Z",
        name: "Jean-Marc",
        phone: "+23057123456",
      }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as { booking: Row };
    expect(body.booking.manageToken).toBe("tok-test-123");
  });

  it("rejects missing contact info", async () => {
    seed();
    const response = await POST(
      makeRequest({
        serviceId: "svc-1",
        startTime: "2026-09-10T06:00:00.000Z",
        endTime: "2026-09-10T06:45:00.000Z",
        name: "",
        phone: "+23057123456",
      }),
    );
    expect(response.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Resource mode (Phase 6C)
// ---------------------------------------------------------------------------

describe("POST /api/bookings — resource mode", () => {
  function seed(): void {
    const db = createFakeDb();
    db.tables.businesses = [
      { id: "biz-res", name: "Car Rental", booking_mode: "resource", timezone: "Indian/Mauritius" },
    ];
    db.tables.services = [
      { id: "svc-res", business_id: "biz-res", name: "Daily Rental", duration_minutes: 1440, price: 2000, active: true },
    ];
    db.tables.resources = [
      { id: "res-1", business_id: "biz-res", name: "Corolla", resource_type: "vehicle", active: true },
      { id: "res-inactive", business_id: "biz-res", name: "Old", resource_type: "vehicle", active: false },
      { id: "res-other", business_id: "biz-other", name: "Stolen", resource_type: "vehicle", active: true },
    ];
    db.tables.customers = [];
    db.tables.bookings = [];
    db.tables.booking_sessions = [];
    db.tables.calendar_connections = [];
    db.rpcImpl = (_fn, args) => ({
      ok: true,
      booking: {
        id: "b-res-new",
        business_id: "biz-res",
        service_id: "svc-res",
        customer_id: "cust-new",
        resource_id: args.p_resource_id ?? null,
        session_id: null,
        quantity: 1,
        start_time: args.p_start_time,
        end_time: args.p_end_time,
        status: "confirmed",
        google_event_id: null,
        manage_token: args.p_manage_token,
        previous_start_time: null,
        created_at: "2026-09-06T00:00:00.000Z",
        updated_at: "2026-09-06T00:00:00.000Z",
        service: { name: "Daily Rental", duration_minutes: 1440, price: 2000 },
        customer: { name: "Jean-Marc", phone: "+23057123456", email: null },
      },
    });
    holder.db = db;
  }

  it("creates a resource booking", async () => {
    seed();
    const response = await POST(
      makeRequest({
        serviceId: "svc-res",
        startTime: "2026-09-10T08:00:00.000Z",
        endTime: "2026-09-11T08:00:00.000Z",
        name: "Jean-Marc",
        phone: "+23057123456",
        resourceId: "res-1",
      }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as { booking: Row };
    expect(body.booking.resourceId).toBe("res-1");
  });

  it("rejects without resourceId", async () => {
    seed();
    const response = await POST(
      makeRequest({
        serviceId: "svc-res",
        startTime: "2026-09-10T08:00:00.000Z",
        endTime: "2026-09-11T08:00:00.000Z",
        name: "Jean-Marc",
        phone: "+23057123456",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects cross-business resource", async () => {
    seed();
    const response = await POST(
      makeRequest({
        serviceId: "svc-res",
        startTime: "2026-09-10T08:00:00.000Z",
        endTime: "2026-09-11T08:00:00.000Z",
        name: "Jean-Marc",
        phone: "+23057123456",
        resourceId: "res-other",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects inactive resource", async () => {
    seed();
    const response = await POST(
      makeRequest({
        serviceId: "svc-res",
        startTime: "2026-09-10T08:00:00.000Z",
        endTime: "2026-09-11T08:00:00.000Z",
        name: "Jean-Marc",
        phone: "+23057123456",
        resourceId: "res-inactive",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects end before start", async () => {
    seed();
    const response = await POST(
      makeRequest({
        serviceId: "svc-res",
        startTime: "2026-09-11T08:00:00.000Z",
        endTime: "2026-09-10T08:00:00.000Z",
        name: "Jean-Marc",
        phone: "+23057123456",
        resourceId: "res-1",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects past booking", async () => {
    seed();
    const response = await POST(
      makeRequest({
        serviceId: "svc-res",
        startTime: "2020-01-01T00:00:00.000Z",
        endTime: "2020-01-02T00:00:00.000Z",
        name: "Jean-Marc",
        phone: "+23057123456",
        resourceId: "res-1",
      }),
    );
    expect(response.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Capacity mode (Phase 6C)
// ---------------------------------------------------------------------------

describe("POST /api/bookings — capacity mode", () => {
  function seed(): void {
    const db = createFakeDb();
    db.tables.businesses = [
      { id: "biz-cap", name: "Surf School", booking_mode: "capacity", timezone: "Indian/Mauritius" },
    ];
    db.tables.services = [
      { id: "svc-cap", business_id: "biz-cap", name: "Group Lesson", duration_minutes: 120, price: 800, active: true },
    ];
    db.tables.resources = [];
    db.tables.customers = [];
    db.tables.bookings = [];
    db.tables.booking_sessions = [
      {
        id: "sess-1",
        business_id: "biz-cap",
        service_id: "svc-cap",
        start_time: "2026-12-01T08:00:00.000Z",
        end_time: "2026-12-01T10:00:00.000Z",
        capacity: 10,
        active: true,
      },
      {
        id: "sess-other",
        business_id: "biz-other",
        service_id: "svc-other",
        start_time: "2026-12-01T08:00:00.000Z",
        end_time: null,
        capacity: 5,
        active: true,
      },
      {
        id: "sess-inactive",
        business_id: "biz-cap",
        service_id: "svc-cap",
        start_time: "2026-12-03T08:00:00.000Z",
        end_time: null,
        capacity: 5,
        active: false,
      },
    ];
    db.tables.calendar_connections = [];
    db.rpcImpl = (_fn, args) => ({
      ok: true,
      booking: {
        id: "b-cap-new",
        business_id: "biz-cap",
        service_id: "svc-cap",
        customer_id: "cust-new",
        resource_id: null,
        session_id: args.p_session_id ?? null,
        quantity: args.p_quantity ?? 1,
        start_time: args.p_start_time,
        end_time: args.p_end_time,
        status: "confirmed",
        google_event_id: null,
        manage_token: args.p_manage_token,
        previous_start_time: null,
        created_at: "2026-09-06T00:00:00.000Z",
        updated_at: "2026-09-06T00:00:00.000Z",
        service: { name: "Group Lesson", duration_minutes: 120, price: 800 },
        customer: { name: "Jean-Marc", phone: "+23057123456", email: null },
      },
    });
    holder.db = db;
  }

  it("creates a capacity booking", async () => {
    seed();
    const response = await POST(
      makeRequest({
        serviceId: "svc-cap",
        startTime: "2026-12-01T08:00:00.000Z",
        endTime: "2026-12-01T10:00:00.000Z",
        name: "Jean-Marc",
        phone: "+23057123456",
        sessionId: "sess-1",
        quantity: 2,
      }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as { booking: Row };
    expect(body.booking.sessionId).toBe("sess-1");
    expect(body.booking.quantity).toBe(2);
  });

  it("rejects without sessionId", async () => {
    seed();
    const response = await POST(
      makeRequest({
        serviceId: "svc-cap",
        startTime: "2026-12-01T08:00:00.000Z",
        endTime: "2026-12-01T10:00:00.000Z",
        name: "Jean-Marc",
        phone: "+23057123456",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("defaults quantity to 1", async () => {
    seed();
    const response = await POST(
      makeRequest({
        serviceId: "svc-cap",
        startTime: "2026-12-01T08:00:00.000Z",
        endTime: "2026-12-01T10:00:00.000Z",
        name: "Jean-Marc",
        phone: "+23057123456",
        sessionId: "sess-1",
      }),
    );
    expect(response.status).toBe(201);
  });
});
