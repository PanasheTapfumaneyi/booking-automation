/**
 * Resource interval availability (multi-day rental search) — engine tests.
 *
 * Proves the 14 rental scenarios the walkthrough relies on: per-vehicle
 * overlap rejection (exact / end-overlap / start-overlap / surrounding),
 * same period on a DIFFERENT vehicle stays bookable, back-to-back is allowed,
 * cancelled/completed never block, self-exclusion on reschedule, and the
 * payload carries image + metadata + available flags for the fleet grid.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  resourceIntervalAvailability,
  resourceAvailability,
  isUnitRatedCollection,
} from "./resource";
import type { BusinessRow, ResourceRow, ServiceRow } from "@/lib/server/database";

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

  not(column: string, operator: string, value: unknown): this {
    if (operator === "is" && value === null) {
      this.filters.push((row) => row[column] !== null);
    } else {
      this.filters.push((row) => row[column] !== value);
    }
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

function mkBusiness(): BusinessRow {
  return {
    id: "biz-1",
    name: "Kivo Drive",
    phone: "+230 5744 4444",
    email: "demo@kivodrive.mu",
    timezone: TZ,
    booking_mode: "resource",
    calendar_id: null,
    slug: "kivo-drive",
    is_demo: true,
    is_active: true,
    availability: null,
    tagline: null,
    description: null,
    cover_image_url: null,
    logo_url: null,
    theme_config: null,
    address: null,
    latitude: null,
    longitude: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function mkService(): ServiceRow {
  return {
    id: "svc-car",
    business_id: "biz-1",
    name: "Car Rental",
    description: null,
    duration_minutes: 1440,
    price: "1500",
    image_url: null,
    active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function resourceRow(id: string, name: string, rate?: number): ResourceRow {
  return {
    id,
    business_id: "biz-1",
    name,
    resource_type: "vehicle",
    image_url: null,
    active: true,
    metadata: rate ? { rate, seats: 5 } : {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function booking(
  id: string,
  resourceId: string,
  start: string,
  end: string,
  status = "confirmed",
): Row {
  return {
    id,
    business_id: "biz-1",
    service_id: "svc-car",
    resource_id: resourceId,
    session_id: null,
    quantity: 1,
    start_time: start,
    end_time: end,
    status,
  };
}

const VITZ = "res-vitz";
const SWIFT = "res-swift";

// A fixed, far-future, non-overlapping test interval (walkthrough dates).
const QUERY_START = "2026-10-14T06:00:00.000Z"; // 10:00 Mauritius
const QUERY_END = "2026-10-16T06:00:00.000Z";

async function intervalOk(extra: { excludeBookingId?: string } = {}) {
  const payload = await resourceIntervalAvailability({
    business: mkBusiness(),
    service: mkService(),
    startIso: QUERY_START,
    endIso: QUERY_END,
    excludeBookingId: extra.excludeBookingId,
  });
  const byName: Record<string, boolean> = {};
  for (const r of payload.resources) {
    byName[r.id] = r.available === true;
  }
  return { payload, byName };
}

beforeEach(() => {
  holder.tables = {
    resources: [
      { id: VITZ, business_id: "biz-1", name: "Toyota Vitz", resource_type: "vehicle", active: true, image_url: null, metadata: { rate: 1400, seats: 5 } },
      { id: SWIFT, business_id: "biz-1", name: "Suzuki Swift", resource_type: "vehicle", active: true, image_url: null, metadata: { rate: 1600, seats: 5 } },
    ],
    // A booking for another business with the same vehicle must never block.
    bookings: [
      { ...booking("b-other-biz", VITZ, QUERY_START, QUERY_END), business_id: "biz-OTHER" },
    ],
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  holder.tables = null;
});

describe("resourceIntervalAvailability — per-vehicle conflict semantics", () => {
  it("returns every active resource with image + metadata + available flags", async () => {
    const { payload, byName } = await intervalOk();
    expect(payload.kind).toBe("resource");
    expect(payload.startIso).toBe(QUERY_START);
    expect(payload.endIso).toBe(QUERY_END);
    expect(payload.resources).toHaveLength(2);
    expect(byName).toEqual({ [VITZ]: true, [SWIFT]: true });
    expect(payload.resources[0]).toMatchObject({ active: true });
    expect(payload.resources[0].metadata).toMatchObject({ rate: 1400 });
  });

  it("blocks a vehicle whose reservation exactly matches the query interval", async () => {
    holder.tables!.bookings.push(booking("b-full", VITZ, QUERY_START, QUERY_END));
    const { byName } = await intervalOk();
    expect(byName[VITZ]).toBe(false);
    expect(byName[SWIFT]).toBe(true); // different vehicle stays bookable
  });

  it("blocks when the query starts inside an existing reservation", async () => {
    // Existing stay: Oct 13 → Oct 15. Query Oct 14 → 16 overlaps its tail.
    holder.tables!.bookings.push(booking("b-starts-inside", VITZ, "2026-10-13T06:00:00.000Z", "2026-10-15T06:00:00.000Z"));
    const { byName } = await intervalOk();
    expect(byName[VITZ]).toBe(false);
  });

  it("blocks when the query ends inside an existing reservation", async () => {
    // Existing stay: Oct 15 → Oct 17. Query Oct 14 → 16 overlaps its head.
    holder.tables!.bookings.push(booking("b-ends-inside", VITZ, "2026-10-15T06:00:00.000Z", "2026-10-17T06:00:00.000Z"));
    const { byName } = await intervalOk();
    expect(byName[VITZ]).toBe(false);
  });

  it("blocks when an existing reservation surrounds the query", async () => {
    holder.tables!.bookings.push(booking("b-surrounds", VITZ, "2026-10-13T06:00:00.000Z", "2026-10-17T06:00:00.000Z"));
    const { byName } = await intervalOk();
    expect(byName[VITZ]).toBe(false);
  });

  it("leaves a vehicle free when the query sits entirely before a reservation", async () => {
    holder.tables!.bookings.push(booking("b-later", VITZ, "2026-10-17T06:00:00.000Z", "2026-10-18T06:00:00.000Z"));
    const { byName } = await intervalOk();
    expect(byName[VITZ]).toBe(true);
  });

  it("leaves a vehicle free when the query sits entirely after a reservation", async () => {
    holder.tables!.bookings.push(booking("b-earlier", VITZ, "2026-10-12T06:00:00.000Z", "2026-10-13T06:00:00.000Z"));
    const { byName } = await intervalOk();
    expect(byName[VITZ]).toBe(true);
  });

  it("allows back-to-back bookings (return equals next pickup)", async () => {
    holder.tables!.bookings.push(booking("b-backtoback", VITZ, "2026-10-16T06:00:00.000Z", "2026-10-17T06:00:00.000Z"));
    const { byName } = await intervalOk();
    expect(byName[VITZ]).toBe(true);
  });

  it("never blocks on cancelled, completed or no_show bookings", async () => {
    holder.tables!.bookings.push(booking("b-cancelled", VITZ, QUERY_START, QUERY_END, "cancelled"));
    holder.tables!.bookings.push(booking("b-completed", VITZ, QUERY_START, QUERY_END, "completed"));
    holder.tables!.bookings.push(booking("b-noshow", VITZ, QUERY_START, QUERY_END, "no_show"));
    const { byName } = await intervalOk();
    expect(byName[VITZ]).toBe(true);
  });

  it("blocks only the booked vehicle — a different vehicle is free for the same period", async () => {
    holder.tables!.bookings.push(booking("b-vitz", VITZ, QUERY_START, QUERY_END));
    const { byName } = await intervalOk();
    expect(byName[VITZ]).toBe(false);
    expect(byName[SWIFT]).toBe(true);
  });

  it("excludes a self reservation when rescheduling (excludeBookingId)", async () => {
    holder.tables!.bookings.push(booking("b-me", VITZ, QUERY_START, QUERY_END));
    const { byName } = await intervalOk({ excludeBookingId: "b-me" });
    expect(byName[VITZ]).toBe(true);
    expect(byName[SWIFT]).toBe(true);
  });

  it("excludes a reservation from another business entirely", async () => {
    const { byName } = await intervalOk();
    expect(byName[VITZ]).toBe(true);
    expect(byName[SWIFT]).toBe(true);
  });

  it("banned statuses are gone from CONFIDENTLY confirmed bookings", async () => {
    holder.tables!.bookings.push(booking("b-blocks", VITZ, QUERY_START, QUERY_END, "rescheduled"));
    const { byName } = await intervalOk();
    expect(byName[VITZ]).toBe(false); // rescheduled still blocks
  });
});

describe("resource availability — plain payload", () => {
  it("lists active resources without availability flags (non-interval path)", async () => {
    const payload = await resourceAvailability({
      business: mkBusiness(),
      service: mkService(),
      date: "2026-10-14",
    });
    expect(payload.kind).toBe("resource");
    expect(payload.resources.map((r) => r.id)).toEqual([VITZ, SWIFT]);
    expect(payload.resources[0].available).toBeUndefined();
    expect("startIso" in payload).toBe(false);
  });
});

describe("isUnitRatedCollection", () => {
  it("is true only when every resource carries a per-day rate", () => {
    expect(isUnitRatedCollection([resourceRow("a", "Vitz", 1400), resourceRow("b", "Swift", 1600)])).toBe(true);
    expect(isUnitRatedCollection([resourceRow("a", "Vitz")])).toBe(false);
    expect(isUnitRatedCollection([resourceRow("a", "Vitz", 1400), resourceRow("b", "Swift")])).toBe(false);
    expect(isUnitRatedCollection([])).toBe(false);
  });
});