/**
 * Google Calendar self-service gating tests (Phase 6A).
 *
 * Proves member businesses pass the allowlist without env changes, strangers
 * are rejected, and the allowlisted demo flow keeps working untouched.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { startConnect, assertCalendarRouteAccess } from "./connections";

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
}

const holder: { tables: Record<string, Row[]> | null } = { tables: null };

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => {
    if (!holder.tables) throw new Error("fake db not installed");
    const tables = holder.tables;
    return { from: (table: string) => new FakeQuery(tables, table) };
  },
}));

const BIZ = {
  id: "biz-9",
  name: "Nine",
  phone: null,
  email: null,
  timezone: "Indian/Mauritius",
  booking_mode: "appointment",
  calendar_id: null,
  slug: "nine",
  availability: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function seed(): void {
  holder.tables = { businesses: [BIZ] };
}

function stubOAuthEnv(): void {
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-123");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret-456");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "http://localhost:3000/api/integrations/google-calendar/callback");
  vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef");
}

afterEach(() => {
  vi.unstubAllEnvs();
  holder.tables = null;
});

describe("calendar self-service access", () => {
  it("admits a member business without allowlist changes", async () => {
    seed();
    stubOAuthEnv();
    vi.stubEnv("GOOGLE_CAL_ALLOWED_BUSINESS_IDS", "some-other-biz");
    const url = await startConnect({ businessId: "biz-9", memberBusinessIds: ["biz-9"] });
    expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url).toContain("calendar");
  });

  it("rejects strangers with 403", async () => {
    seed();
    stubOAuthEnv();
    vi.stubEnv("GOOGLE_CAL_ALLOWED_BUSINESS_IDS", "some-other-biz");
    const err = await startConnect({ businessId: "biz-9", memberBusinessIds: [] }).catch(
      (e: unknown) => e,
    );
    expect((err as { status?: number }).status).toBe(403);
  });

  it("keeps the allowlisted demo flow working without membership", async () => {
    seed();
    stubOAuthEnv();
    vi.stubEnv("GOOGLE_CAL_ALLOWED_BUSINESS_IDS", "biz-9");
    const url = await startConnect({ businessId: "biz-9" });
    expect(url).toContain("accounts.google.com");
  });

  it("route gate lets the allowlisted business through anonymously", async () => {
    vi.stubEnv("GOOGLE_CAL_ALLOWED_BUSINESS_IDS", "biz-9");
    await expect(assertCalendarRouteAccess("biz-9")).resolves.toEqual([]);
  });

  it("route gate rejects anonymous strangers", async () => {
    vi.stubEnv("GOOGLE_CAL_ALLOWED_BUSINESS_IDS", "other");
    const err = await assertCalendarRouteAccess("biz-9").catch((e: unknown) => e);
    expect((err as { status?: number }).status).toBe(403);
  });
});
