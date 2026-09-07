/**
 * Availability hours-threading tests (Phase 6A).
 *
 * Proves the appointment strategy reads per-business hours: custom hours
 * reshape slots and are echoed in the response for the client calendar,
 * while businesses without hours keep the exact legacy grid.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import type { BusinessRow, ServiceRow } from "@/lib/server/database";
import { appointmentAvailability } from "./appointment";

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];

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

  private matching(): Row[] {
    return (this.tables[this.tableName] ?? []).filter((row) =>
      this.filters.every((pred) => pred(row)),
    );
  }

  async maybeSingle(): Promise<{ data: unknown; error: null }> {
    return { data: this.matching()[0] ?? null, error: null };
  }

  then<TResult = { data: unknown; error: null }>(
    onfulfilled?: (value: { data: unknown; error: null }) => TResult,
  ) {
    return Promise.resolve({ data: this.matching(), error: null }).then(
      onfulfilled as never,
    );
  }
}

interface FakeDb {
  tables: Record<string, Row[]>;
  from: (table: string) => FakeQuery;
}

const holder: { db: FakeDb | null } = { db: null };

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => {
    if (!holder.db) throw new Error("fake db not installed");
    return holder.db;
  },
}));

function createFakeDb(): FakeDb {
  const store: FakeDb = {
    tables: {},
    from(table: string) {
      return new FakeQuery(store.tables, table);
    },
  };
  return store;
}

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
  duration_minutes: 60,
  price: 500,
  active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllEnvs();
  holder.db = null;
});

describe("appointmentAvailability hours", () => {
  it("uses custom business hours for the slot grid and echoes them", async () => {
    const db = createFakeDb();
    db.tables.businesses = [
      { ...BUSINESS, availability: { mon: { open: "10:00", close: "12:00" } } },
    ];
    db.tables.services = [SERVICE];
    db.tables.bookings = [];
    db.tables.calendar_connections = [];
    holder.db = db;

    const result = await appointmentAvailability({
      business: db.tables.businesses[0] as unknown as BusinessRow,
      service: SERVICE as unknown as ServiceRow,
      date: "2026-09-07", // Monday
    });

    expect(result.business.hours).toEqual({ mon: { open: "10:00", close: "12:00" } });
    expect(result.slots.map((s) => s.label)).toEqual(["10:00", "10:30", "11:00"]);
  });

  it("keeps the legacy grid when no hours are configured", async () => {
    const db = createFakeDb();
    db.tables.businesses = [{ ...BUSINESS, availability: null }];
    db.tables.services = [SERVICE];
    db.tables.bookings = [];
    db.tables.calendar_connections = [];
    holder.db = db;

    const result = await appointmentAvailability({
      business: db.tables.businesses[0] as unknown as BusinessRow,
      service: SERVICE as unknown as ServiceRow,
      date: "2026-09-07",
    });

    expect(result.business.hours).toBeNull();
    // Legacy Monday grid for a 60-minute service: 09:00–17:00.
    expect(result.slots).toHaveLength(17);
    expect(result.slots[0].label).toBe("09:00");
  });
});
