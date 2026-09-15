/**
 * Public business site loader tests (Phase 7 hardening).
 *
 * Verifies getBusinessSiteData():
 * - null for unknown / empty slugs (safe 404)
 * - mode-appropriate offerings with inactive rows filtered
 * - future sessions only, soonest first
 * - only intended-public data (no customers, bookings, tokens)
 */
import { describe, it, expect, vi } from "vitest";
import { getBusinessSiteData } from "./public-site";

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

  in(column: string, values: unknown[]): this {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  limit(_n: number): this {
    return this;
  }

  insert(row: Row): this {
    this.insertRow = { ...row };
    return this;
  }

  private matching(): Row[] {
    return (this.tables[this.tableName] ?? []).filter((row) =>
      this.filters.every((pred) => pred(row)),
    );
  }

  async maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    if (this.insertRow) {
      this.insertRow = null;
      return { data: { id: `gen-${Date.now()}` }, error: null };
    }
    return { data: this.matching()[0] ?? null, error: null };
  }

  async single(): Promise<{ data: unknown; error: unknown }> {
    return this.maybeSingle();
  }

  then<TResult = { data: unknown; error: unknown }>(
    onfulfilled?: (value: { data: unknown; error: unknown }) => TResult,
  ) {
    if (this.insertRow) return Promise.resolve(this.maybeSingle()).then(onfulfilled as never);
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

const BASE_BUSINESS: Row = {
  id: "biz-1",
  name: "Fade Area",
  phone: "+230 5711 1111",
  email: "demo@fadearea.mu",
  timezone: "Indian/Mauritius",
  booking_mode: "appointment",
  calendar_id: null,
  slug: "fade-area",
  is_demo: true,
  is_active: true,
  availability: null,
  tagline: "Your neighbourhood barbershop",
  description: "Walk-ins welcome, appointments preferred.",
  cover_image_url: "https://example.com/hero.jpg",
  logo_url: "https://example.com/logo.png",
  theme_config: null,
  address: null,
  latitude: null,
  longitude: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("getBusinessSiteData", () => {
  it("returns null for unknown slug", async () => {
    const db = makeDb({ businesses: [], services: [], resources: [], booking_sessions: [], bookings: [] });
    await expect(getBusinessSiteData("nope", db as never)).resolves.toBeNull();
  });

  it("returns null for empty slug", async () => {
    const db = makeDb({ businesses: [], services: [], resources: [], booking_sessions: [], bookings: [] });
    await expect(getBusinessSiteData("   ", db as never)).resolves.toBeNull();
  });

  it("appointment business exposes active services only", async () => {
    const db = makeDb({
      businesses: [{ ...BASE_BUSINESS }],
      services: [
        { id: "s1", business_id: "biz-1", name: "Haircut", duration_minutes: 45, price: 450, active: true },
        { id: "s2", business_id: "biz-1", name: "Old Service", duration_minutes: 30, price: 100, active: false },
      ],
      resources: [],
      booking_sessions: [],
      bookings: [],
    });
    const data = await getBusinessSiteData("fade-area", db as never);
    expect(data?.business.name).toBe("Fade Area");
    expect(data?.services.map((s) => s.name)).toEqual(["Haircut"]);
  });

  it("resource business exposes active resources", async () => {
    const db = makeDb({
      businesses: [{ ...BASE_BUSINESS, booking_mode: "resource", name: "Island Surf Co.", slug: "island-surf" }],
      services: [],
      resources: [
        { id: "r1", business_id: "biz-1", name: "Shortboard", resource_type: "equipment", active: true },
        { id: "r2", business_id: "biz-1", name: "Broken Board", resource_type: "equipment", active: false },
      ],
      booking_sessions: [],
      bookings: [],
    });
    const data = await getBusinessSiteData("island-surf", db as never);
    expect(data?.resources.map((r) => r.name)).toEqual(["Shortboard"]);
  });

  it("capacity business exposes future sessions soonest-first", async () => {
    const future1 = new Date(Date.now() + 86400000).toISOString();
    const future2 = new Date(Date.now() + 2 * 86400000).toISOString();
    const past = new Date(Date.now() - 86400000).toISOString();
    const db = makeDb({
      businesses: [{ ...BASE_BUSINESS, booking_mode: "capacity", name: "Blue Lagoon", slug: "blue-lagoon" }],
      services: [{ id: "s1", business_id: "biz-1", name: "Lesson", duration_minutes: 60, price: 350, active: true }],
      resources: [],
      booking_sessions: [
        { id: "ss-late", business_id: "biz-1", service_id: "s1", start_time: future2, end_time: future2, capacity: 10, active: true, service: { name: "Lesson" } },
        { id: "ss-early", business_id: "biz-1", service_id: "s1", start_time: future1, end_time: future1, capacity: 10, active: true, service: { name: "Lesson" } },
        { id: "ss-past", business_id: "biz-1", service_id: "s1", start_time: past, end_time: past, capacity: 10, active: true, service: { name: "Lesson" } },
        { id: "ss-off", business_id: "biz-1", service_id: "s1", start_time: future1, end_time: future1, capacity: 10, active: false, service: { name: "Lesson" } },
      ],
      bookings: [],
    });
    const data = await getBusinessSiteData("blue-lagoon", db as never);
    expect(data?.sessions.map((s) => s.id)).toEqual(["ss-early", "ss-late"]);
  });

  it("exposes no customer, booking, or token data", async () => {
    const db = makeDb({
      businesses: [{ ...BASE_BUSINESS }],
      services: [{ id: "s1", business_id: "biz-1", name: "Haircut", duration_minutes: 45, price: 450, active: true }],
      resources: [],
      booking_sessions: [],
      bookings: [],
    });
    const data = await getBusinessSiteData("fade-area", db as never);
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("manage_token");
    expect(serialized).not.toContain("customer");
  });

  it("passes through customization fields (tagline, description, cover_image_url, logo_url)", async () => {
    const db = makeDb({
      businesses: [{ ...BASE_BUSINESS }],
      services: [],
      resources: [],
      booking_sessions: [],
      bookings: [],
    });
    const data = await getBusinessSiteData("fade-area", db as never);
    expect(data?.business.tagline).toBe("Your neighbourhood barbershop");
    expect(data?.business.description).toBe("Walk-ins welcome, appointments preferred.");
    expect(data?.business.cover_image_url).toBe("https://example.com/hero.jpg");
    expect(data?.business.logo_url).toBe("https://example.com/logo.png");
  });

  it("handles null customization fields gracefully", async () => {
    const db = makeDb({
      businesses: [{ ...BASE_BUSINESS, tagline: null, description: null, cover_image_url: null, logo_url: null }],
      services: [],
      resources: [],
      booking_sessions: [],
      bookings: [],
    });
    const data = await getBusinessSiteData("fade-area", db as never);
    expect(data?.business.tagline).toBeNull();
    expect(data?.business.description).toBeNull();
    expect(data?.business.cover_image_url).toBeNull();
    expect(data?.business.logo_url).toBeNull();
  });

  it("active businesses are never flagged as preview", async () => {
    const db = makeDb({
      businesses: [{ ...BASE_BUSINESS, is_active: true }],
      services: [],
      resources: [],
      booking_sessions: [],
      bookings: [],
    });
    const data = await getBusinessSiteData("fade-area", db as never, {
      previewBusinessIds: ["biz-1"],
    });
    expect(data?.preview).toBe(false);
  });
});

describe("getBusinessSiteData — inactive member preview", () => {
  function inactiveDb() {
    return makeDb({
      businesses: [{ ...BASE_BUSINESS, is_active: false }],
      services: [],
      resources: [],
      booking_sessions: [],
      bookings: [],
    });
  }

  it("inactive businesses stay hidden from the public", async () => {
    const db = inactiveDb();
    await expect(getBusinessSiteData("fade-area", db as never)).resolves.toBeNull();
  });

  it("inactive businesses stay hidden from other members", async () => {
    const db = inactiveDb();
    await expect(
      getBusinessSiteData("fade-area", db as never, { previewBusinessIds: ["biz-other"] }),
    ).resolves.toBeNull();
  });

  it("inactive businesses render for their own members with the preview flag", async () => {
    const db = inactiveDb();
    const data = await getBusinessSiteData("fade-area", db as never, {
      previewBusinessIds: ["biz-1"],
    });
    expect(data?.business.id).toBe("biz-1");
    expect(data?.preview).toBe(true);
  });
});
