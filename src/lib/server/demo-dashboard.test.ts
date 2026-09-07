/**
 * Demo dashboard loader tests (Phase 7 hardening).
 *
 * Verifies getDemoDashboardData():
 * - loads without auth for is_demo businesses
 * - returns null for unknown / empty slugs
 * - returns null for NON-demo businesses (no cross-business reads)
 * - masks customer PII (no full names, phones, or emails leak)
 * - normal /dashboard auth is untouched (see dashboard page guards)
 */
import { describe, it, expect, vi } from "vitest";
import {
  getDemoDashboardData,
  maskCustomerName,
  maskPhone,
} from "./demo-dashboard";

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private orderedAsc: boolean | null = null;
  private rangeFrom = 0;
  private rangeTo: number | null = null;

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  order(_col: string, _opts?: unknown): this {
    return this;
  }

  range(from: number, to: number): this {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  private matching(): Row[] {
    let rows = (this.tables[this.tableName] ?? []).filter((row) =>
      this.filters.every((pred) => pred(row)),
    );
    if (this.orderedAsc !== null) {
      rows = [...rows].sort((a, b) =>
        this.orderedAsc
          ? String(a.start_time).localeCompare(String(b.start_time))
          : String(b.start_time).localeCompare(String(a.start_time)),
      );
    }
    if (this.rangeTo !== null) rows = rows.slice(this.rangeFrom, this.rangeTo + 1);
    return rows;
  }

  async maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    return { data: this.matching()[0] ?? null, error: null };
  }

  async single(): Promise<{ data: unknown; error: unknown }> {
    return this.maybeSingle();
  }

  then<TResult = { data: unknown; error: unknown }>(
    onfulfilled?: (value: { data: unknown; error: unknown }) => TResult,
  ) {
    return Promise.resolve({ data: this.matching(), error: null }).then(onfulfilled as never);
  }
}

const holder: { db: { from: (t: string) => FakeQuery; tables: Record<string, Row[]> } | null } = { db: null };

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => {
    if (!holder.db) throw new Error("fake db not installed");
    return holder.db;
  },
}));

function makeDb(tables: Record<string, Row[]>) {
  const db = { tables, from(table: string) { return new FakeQuery(tables, table); } };
  holder.db = db;
  return db;
}

const DEMO_BUSINESS: Row = {
  id: "biz-demo",
  name: "Fade Area",
  phone: "+230 5711 1111",
  email: "demo@fadearea.mu",
  timezone: "Indian/Mauritius",
  booking_mode: "appointment",
  calendar_id: null,
  slug: "fade-area",
  is_demo: true,
  availability: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function bookingRow(overrides: Row = {}): Row {
  return {
    id: "b1",
    business_id: "biz-demo",
    service_id: "s1",
    customer_id: "c1",
    resource_id: null,
    session_id: null,
    quantity: 1,
    start_time: new Date(Date.now() + 3600000).toISOString(),
    end_time: new Date(Date.now() + 7200000).toISOString(),
    status: "confirmed",
    previous_start_time: null,
    calendar_sync_status: "not_connected",
    calendar_sync_error: null,
    calendar_synced_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    service: { id: "s1", name: "Haircut", duration_minutes: 45, price: 450 },
    customer: { id: "c1", name: "Jean-Marc Laval", phone: "+23057123456", email: "jm@example.com" },
    resource: null,
    session: null,
    ...overrides,
  };
}

describe("masking helpers", () => {
  it("maskCustomerName keeps first name only", () => {
    expect(maskCustomerName("Jean-Marc Laval")).toBe("Jean-Marc");
    expect(maskCustomerName("  ")).toBe("Guest");
  });

  it("maskPhone keeps last 2 digits only", () => {
    expect(maskPhone("+23057123456")).toBe("•••• ••56");
    expect(maskPhone("")).toBe("••••");
  });
});

describe("getDemoDashboardData", () => {
  it("returns null for unknown slug", async () => {
    const db = makeDb({ businesses: [], bookings: [], services: [], resources: [], booking_sessions: [] });
    await expect(getDemoDashboardData("nope", db as never)).resolves.toBeNull();
  });

  it("returns null for empty slug", async () => {
    const db = makeDb({ businesses: [], bookings: [], services: [], resources: [], booking_sessions: [] });
    await expect(getDemoDashboardData("", db as never)).resolves.toBeNull();
  });

  it("returns null for NON-demo businesses (production data stays private)", async () => {
    const db = makeDb({
      businesses: [{ ...DEMO_BUSINESS, id: "biz-prod", slug: "real-shop", name: "Real Shop", is_demo: false }],
      bookings: [bookingRow({ business_id: "biz-prod" })],
      services: [],
      resources: [],
      booking_sessions: [],
    });
    await expect(getDemoDashboardData("real-shop", db as never)).resolves.toBeNull();
  });

  it("loads demo data without auth and masks customer PII", async () => {
    const db = makeDb({
      businesses: [{ ...DEMO_BUSINESS }],
      bookings: [bookingRow()],
      services: [{ id: "s1", business_id: "biz-demo", name: "Haircut", duration_minutes: 45, price: 450, active: true }],
      resources: [],
      booking_sessions: [],
    });
    const data = await getDemoDashboardData("fade-area", db as never);
    expect(data?.business.name).toBe("Fade Area");
    const serialized = JSON.stringify(data);
    // Full PII must not leak into the demo payload.
    expect(serialized).not.toContain("Jean-Marc Laval");
    expect(serialized).not.toContain("+23057123456");
    expect(serialized).not.toContain("jm@example.com");
    expect(serialized).not.toContain("manage_token");
    // Masked representations are present instead.
    const first = [...(data?.today ?? []), ...(data?.upcoming ?? [])][0];
    expect(first?.customerDisplay).toBe("Jean-Marc");
    expect(first?.phoneDisplay).toBe("•••• ••56");
  });

  it("splits today and upcoming bookings", async () => {
    const db = makeDb({
      businesses: [{ ...DEMO_BUSINESS }],
      bookings: [
        bookingRow({ id: "b-today", start_time: new Date(Date.now() + 3600000).toISOString() }),
        bookingRow({ id: "b-later", start_time: new Date(Date.now() + 72 * 3600000).toISOString() }),
      ],
      services: [],
      resources: [],
      booking_sessions: [],
    });
    const data = await getDemoDashboardData("fade-area", db as never);
    const ids = [...(data?.today ?? []), ...(data?.upcoming ?? [])].map((b) => b.id);
    expect(ids).toContain("b-today");
    expect(ids).toContain("b-later");
  });
});
