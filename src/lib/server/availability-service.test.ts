/**
 * Availability exclusion semantics tests (hardening patch).
 *
 * The trusted engine parameter excludeBookingId still works when reached
 * through an authorized path (manage token resolved server-side, or a
 * membership-verified caller passing a verified id). The manage token is
 * the capability: it can only ever exclude its own booking, never another.
 * Plain queries see every booking as occupied.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getAvailability } from "./availability-service";
import { getSlotsForDay, isoToDateKey } from "@/lib/availability";

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

const holder: { tables: Record<string, Row[]> | null } = { tables: null };

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => {
    if (!holder.tables) throw new Error("fake db not installed");
    const tables = holder.tables;
    return { from: (table: string) => new FakeQuery(tables, table) };
  },
}));

const TZ = "Indian/Mauritius";

function seed(): { dateKey: string; slotA: Row; slotB: Row } {
  if (!holder.tables) throw new Error("fake db not installed");
  holder.tables.businesses = [
    {
      id: "biz-1",
      name: "Fade District",
      timezone: TZ,
      booking_mode: "appointment",
      availability: null,
    },
  ];
  holder.tables.services = [
    {
      id: "svc-1",
      business_id: "biz-1",
      name: "Haircut",
      duration_minutes: 60,
      price: 500,
      active: true,
    },
  ];
  holder.tables.calendar_connections = [];
  holder.tables.bookings = [];

  for (let offset = 2; offset < 29; offset += 1) {
    const date = new Date(Date.now() + offset * 86400000);
    const dateKey = isoToDateKey(date.toISOString(), TZ);
    const slots = getSlotsForDay(dateKey, { durationMinutes: 60 }, [], TZ);
    if (slots.length >= 3) {
      const mkBooking = (id: string, token: string, slot: { startTime: string; endTime: string }) => ({
        id,
        business_id: "biz-1",
        service_id: "svc-1",
        manage_token: token,
        status: "confirmed",
        start_time: slot.startTime,
        end_time: slot.endTime,
        quantity: 1,
        resource_id: null,
        session_id: null,
        google_event_id: null,
      });
      holder.tables.bookings.push(mkBooking("b-a", "tok-a", slots[0]));
      holder.tables.bookings.push(mkBooking("b-b", "tok-b", slots[2]));
      return {
        dateKey,
        slotA: slots[0] as unknown as Row,
        slotB: slots[2] as unknown as Row,
      };
    }
  }
  throw new Error("no suitable test date with 3+ slots in the booking window");
}

type SlotStarts = string[];

async function slotStarts(
  dateKey: string,
  extra: { excludeBookingToken?: string; excludeBookingId?: string } = {},
): Promise<SlotStarts> {
  const result = (await getAvailability({
    businessId: "biz-1",
    serviceId: "svc-1",
    date: dateKey,
    ...extra,
  })) as unknown as { slots: Array<{ startTime: string }> };
  return result.slots.map((slot) => slot.startTime);
}

beforeEach(() => {
  holder.tables = {};
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  holder.tables = null;
});

describe("availability exclusion semantics", () => {
  it("plain queries see every booking as occupied", async () => {
    const { dateKey, slotA, slotB } = seed();
    const starts = await slotStarts(dateKey);
    expect(starts).not.toContain(slotA.startTime);
    expect(starts).not.toContain(slotB.startTime);
  });

  it("a manage token excludes only its own booking", async () => {
    const { dateKey, slotA, slotB } = seed();
    const starts = await slotStarts(dateKey, { excludeBookingToken: "tok-a" });
    expect(starts).toContain(slotA.startTime);
    expect(starts).not.toContain(slotB.startTime);
  });

  it("an invalid manage token excludes nothing", async () => {
    const { dateKey, slotA, slotB } = seed();
    const starts = await slotStarts(dateKey, { excludeBookingToken: "tok-bogus" });
    expect(starts).not.toContain(slotA.startTime);
    expect(starts).not.toContain(slotB.startTime);
  });

  it("a verified booking id excludes its booking (trusted internal path)", async () => {
    const { dateKey, slotA, slotB } = seed();
    const starts = await slotStarts(dateKey, { excludeBookingId: "b-b" });
    expect(starts).toContain(slotB.startTime);
    expect(starts).not.toContain(slotA.startTime);
  });

  it("an unknown booking id excludes nothing", async () => {
    const { dateKey, slotA, slotB } = seed();
    const starts = await slotStarts(dateKey, { excludeBookingId: "b-missing" });
    expect(starts).not.toContain(slotA.startTime);
    expect(starts).not.toContain(slotB.startTime);
  });
});
