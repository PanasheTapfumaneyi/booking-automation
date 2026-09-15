/**
 * Marketing analytics aggregate tests.
 *
 * Verifies overview counts, funnel ordering, source/CTA/featured/device
 * breakdowns, and the managed-vs-self split over a fake event window —
 * plus that server-side recording sanitizes and never throws.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

type Row = Record<string, unknown>;

class FakeQuery {
  private gteValue: string | null = null;

  constructor(
    private tables: Record<string, Row[]>,
    private tableName: string,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  select(..._args: unknown[]): this {
    return this;
  }

  gte(_column: string, value: string): this {
    this.gteValue = value;
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  order(..._args: unknown[]): this {
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  limit(..._args: unknown[]): this {
    return this;
  }

  insert(row: Row): { error: null } {
    this.tables[this.tableName] ??= [];
    this.tables[this.tableName].push(row);
    return { error: null };
  }

  then<TResult = { data: unknown; error: null }>(
    onfulfilled?: (value: { data: unknown; error: null }) => TResult,
  ) {
    const rows = (this.tables[this.tableName] ?? []).filter(
      (row) =>
        this.gteValue == null ||
        String(row.created_at ?? "") >= this.gteValue,
    );
    return Promise.resolve({ data: rows, error: null }).then(onfulfilled as never);
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

import {
  getDeviceBreakdown,
  getFeaturedClicks,
  getMarketingFunnel,
  getMarketingOverview,
  getSetupSplit,
  getTopCtaLocations,
  getTopSources,
  rangeStartIso,
  recordServerMarketingEvent,
} from "./marketing-analytics";

function event(
  eventName: string,
  session: string,
  extra: Partial<Row> = {},
): Row {
  return {
    event_name: eventName,
    session_id: session,
    source: "direct",
    device: "desktop",
    metadata: {},
    created_at: new Date().toISOString(),
    ...extra,
  };
}

function seed(): void {
  // s4 is 10 days old: inside 30d, outside 7d (range-boundary coverage).
  const old = new Date(Date.now() - 10 * 86_400_000).toISOString();
  holder.tables = {
    marketing_events: [
      event("marketing_page_viewed", "s1", { source: "instagram", device: "mobile" }),
      event("start_free_clicked", "s1", {
        source: "instagram",
        device: "mobile",
        metadata: { cta_location: "hero" },
      }),
      event("signup_started", "s1", { source: "instagram" }),
      event("signup_completed", "s1", { source: "instagram" }),
      event("business_details_submitted", "s1", { source: "instagram" }),
      event("setup_choice_viewed", "s1", { source: "instagram" }),
      event("managed_setup_selected", "s1", { source: "instagram" }),
      event("onboarding_completed", "s1", { source: "instagram" }),
      event("marketing_page_viewed", "s2", { source: "google" }),
      event("start_free_clicked", "s2", {
        source: "google",
        metadata: { cta_location: "pricing" },
      }),
      event("featured_business_clicked", "s2", {
        source: "google",
        metadata: {
          business_slug: "island-surf",
          category: "surf-rental",
          booking_mode: "resource",
          action: "book_now",
        },
      }),
      event("featured_business_clicked", "s3", {
        source: "direct",
        metadata: {
          business_slug: "island-surf",
          category: "surf-rental",
          booking_mode: "resource",
          action: "view_business",
        },
      }),
      event("contact_clicked", "s3", {
        source: "direct",
        metadata: { contact_type: "whatsapp", cta_location: "footer" },
      }),
      event("self_setup_selected", "s4", { source: "whatsapp", created_at: old }),
      event("marketing_page_viewed", "s4", {
        source: "whatsapp",
        created_at: old,
      }),
    ],
  };
}

beforeEach(() => {
  seed();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rangeStartIso", () => {
  it("supports today, 7d, 30d", () => {
    const now = new Date("2026-09-15T12:00:00.000Z").getTime();
    expect(rangeStartIso("today", now)).toBe("2026-09-15T00:00:00.000Z");
    expect(rangeStartIso("7d", now)).toBe("2026-09-08T12:00:00.000Z");
    expect(rangeStartIso("30d", now)).toBe("2026-08-16T12:00:00.000Z");
  });
});

describe("getMarketingOverview", () => {
  it("counts visitors once and conversion honestly", async () => {
    const overview = await getMarketingOverview("30d");
    expect(overview.visitors).toBe(4);
    expect(overview.startFreeClicks).toBe(2);
    expect(overview.signupStarts).toBe(1);
    expect(overview.accountsCreated).toBe(1);
    expect(overview.setupCompleted).toBe(1);
    expect(overview.conversionRate).toBeCloseTo(0.25);
  });

  it("excludes out-of-range events", async () => {
    const overview = await getMarketingOverview("7d");
    expect(overview.visitors).toBe(3);
  });

  it("is zero-safe with no data", async () => {
    holder.tables = { marketing_events: [] };
    const overview = await getMarketingOverview("7d");
    expect(overview).toMatchObject({
      visitors: 0,
      accountsCreated: 0,
      conversionRate: 0,
    });
  });
});

describe("getMarketingFunnel", () => {
  it("returns stages in funnel order with honest counts", async () => {
    const funnel = await getMarketingFunnel("30d");
    const byKey = Object.fromEntries(funnel.map((s) => [s.key, s.count]));
    expect(funnel.map((s) => s.key)).toEqual([
      "visitors",
      "start_free",
      "signup_started",
      "account_created",
      "details_submitted",
      "choice_completed",
      "onboarding_completed",
    ]);
    expect(byKey.visitors).toBe(4);
    expect(byKey.start_free).toBe(2);
    expect(byKey.account_created).toBe(1);
    expect(byKey.choice_completed).toBe(2);
    expect(byKey.onboarding_completed).toBe(1);
  });
});

describe("breakdowns", () => {
  it("ranks acquisition sources", async () => {
    const sources = await getTopSources("30d");
    expect(sources[0]).toMatchObject({ source: "instagram", count: 8 });
    expect(sources.map((s) => s.source)).toContain("google");
  });

  it("groups CTA clicks by event and location", async () => {
    const ctas = await getTopCtaLocations("30d");
    const hero = ctas.find((c) => c.location === "start_free_clicked · hero");
    expect(hero?.count).toBe(1);
    const footer = ctas.find((c) => c.location === "contact_clicked · footer");
    expect(footer?.count).toBe(1);
  });

  it("splits featured clicks by business and action", async () => {
    const featured = await getFeaturedClicks("30d");
    expect(featured).toHaveLength(1);
    expect(featured[0]).toMatchObject({
      slug: "island-surf",
      category: "surf-rental",
      mode: "resource",
      bookNow: 1,
      viewBusiness: 1,
      total: 2,
    });
  });

  it("compares managed versus self setup", async () => {
    expect(await getSetupSplit("30d")).toEqual({ managed: 1, self: 1 });
  });

  it("breaks down devices", async () => {
    const devices = await getDeviceBreakdown("30d");
    const mobile = devices.find((d) => d.device === "mobile");
    expect(mobile?.count).toBe(2);
  });
});

describe("recordServerMarketingEvent", () => {
  it("stores sanitized server events linked to the browser session", async () => {
    await recordServerMarketingEvent({
      eventName: "business_details_submitted",
      sessionId: "sess-9",
      pathname: "/onboarding",
      metadata: { booking_mode: "appointment", phone: "+23057123456" },
    });
    const rows = holder.tables?.marketing_events ?? [];
    const inserted = rows[rows.length - 1] as Row;
    expect(inserted.event_name).toBe("business_details_submitted");
    expect(inserted.session_id).toBe("sess-9");
    expect(inserted.metadata).toEqual({ booking_mode: "appointment" });
  });

  it("never throws when the database fails", async () => {
    holder.tables = null;
    await expect(
      recordServerMarketingEvent({ eventName: "business_details_submitted" }),
    ).resolves.toBeUndefined();
  });
});
