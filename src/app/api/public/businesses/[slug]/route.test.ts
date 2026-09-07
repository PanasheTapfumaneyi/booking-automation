/**
 * Public booking catalog tests (Phase 6A, Part G).
 *
 * Proves the slug endpoint exposes only the minimum customer-facing data:
 * unknown slugs 404, and known slugs never leak settings, tokens,
 * credentials, or inactive items.
 *
 * Phase 6C: extends to verify resource/capacity mode catalog shapes.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { GET } from "./route";

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

const capacityMock = vi.hoisted(() => ({
  fn: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/server/strategies/capacity", () => ({
  fetchSessionBookedQuantity: capacityMock.fn,
}));

function seed(): void {
  holder.tables = {
    businesses: [
      {
        id: "biz-1",
        name: "Fade District",
        phone: "+230",
        timezone: "Indian/Mauritius",
        booking_mode: "appointment",
        slug: "fade-district",
        availability: { mon: { open: "10:00", close: "12:00" } },
      },
    ],
    services: [
      { id: "svc-1", business_id: "biz-1", name: "Cut", duration_minutes: 45, price: 500, active: true },
      { id: "svc-2", business_id: "biz-1", name: "Retired", duration_minutes: 30, price: 1, active: false },
    ],
    resources: [],
    booking_sessions: [],
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  holder.tables = null;
  capacityMock.fn.mockReset();
  capacityMock.fn.mockResolvedValue(0);
});

const paramsFor = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("GET /api/public/businesses/[slug]", () => {
  it("returns 404 for unknown slugs", async () => {
    seed();
    const response = await GET({} as Request, paramsFor("nope"));
    expect(response.status).toBe(404);
  });

  it("exposes only the minimum public catalog data", async () => {
    seed();
    const response = await GET({} as Request, paramsFor("fade-district"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    const business = body.business as Record<string, unknown>;
    expect(business).toMatchObject({
      id: "biz-1",
      name: "Fade District",
      booking_mode: "appointment",
      slug: "fade-district",
    });
    expect(business.hours).toEqual({ mon: { open: "10:00", close: "12:00" } });
    // Inactive services are hidden; shape is customer-facing.
    expect(body.services).toEqual([
      {
        id: "svc-1",
        businessId: "biz-1",
        name: "Cut",
        durationMinutes: 45,
        price: 500,
        active: true,
      },
    ]);
    // Nothing sensitive anywhere in the payload.
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/manage_token|refresh_token|secret|api_key|password/i);
    expect(serialized).not.toContain("Retired");
  });
});

// ---------------------------------------------------------------------------
// Phase 6C: resource mode catalog
// ---------------------------------------------------------------------------

describe("catalog — resource mode", () => {
  function seedResource(): void {
    holder.tables = {
      businesses: [
        {
          id: "biz-res",
          name: "Car Rental",
          phone: "+230",
          timezone: "Indian/Mauritius",
          booking_mode: "resource",
          slug: "car-rental",
          availability: null,
        },
      ],
      services: [
        { id: "svc-res", business_id: "biz-res", name: "Daily Rental", duration_minutes: 1440, price: 2000, active: true },
      ],
      resources: [
        { id: "res-1", business_id: "biz-res", name: "Corolla", resource_type: "vehicle", active: true },
        { id: "res-2", business_id: "biz-res", name: "Civic", resource_type: "vehicle", active: true },
        { id: "res-inactive", business_id: "biz-res", name: "Old Van", resource_type: "vehicle", active: false },
      ],
      booking_sessions: [],
    };
  }

  it("returns booking_mode=resource", async () => {
    seedResource();
    const response = await GET({} as Request, paramsFor("car-rental"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect((body.business as Record<string, unknown>).booking_mode).toBe("resource");
  });

  it("returns only active resources belonging to this business", async () => {
    seedResource();
    // Add a resource from another business — must not appear
    holder.tables!.resources.push({
      id: "res-other",
      business_id: "biz-other",
      name: "Stolen Car",
      resource_type: "vehicle",
      active: true,
    });

    const response = await GET({} as Request, paramsFor("car-rental"));
    const body = (await response.json()) as Record<string, unknown>;
    const resources = body.resources as Array<Record<string, unknown>>;
    expect(resources).toHaveLength(2);
    expect(resources.map((r) => r.id)).toEqual(["res-1", "res-2"]);
    expect(JSON.stringify(resources)).not.toContain("Stolen Car");
  });

  it("inactive resources are excluded", async () => {
    seedResource();
    const response = await GET({} as Request, paramsFor("car-rental"));
    const body = (await response.json()) as Record<string, unknown>;
    const resources = body.resources as Array<Record<string, unknown>>;
    expect(resources.every((r) => r.active === true)).toBe(true);
  });

  it("sessions are empty for resource mode", async () => {
    seedResource();
    const response = await GET({} as Request, paramsFor("car-rental"));
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.sessions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Phase 6C: capacity mode catalog
// ---------------------------------------------------------------------------

describe("catalog — capacity mode", () => {
  function seedCapacity(): void {
    holder.tables = {
      businesses: [
        {
          id: "biz-cap",
          name: "Surf School",
          phone: "+230",
          timezone: "Indian/Mauritius",
          booking_mode: "capacity",
          slug: "surf-school",
          availability: null,
        },
      ],
      services: [
        { id: "svc-cap", business_id: "biz-cap", name: "Group Lesson", duration_minutes: 120, price: 800, active: true },
      ],
      resources: [],
      booking_sessions: [
        {
          id: "sess-1",
          business_id: "biz-cap",
          service_id: "svc-cap",
          start_time: "2026-12-01T08:00:00.000Z",
          end_time: "2026-12-01T10:00:00.000Z",
          capacity: 10,
          active: true,
          service: { name: "Group Lesson" },
        },
        {
          id: "sess-2",
          business_id: "biz-cap",
          service_id: "svc-cap",
          start_time: "2026-12-02T08:00:00.000Z",
          end_time: "2026-12-02T10:00:00.000Z",
          capacity: 5,
          active: true,
          service: { name: "Group Lesson" },
        },
        {
          id: "sess-inactive",
          business_id: "biz-cap",
          service_id: "svc-cap",
          start_time: "2026-12-03T08:00:00.000Z",
          end_time: null,
          capacity: 8,
          active: false,
          service: { name: "Group Lesson" },
        },
      ],
    };
  }

  it("returns booking_mode=capacity", async () => {
    seedCapacity();
    const response = await GET({} as Request, paramsFor("surf-school"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect((body.business as Record<string, unknown>).booking_mode).toBe("capacity");
  });

  it("returns only active sessions with booked/remaining counts", async () => {
    seedCapacity();
    capacityMock.fn.mockImplementation(async ({ sessionId }: { sessionId: string }) => {
      if (sessionId === "sess-1") return 3;
      if (sessionId === "sess-2") return 5;
      return 0;
    });

    const response = await GET({} as Request, paramsFor("surf-school"));
    const body = (await response.json()) as Record<string, unknown>;
    const sessions = body.sessions as Array<Record<string, unknown>>;

    expect(sessions).toHaveLength(2);
    expect(sessions.map((s) => s.id)).toEqual(["sess-1", "sess-2"]);

    const s1 = sessions.find((s) => s.id === "sess-1")!;
    expect(s1.capacity).toBe(10);
    expect(s1.booked).toBe(3);
    expect(s1.remaining).toBe(7);

    const s2 = sessions.find((s) => s.id === "sess-2")!;
    expect(s2.capacity).toBe(5);
    expect(s2.booked).toBe(5);
    expect(s2.remaining).toBe(0);
  });

  it("inactive sessions are excluded", async () => {
    seedCapacity();
    const response = await GET({} as Request, paramsFor("surf-school"));
    const body = (await response.json()) as Record<string, unknown>;
    const sessions = body.sessions as Array<Record<string, unknown>>;
    expect(sessions.every((s) => s.active === true)).toBe(true);
    expect(sessions.some((s) => s.id === "sess-inactive")).toBe(false);
  });

  it("sessions from other businesses are excluded", async () => {
    seedCapacity();
    holder.tables!.booking_sessions.push({
      id: "sess-other",
      business_id: "biz-other",
      service_id: "svc-other",
      start_time: "2026-12-01T08:00:00.000Z",
      end_time: null,
      capacity: 20,
      active: true,
      service: { name: "Other School" },
    });

    const response = await GET({} as Request, paramsFor("surf-school"));
    const body = (await response.json()) as Record<string, unknown>;
    const sessions = body.sessions as Array<Record<string, unknown>>;
    expect(sessions.every((s) => s.id !== "sess-other")).toBe(true);
  });

  it("resources are empty for capacity mode", async () => {
    seedCapacity();
    const response = await GET({} as Request, paramsFor("surf-school"));
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.resources).toEqual([]);
  });
});
