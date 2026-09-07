/**
 * Business onboarding + settings service tests (Phase 6A).
 *
 * Supabase is faked (insert/update/delete/upsert + patch recording).
 * Proves validation, slug uniqueness, atomic setup with cleanup, ownership
 * scoping of every mutation, and that booking_mode is never written by
 * profile edits.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  slugify,
  ensureUniqueSlug,
  validateSlug,
  validateTimezone,
  validateBookingMode,
  validateBusinessProfile,
  parseHoursOrThrow,
  parseNotificationPhone,
  createBusinessWithOwner,
  getBusinessSettings,
  updateBusinessProfile,
  createService,
  updateService,
  createResource,
  updateResource,
  createSession,
  setSessionActive,
  listServices,
} from "./businesses";
import { ApiError } from "./errors";

type Row = Record<string, unknown>;

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
    private failInsertInto: string | null,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  select(..._args: unknown[]): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
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

  private result(): Row[] {
    return this.flushed ?? this.matching();
  }

  private commitInsert(): { data: unknown; error: { code: string; message: string } | null } {
    const row = this.insertRow as Row;
    this.insertRow = null;
    if (this.failInsertInto === this.tableName) {
      return { data: null, error: { code: "23505", message: "duplicate" } };
    }
    const record = { ...row, id: (row.id as string) ?? `gen-${this.rows().length}` };
    this.rows().push(record);
    this.onWrite(this.tableName, "insert", record);
    return { data: { id: record.id }, error: null };
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

  async maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    if (this.insertRow) return this.commitInsert();
    if (this.upsertRow) return this.commitUpsert();
    this.flush();
    return { data: this.result()[0] ?? null, error: null };
  }

  async single(): Promise<{ data: unknown; error: unknown }> {
    return this.maybeSingle();
  }

  then<TResult = { data: unknown; error: unknown }>(
    onfulfilled?: (value: { data: unknown; error: unknown }) => TResult,
  ) {
    if (this.insertRow) return Promise.resolve(this.commitInsert()).then(onfulfilled as never);
    if (this.upsertRow) return Promise.resolve(this.commitUpsert()).then(onfulfilled as never);
    this.flush();
    return Promise.resolve({ data: this.result(), error: null }).then(onfulfilled as never);
  }
}

interface FakeDb {
  tables: Record<string, Row[]>;
  writes: Array<{ table: string; op: string; patch: Row }>;
  failInsertInto: string | null;
  from: (table: string) => FakeQuery;
}

function createFakeDb(): FakeDb {
  const store: FakeDb = {
    tables: {},
    writes: [],
    failInsertInto: null,
    from(table: string) {
      return new FakeQuery(
        store.tables,
        table,
        (t, op, patch) => store.writes.push({ table: t, op, patch }),
        store.failInsertInto,
      );
    },
  };
  return store;
}

const asDb = (db: FakeDb) => db as unknown as SupabaseClient;

afterEach(() => {
  vi.unstubAllEnvs();
});

async function expectValidation(
  work: () => Promise<unknown> | unknown,
  messagePart?: string,
) {
  const err = await Promise.resolve()
    .then(work)
    .catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).status).toBe(400);
  expect((err as ApiError).code).toBe("VALIDATION");
  if (messagePart) expect((err as ApiError).message).toContain(messagePart);
}

describe("slug + profile validation", () => {
  it("slugifies names deterministically", () => {
    expect(slugify("Fade District")).toBe("fade-district");
    expect(slugify("  Café & Cuts! ")).toBe("cafe-cuts");
    expect(slugify("!!!")).toBe("business");
  });

  it("validates slugs strictly", () => {
    expect(validateSlug("fade-district-2")).toBe("fade-district-2");
    expect(() => validateSlug("Fade District")).toThrow(ApiError);
    expect(() => validateSlug("a_b")).toThrow(ApiError);
  });

  it("retries colliding slugs with a suffix, then gives up", async () => {
    const taken = new Set(["fade-district"]);
    const slug = await ensureUniqueSlug("fade-district", async (s) => taken.has(s));
    expect(slug).not.toBe("fade-district");
    expect(slug.startsWith("fade-district-")).toBe(true);
    await expect(
      ensureUniqueSlug("x", async () => true),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("validates timezones against Intl", () => {
    expect(validateTimezone("Indian/Mauritius")).toBe("Indian/Mauritius");
    expect(() => validateTimezone("Mars/Olympus")).toThrow(ApiError);
  });

  it("validates booking modes without inventing new ones", () => {
    expect(validateBookingMode("appointment")).toBe("appointment");
    expect(validateBookingMode("resource")).toBe("resource");
    expect(validateBookingMode("capacity")).toBe("capacity");
    expect(() => validateBookingMode("multi-location")).toThrow(ApiError);
  });

  it("rejects blank or oversized business names", async () => {
    await expectValidation(() => validateBusinessProfile({ name: " " }));
    await expectValidation(() => validateBusinessProfile({ name: "x".repeat(81) }));
    const ok = validateBusinessProfile({ name: " Fade District ", phone: "", timezone: "Indian/Mauritius" });
    expect(ok).toEqual({ name: "Fade District", phone: null, timezone: "Indian/Mauritius" });
  });

  it("parses hours strictly and defaults empty to null", () => {
    expect(parseHoursOrThrow(null)).toBeNull();
    expect(parseHoursOrThrow(undefined)).toBeNull();
    const hours = parseHoursOrThrow({ mon: { open: "09:00", close: "18:00" }, sun: null });
    expect(hours?.mon).toEqual({ open: "09:00", close: "18:00" });
    expect(hours?.sun).toBeNull();
  });

  it("rejects inverted or malformed hours", async () => {
    await expectValidation(() => parseHoursOrThrow({ mon: { open: "18:00", close: "09:00" } }), "before");
    await expectValidation(() => parseHoursOrThrow({ mon: { open: "9am", close: "18:00" } }));
    await expectValidation(() => parseHoursOrThrow("9-5"));
  });

  it("parses notification phones (null clears, garbage rejected)", () => {
    expect(parseNotificationPhone(null)).toBeNull();
    expect(parseNotificationPhone("   ")).toBeNull();
    expect(parseNotificationPhone("+23057123456")).toBe("+23057123456");
    expect(() => parseNotificationPhone("12345")).toThrow(ApiError);
    expect(() => parseNotificationPhone(42)).toThrow(ApiError);
  });
});

describe("createBusinessWithOwner", () => {
  it("creates business, owner membership and default settings", async () => {
    const db = createFakeDb();
    const created = await createBusinessWithOwner(
      "user-1",
      { name: "Fade District", phone: "+230", timezone: "Indian/Mauritius", booking_mode: "appointment" },
      asDb(db),
    );
    expect(created.slug).toBe("fade-district");
    const business = db.tables.businesses[0];
    expect(business.name).toBe("Fade District");
    expect(business.booking_mode).toBe("appointment");
    expect(db.tables.business_members).toEqual([
      expect.objectContaining({ business_id: business.id, user_id: "user-1", role: "owner" }),
    ]);
    expect(db.tables.business_notification_settings).toEqual([
      expect.objectContaining({ business_id: business.id }),
    ]);
  });

  it("suffixed slug on collision", async () => {
    const db = createFakeDb();
    db.tables.businesses = [{ id: "old", slug: "fade-district", name: "Old" }];
    const created = await createBusinessWithOwner(
      "user-1",
      { name: "Fade District", booking_mode: "appointment" },
      asDb(db),
    );
    expect(created.slug.startsWith("fade-district-")).toBe(true);
  });

  it("removes the business again when membership setup fails", async () => {
    const db = createFakeDb();
    db.failInsertInto = "business_members";
    await expect(
      createBusinessWithOwner("user-1", { name: "Fade District", booking_mode: "appointment" }, asDb(db)),
    ).rejects.toBeDefined();
    expect(db.tables.businesses).toHaveLength(0);
  });

  it("rejects invalid onboarding input before touching the database", async () => {
    const db = createFakeDb();
    await expectValidation(() =>
      createBusinessWithOwner("user-1", { name: "", booking_mode: "appointment" }, asDb(db)),
    );
    await expectValidation(() =>
      createBusinessWithOwner("user-1", { name: "Fade", booking_mode: "teleport" }, asDb(db)),
    );
    expect(db.tables.businesses ?? []).toHaveLength(0);
  });
});

describe("settings mutations", () => {
  function seeded(): FakeDb {
    const db = createFakeDb();
    db.tables.businesses = [
      { id: "biz-1", name: "Alpha", phone: null, timezone: "Indian/Mauritius", booking_mode: "appointment", slug: "alpha", availability: null },
    ];
    return db;
  }

  it("reads a safe settings bundle", async () => {
    const db = seeded();
    const bundle = await getBusinessSettings("biz-1", asDb(db));
    expect(bundle.business).toEqual({
      id: "biz-1",
      name: "Alpha",
      phone: null,
      timezone: "Indian/Mauritius",
      booking_mode: "appointment",
      slug: "alpha",
      availability: null,
    });
  });

  it("updates profile + hours but never booking_mode", async () => {
    const db = seeded();
    await updateBusinessProfile(
      "biz-1",
      {
        name: "Alpha Cuts",
        phone: "+23050000000",
        timezone: "Indian/Mauritius",
        availability: { mon: { open: "10:00", close: "16:00" } },
      },
      asDb(db),
    );
    const row = db.tables.businesses[0];
    expect(row.name).toBe("Alpha Cuts");
    expect(row.availability).toEqual({ mon: { open: "10:00", close: "16:00" }, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null });
    for (const write of db.writes) {
      expect(write.patch).not.toHaveProperty("booking_mode");
      expect(write.patch).not.toHaveProperty("slug");
    }
  });

  it("rejects bad hours on update without writing", async () => {
    const db = seeded();
    await expectValidation(() =>
      updateBusinessProfile("biz-1", { name: "Alpha", availability: { mon: { open: "20:00", close: "08:00" } } }, asDb(db)),
    );
    expect(db.writes.filter((w) => w.op === "update")).toHaveLength(0);
  });

  it("validates service input", async () => {
    const db = seeded();
    await expectValidation(() => createService("biz-1", { name: "x", duration_minutes: 45 }, asDb(db)));
    await expectValidation(() => createService("biz-1", { name: "Cut", duration_minutes: 0 }, asDb(db)));
    await expectValidation(() => createService("biz-1", { name: "Cut", duration_minutes: 45, price: -5 }, asDb(db)));
    const created = await createService("biz-1", { name: "Cut", duration_minutes: 45, price: 500 }, asDb(db));
    expect(created.id).toBeDefined();
  });

  it("scopes service edits to the owning business (404 otherwise)", async () => {
    const db = seeded();
    db.tables.services = [{ id: "svc-9", business_id: "biz-other", name: "Cut", duration_minutes: 45, price: 1, active: true }];
    await expect(
      updateService("biz-1", "svc-9", { active: false }, asDb(db)),
    ).rejects.toMatchObject({ status: 404 });
    db.tables.services = [{ id: "svc-1", business_id: "biz-1", name: "Cut", duration_minutes: 45, price: 1, active: true }];
    await updateService("biz-1", "svc-1", { active: false }, asDb(db));
    expect(db.tables.services[0].active).toBe(false);
  });

  it("validates resources and scopes their edits", async () => {
    const db = seeded();
    await expectValidation(() => createResource("biz-1", { name: " " }, asDb(db)));
    const created = await createResource("biz-1", { name: "Corolla" }, asDb(db));
    expect(created.id).toBeDefined();
    await expect(updateResource("biz-1", "nope", { active: false }, asDb(db))).rejects.toMatchObject({
      status: 404,
    });
  });

  it("validates sessions against the owning business", async () => {
    const db = seeded();
    db.tables.services = [{ id: "svc-1", business_id: "biz-1", name: "Trip", duration_minutes: 60, price: 1, active: true }];
    await expect(
      createSession("biz-1", { service_id: "svc-other", start_time: new Date(Date.now() + 86_400_000).toISOString(), capacity: 4 }, asDb(db)),
    ).rejects.toMatchObject({ status: 400 });
    await expectValidation(() =>
      createSession("biz-1", { service_id: "svc-1", start_time: "not-a-date", capacity: 4 }, asDb(db)),
    );
    await expectValidation(() =>
      createSession("biz-1", { service_id: "svc-1", start_time: new Date(Date.now() + 86_400_000).toISOString(), capacity: 0 }, asDb(db)),
    );
    const created = await createSession(
      "biz-1",
      {
        service_id: "svc-1",
        start_time: new Date(Date.now() + 86_400_000).toISOString(),
        end_time: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        capacity: 10,
      },
      asDb(db),
    );
    expect(created.id).toBeDefined();
    await setSessionActive("biz-1", created.id, false, asDb(db));
    expect(db.tables.booking_sessions[0].active).toBe(false);
    await expect(setSessionActive("biz-1", "missing", false, asDb(db))).rejects.toMatchObject({ status: 404 });
  });

  it("lists services with safe columns", async () => {
    const db = seeded();
    db.tables.services = [{ id: "svc-1", business_id: "biz-1", name: "Cut", duration_minutes: 45, price: 500, active: true }];
    expect(await listServices("biz-1", asDb(db))).toEqual([
      { id: "svc-1", name: "Cut", duration_minutes: 45, price: 500, active: true },
    ]);
  });
});
