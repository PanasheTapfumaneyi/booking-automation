/**
 * Business booking route authorization tests (Phase 6B).
 *
 * Mocks identity (auth module) and storage (supabase client) to prove the
 * HTTP layer maps 401/403/404 correctly and never serializes manage_token,
 * google_event_id, or any credential — regardless of what the helpers do.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiError } from "@/lib/server/errors";
import { GET as getDetail } from "./[bookingId]/route";
import { GET as getList } from "./route";
import { POST as createBooking } from "./create/route";

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private patch: Row | null = null;
  private flushed: Row[] | null = null;

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

  gte(column: string, value: unknown): this {
    this.filters.push((row) => (row[column] as string) >= (value as string));
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push((row) => (row[column] as string) < (value as string));
    return this;
  }

  order(): this {
    return this;
  }

  range(): this {
    return this;
  }

  update(patch: Row): this {
    this.patch = patch;
    return this;
  }

  private rows(): Row[] {
    if (!this.tables[this.tableName]) this.tables[this.tableName] = [];
    return this.tables[this.tableName];
  }

  private matching(): Row[] {
    return this.rows().filter((row) => this.filters.every((p) => p(row)));
  }

  private flush(): void {
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

  async maybeSingle(): Promise<{ data: unknown; error: null }> {
    this.flush();
    const rows = this.flushed ?? this.matching();
    return { data: rows[0] ?? null, error: null };
  }

  then<TResult = { data: unknown; error: null }>(
    onfulfilled?: (value: { data: unknown; error: null }) => TResult,
  ) {
    this.flush();
    return Promise.resolve({ data: this.flushed ?? this.matching(), error: null }).then(
      onfulfilled as never,
    );
  }
}

const BIZ = {
  id: "biz-1",
  name: "Fade District",
  phone: null,
  email: null,
  timezone: "Indian/Mauritius",
  booking_mode: "appointment",
  calendar_id: null,
  slug: "fade-district",
  availability: null,
  created_at: "",
  updated_at: "",
};

const holder: { tables: Record<string, Row[]> | null } = { tables: null };

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => {
    if (!holder.tables) throw new Error("fake db not installed");
    const tables = holder.tables;
    return { from: (table: string) => new FakeQuery(tables, table) };
  },
}));

const authMock = vi.hoisted(() => ({
  requireBusinessOwner: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => authMock);

function ownerCtx() {
  return {
    user: { id: "user-1", email: "owner@example.com" },
    membership: { business_id: "biz-1", role: "owner" },
    business: BIZ,
  };
}

function seed(): void {
  holder.tables = {
    bookings: [
      {
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
        google_event_id: "g-evt-1",
        manage_token: "tok-top-secret",
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
      },
    ],
    notifications: [
      {
        id: "n-1",
        event_type: "booking.created",
        recipient_type: "customer",
        status: "sent",
        error_code: null,
        sent_at: "2026-09-06T00:00:00.000Z",
        created_at: "2026-09-06T00:00:00.000Z",
        booking_id: "b-1",
        destination: "+23057123456",
        provider_message_id: "wa-secret",
      },
    ],
  };
}

function paramsFor(id: string): { params: Promise<{ id: string }> };
function paramsFor(id: string, bookingId: string): { params: Promise<{ id: string; bookingId: string }> };
function paramsFor(id: string, bookingId?: string) {
  return {
    params: Promise.resolve(bookingId ? { id, bookingId } : { id }),
  };
}

beforeEach(() => {
  seed();
  authMock.requireBusinessOwner.mockImplementation(async () => ownerCtx());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  holder.tables = null;
});

describe("business booking routes", () => {
  it("rejects unauthenticated callers with 401", async () => {
    authMock.requireBusinessOwner.mockRejectedValueOnce(
      new ApiError(401, "UNAUTHENTICATED", "Please log in to continue."),
    );
    const response = await getDetail({} as Request, paramsFor("biz-1", "b-1"));
    expect(response.status).toBe(401);
  });

  it("rejects non-members with 403", async () => {
    authMock.requireBusinessOwner.mockRejectedValueOnce(
      new ApiError(403, "FORBIDDEN", "You don't have access to this business."),
    );
    const response = await getList(
      { url: "http://localhost/api/businesses/biz-9/bookings" } as Request,
      paramsFor("biz-9"),
    );
    expect(response.status).toBe(403);
  });

  it("detail never returns manage_token, google_event_id, or credentials", async () => {
    const response = await getDetail({} as Request, paramsFor("biz-1", "b-1"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("tok-top-secret");
    expect(serialized).not.toContain("g-evt-1");
    expect(serialized).not.toContain("wa-secret");
    // The customer phone appears exactly once (booking section) — never in
    // the notification timeline.
    expect(serialized.split("+23057123456").length - 1).toBe(1);
    const booking = body.booking as Record<string, unknown>;
    expect(booking.id).toBe("b-1");
    expect(booking.customerPhone).toBe("+23057123456");
    const notifications = body.notifications as Array<Record<string, unknown>>;
    expect(notifications).toHaveLength(1);
    expect(Object.keys(notifications[0]).sort()).toEqual(
      ["created_at", "error_code", "event_type", "recipient_type", "sent_at", "status"],
    );
  });

  it("unknown booking ids are a safe 404 with no data", async () => {
    const response = await getDetail({} as Request, paramsFor("biz-1", "missing"));
    expect(response.status).toBe(404);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("booking");
    expect(JSON.stringify(body)).not.toContain("tok-top-secret");
  });

  it("list responses never contain manage tokens", async () => {
    const response = await getList(
      { url: "http://localhost/api/businesses/biz-1/bookings?view=all" } as Request,
      paramsFor("biz-1"),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { bookings: unknown[] };
    expect(body.bookings).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("tok-top-secret");
    expect(JSON.stringify(body)).not.toContain("g-evt-1");
  });

  it("create validates the service belongs to the business (404 otherwise)", async () => {
    const request = {
      json: async () => ({
        serviceId: "svc-other",
        startTime: "2026-09-10T06:00:00.000Z",
        endTime: "2026-09-10T06:45:00.000Z",
        name: "X",
        phone: "+23050000000",
      }),
    } as Request;
    // No svc-other row in the fake services table → 404 SERVICE_NOT_FOUND.
    const response = await createBooking(request, paramsFor("biz-1"));
    expect(response.status).toBe(404);
  });
});
