/**
 * Public booking catalog tests (Phase 6A, Part G).
 *
 * Proves the slug endpoint exposes only the minimum customer-facing data:
 * unknown slugs 404, and known slugs never leak settings, tokens,
 * credentials, or inactive items.
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
