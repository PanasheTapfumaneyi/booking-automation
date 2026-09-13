/**
 * First-real-tenant readiness tests (Watpo Hair Studio onboarding).
 *
 * Proves a production business can be provisioned, isolated, and activated
 * without touching demo architecture:
 * - provisioning lands is_demo=false + explicit slug + contact fields
 * - explicit slugs never silently collide (409, no auto-suffix)
 * - inactive businesses are hidden from public surfaces but still
 *   configurable by their owner (pre-launch path)
 * - membership enforcement isolates tenants (no cross-tenant access)
 * - calendar + notification state is scoped per business_id
 * - production rows are never classified as demo
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/server/strategies/capacity", () => ({
  fetchSessionBookedQuantity: vi.fn().mockResolvedValue(0),
}));

import {
  createBusinessWithOwner,
  getBusinessSettings,
  updateBusinessProfile,
  validateBusinessEmail,
} from "./businesses";
import { getBusinessSiteData } from "./public-site";
import {
  requireBusinessMembership,
  requireBusinessOwner,
} from "./auth";
import { isDemoBusiness } from "./demo";
import { ApiError } from "./errors";
import { fetchBusinessNotificationSettings } from "./notifications/records";
import {
  createMemoryDb,
  connectionRow,
  type MemoryDb,
} from "./google-calendar/test-helpers";
import {
  getActiveConnection,
  upsertConnection,
} from "./google-calendar/repository";

type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Minimal fake Supabase surface (insert/update/upsert + patch recording)
// ---------------------------------------------------------------------------

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private patch: Row | null = null;
  private insertRow: Row | null = null;
  private upsertRow: Row | null = null;
  private flushed: Row[] | null = null;

  constructor(
    private tables: Record<string, Row[]>,
    private tableName: string,
    private onWrite: (table: string, op: string, patch: Row) => void,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  select(..._args: unknown[]): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  limit(_n: number): this {
    return this;
  }

  update(patch: Row): this {
    this.patch = patch;
    return this;
  }

  insert(row: Row): this {
    this.insertRow = { ...row };
    return this;
  }

  upsert(row: Row): this {
    this.upsertRow = { ...row };
    return this;
  }

  delete(): this {
    this.patch = { __delete: true };
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
    if (this.insertRow || this.upsertRow) return;
    if (!this.patch) {
      this.flushed = null;
      return;
    }
    const matched = this.matching();
    if (this.patch.__delete) {
      const gone = new Set(matched);
      this.tables[this.tableName] = this.rows().filter((r) => !gone.has(r));
      this.onWrite(this.tableName, "delete", {});
    } else {
      for (const row of matched) Object.assign(row, this.patch);
      this.onWrite(this.tableName, "update", this.patch as Row);
    }
    this.patch = null;
    this.flushed = matched;
  }

  private commitInsert(): { data: unknown; error: null } {
    const row = this.insertRow as Row;
    this.insertRow = null;
    const record: Row = { ...row, id: (row.id as string) ?? `gen-${this.rows().length}` };
    this.rows().push(record);
    this.onWrite(this.tableName, "insert", record);
    return { data: { id: record.id, slug: record.slug ?? null }, error: null };
  }

  private commitUpsert(): { data: unknown; error: null } {
    const row = this.upsertRow as Row;
    this.upsertRow = null;
    const existing = this.rows().find((r) => r.business_id === row.business_id);
    if (existing) Object.assign(existing, row);
    else this.rows().push({ ...row });
    this.onWrite(this.tableName, "upsert", row);
    return { data: null, error: null };
  }

  async maybeSingle(): Promise<{ data: unknown; error: null }> {
    if (this.insertRow) return this.commitInsert();
    if (this.upsertRow) return this.commitUpsert();
    this.flush();
    return { data: (this.flushed ?? this.matching())[0] ?? null, error: null };
  }

  async single(): Promise<{ data: unknown; error: null }> {
    return this.maybeSingle();
  }

  then<TResult = { data: unknown; error: null }>(
    onfulfilled?: (value: { data: unknown; error: null }) => TResult,
  ) {
    if (this.insertRow) return Promise.resolve(this.commitInsert()).then(onfulfilled as never);
    if (this.upsertRow) return Promise.resolve(this.commitUpsert()).then(onfulfilled as never);
    this.flush();
    return Promise.resolve({ data: this.flushed ?? this.matching(), error: null }).then(
      onfulfilled as never,
    );
  }
}

interface FakeDb {
  tables: Record<string, Row[]>;
  writes: Array<{ table: string; op: string; patch: Row }>;
  from: (table: string) => FakeQuery;
}

function createFakeDb(): FakeDb {
  const store: FakeDb = {
    tables: {},
    writes: [],
    from(table: string) {
      return new FakeQuery(store.tables, table, (t, op, patch) =>
        store.writes.push({ table: t, op, patch }),
      );
    },
  };
  return store;
}

const asDb = (db: FakeDb) => db as unknown as SupabaseClient;
const asMemDb = (db: MemoryDb) => db as unknown as SupabaseClient;

function sessionClient(user: { id: string; email?: string | null } | null) {
  return {
    auth: {
      getUser: async () => ({ data: { user } }),
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Provisioning
// ---------------------------------------------------------------------------

describe("real-business provisioning", () => {
  it("creates a production business: is_demo false, active by default", async () => {
    const db = createFakeDb();
    const created = await createBusinessWithOwner(
      "owner-1",
      {
        name: "Watpo Hair Studio",
        phone: null,
        timezone: "Indian/Mauritius",
        booking_mode: "appointment",
        slug: "watpo-hair-studio",
        address: "Royal Road, Flic-en-Flac, Mauritius",
      },
      asDb(db),
    );
    expect(created.slug).toBe("watpo-hair-studio");
    const business = db.tables.businesses[0];
    expect(business.is_demo).toBe(false);
    expect(business.is_active).toBe(true);
    expect(business.address).toBe("Royal Road, Flic-en-Flac, Mauritius");
    expect(business.booking_mode).toBe("appointment");
    expect(db.tables.business_members).toEqual([
      expect.objectContaining({ business_id: business.id, user_id: "owner-1", role: "owner" }),
    ]);
  });

  it("provisions inactive when requested (pre-launch)", async () => {
    const db = createFakeDb();
    await createBusinessWithOwner(
      "owner-1",
      { name: "Watpo Hair Studio", booking_mode: "appointment", is_active: false },
      asDb(db),
    );
    expect(db.tables.businesses[0].is_active).toBe(false);
    expect(db.tables.businesses[0].is_demo).toBe(false);
  });

  it("rejects an explicit slug that is already taken (no silent suffix)", async () => {
    const db = createFakeDb();
    db.tables.businesses = [{ id: "other", slug: "watpo-hair-studio" }];
    const err = await createBusinessWithOwner(
      "owner-1",
      { name: "Watpo Hair Studio", booking_mode: "appointment", slug: "watpo-hair-studio" },
      asDb(db),
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    // Nothing was provisioned on conflict.
    expect(db.tables.business_members ?? []).toEqual([]);
  });

  it("validates email, slug, mode, and timezone", async () => {
    expect(validateBusinessEmail(null)).toBeNull();
    expect(validateBusinessEmail("hello@watpo.mu")).toBe("hello@watpo.mu");
    expect(() => validateBusinessEmail("not-an-email")).toThrow(ApiError);
    const db = createFakeDb();
    await expect(
      createBusinessWithOwner(
        "owner-1",
        { name: "Watpo Hair Studio", booking_mode: "appointment", slug: "Bad Slug!" },
        asDb(db),
      ),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      createBusinessWithOwner(
        "owner-1",
        { name: "Watpo Hair Studio", booking_mode: "teleport" },
        asDb(db),
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("owner can flip activation via settings (launch switch)", async () => {
    const db = createFakeDb();
    db.tables.businesses = [
      { id: "biz-w", name: "Watpo Hair Studio", phone: null, timezone: "Indian/Mauritius" },
    ];
    await updateBusinessProfile(
      "biz-w",
      { name: "Watpo Hair Studio", is_active: true },
      asDb(db),
    );
    expect(db.tables.businesses[0].is_active).toBe(true);
    const settings = await getBusinessSettings("biz-w", asDb(db));
    expect(settings.business.is_active).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Public visibility gating
// ---------------------------------------------------------------------------

describe("inactive businesses stay off public surfaces", () => {
  function seeded(active: boolean): FakeDb {
    const db = createFakeDb();
    db.tables.businesses = [
      {
        id: "biz-w",
        name: "Watpo Hair Studio",
        slug: "watpo-hair-studio",
        is_demo: false,
        is_active: active,
      },
    ];
    return db;
  }

  it("public site data resolves null while inactive", async () => {
    const data = await getBusinessSiteData("watpo-hair-studio", seeded(false) as never);
    expect(data).toBeNull();
  });

  it("owner membership still works while inactive (pre-launch config path)", async () => {
    const db = seeded(false);
    db.tables.business_members = [
      { id: "m-1", business_id: "biz-w", user_id: "owner-1", role: "owner" },
    ];
    const ctx = await requireBusinessOwner("biz-w", {
      client: sessionClient({ id: "owner-1" }),
      db: asDb(db),
    });
    expect(ctx.business.id).toBe("biz-w");
    expect(ctx.membership.role).toBe("owner");
  });
});

// ---------------------------------------------------------------------------
// Tenant isolation
// ---------------------------------------------------------------------------

describe("tenant isolation between real businesses", () => {
  function seeded(): FakeDb {
    const db = createFakeDb();
    db.tables.businesses = [
      { id: "biz-w", name: "Watpo Hair Studio", slug: "watpo-hair-studio" },
      { id: "biz-o", name: "Other Salon", slug: "other-salon" },
    ];
    db.tables.business_members = [
      { id: "m-1", business_id: "biz-w", user_id: "owner-w", role: "owner" },
      { id: "m-2", business_id: "biz-o", user_id: "owner-o", role: "owner" },
    ];
    return db;
  }

  it("owner of Watpo gets 403 on another tenant", async () => {
    const err = await requireBusinessMembership("biz-o", {
      client: sessionClient({ id: "owner-w" }),
      db: asDb(seeded()),
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(403);
  });

  it("anonymous callers get 401 before any membership check", async () => {
    const err = await requireBusinessMembership("biz-w", {
      client: sessionClient(null),
      db: asDb(seeded()),
    }).catch((e: unknown) => e);
    expect((err as ApiError).status).toBe(401);
  });

  it("each owner reaches only their own business", async () => {
    const db = seeded();
    const ctx = await requireBusinessMembership("biz-w", {
      client: sessionClient({ id: "owner-w" }),
      db: asDb(db),
    });
    expect(ctx.business.id).toBe("biz-w");
  });
});

// ---------------------------------------------------------------------------
// Demo safety: production rows are never demo
// ---------------------------------------------------------------------------

describe("production businesses are never demo", () => {
  it("is_demo=false and missing flags are production", () => {
    expect(isDemoBusiness({ id: "biz-w", is_demo: false })).toBe(false);
    expect(isDemoBusiness({ id: "biz-w" })).toBe(false);
    expect(isDemoBusiness({ id: "biz-w", is_demo: null })).toBe(false);
  });

  it("only literal is_demo=true counts as demo", () => {
    expect(isDemoBusiness({ id: "biz-w", is_demo: true })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Business-scoped integrations
// ---------------------------------------------------------------------------

describe("integrations are scoped per business", () => {
  it("calendar connections never leak across businesses", async () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "watpo-scope-test-key!");
    const db = createMemoryDb();
    db.tables.calendar_connections.push(
      connectionRow({ id: "conn-w", business_id: "biz-w", active: true }),
      connectionRow({ id: "conn-o", business_id: "biz-o", active: false }),
    );
    const watpo = await getActiveConnection("biz-w", asMemDb(db));
    expect(watpo?.businessId).toBe("biz-w");
    expect(await getActiveConnection("biz-o", asMemDb(db))).toBeNull();
    expect(await getActiveConnection("biz-unknown", asMemDb(db))).toBeNull();
  });

  it("new calendar connections are stored under the connecting business", async () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "watpo-scope-test-key!");
    const db = createMemoryDb();
    await upsertConnection(
      {
        businessId: "biz-w",
        accountEmail: "watpo.owner@gmail.com",
        calendarId: "primary",
        scope: "events calendars.readonly",
        refreshToken: "tok-refresh",
        accessToken: "tok-access",
      },
      asMemDb(db),
    );
    const stored = db.tables.calendar_connections[0] as Record<string, unknown>;
    expect(stored.business_id).toBe("biz-w");
    expect(await getActiveConnection("biz-o", asMemDb(db))).toBeNull();
  });

  it("notification settings resolve per business, defaulting when unconfigured", async () => {
    const db = createFakeDb();
    db.tables.business_notification_settings = [
      {
        business_id: "biz-w",
        customer_notifications_enabled: true,
        business_notifications_enabled: true,
        whatsapp_enabled: true,
        business_notification_phone: "+23057000000",
        created_at: "",
        updated_at: "",
      },
    ];
    const watpo = await fetchBusinessNotificationSettings("biz-w", asDb(db) as never);
    expect(watpo.business_notification_phone).toBe("+23057000000");
    const other = await fetchBusinessNotificationSettings("biz-o", asDb(db) as never);
    expect(other.business_id).toBe("biz-o");
    expect(other.business_notification_phone).toBeNull();
  });
});
