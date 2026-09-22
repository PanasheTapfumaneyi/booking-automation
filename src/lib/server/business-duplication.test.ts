/**
 * Business duplication tests (admin cold-call cloning).
 *
 * Proves the clone contract with a fake DB + fake storage:
 * - fresh id/slug, blanked contact/location, copied theme/offering/storefront
 * - service_id remap on future sessions; past/inactive sessions skipped
 * - reviews/customers/bookings/members never copy; team auth links reset
 * - tenant-hosted images copied to the new prefix and URLs rewritten;
 *   external hotlinks kept as-is
 * - mid-flight failure cleans up (no half-cloned tenant lingers)
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { duplicateBusiness } from "./business-duplication";

vi.mock("@/lib/server/strategies/capacity", () => ({
  fetchSessionBookedQuantity: vi.fn().mockResolvedValue(0),
}));

type Row = Record<string, unknown>;

const BUCKET = "storefront-media";
const CDN = `https://cdn.test/storage/v1/object/public/${BUCKET}`;

function storageUrl(path: string): string {
  return `${CDN}/${path}`;
}

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private patch: Row | null = null;
  private insertRow: Row | null = null;
  private upsertRow: Row | null = null;

  constructor(
    private tables: Record<string, Row[]>,
    private tableName: string,
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  order(..._args: unknown[]): this {
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  limit(..._args: unknown[]): this {
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
    if (!this.patch) return;
    const matched = this.matching();
    if (this.patch.__delete) {
      const gone = new Set(matched);
      this.tables[this.tableName] = this.rows().filter((r) => !gone.has(r));
      // Faithful FK cascade: deleting a business wipes its tenant rows.
      if (this.tableName === "businesses") {
        const goneIds = new Set(matched.map((r) => r.id));
        for (const [table, rows] of Object.entries(this.tables)) {
          if (table === "businesses") continue;
          this.tables[table] = rows.filter(
            (r) => typeof r.business_id !== "string" || !goneIds.has(r.business_id),
          );
        }
      }
    } else {
      for (const row of matched) Object.assign(row, this.patch);
    }
    this.patch = null;
  }

  async maybeSingle(): Promise<{ data: unknown; error: null }> {
    if (this.insertRow) {
      const row = this.insertRow;
      this.insertRow = null;
      if (this.failInsertInto === this.tableName) {
        throw new Error(`insert into ${this.tableName} failed`);
      }
      const record = { ...row, id: (row.id as string) ?? `gen-${this.rows().length}` };
      this.rows().push(record);
      return { data: record, error: null };
    }
    if (this.upsertRow) {
      const row = this.upsertRow;
      this.upsertRow = null;
      const existing = this.rows().find((r) => r.business_id === row.business_id);
      if (existing) Object.assign(existing, row);
      else this.rows().push({ ...row });
      return { data: null, error: null };
    }
    this.flush();
    return { data: this.matching()[0] ?? null, error: null };
  }

  async single(): Promise<{ data: unknown; error: unknown }> {
    return this.maybeSingle();
  }

  then<TResult = { data: unknown; error: null }>(
    onfulfilled?: (value: { data: unknown; error: null }) => TResult,
  ) {
    if (this.insertRow || this.upsertRow) {
      return this.maybeSingle().then(onfulfilled as never);
    }
    this.flush();
    return Promise.resolve({ data: this.matching(), error: null }).then(onfulfilled as never);
  }
}

interface FakeDb {
  tables: Record<string, Row[]>;
  failInsertInto: string | null;
  downloads: string[];
  uploads: Array<{ path: string; contentType: string }>;
  removals: string[][];
  from: (table: string) => FakeQuery;
  storage: {
    from: (bucket: string) => {
      download: (path: string) => Promise<{ data: Blob | null; error: null }>;
      upload: (
        path: string,
        body: unknown,
        opts: { contentType: string; upsert: boolean },
      ) => Promise<{ data: unknown; error: null }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
      remove: (paths: string[]) => Promise<{ data: unknown; error: null }>;
    };
  };
}

function createFakeDb(): FakeDb {
  const db: FakeDb = {
    tables: {},
    failInsertInto: null,
    downloads: [],
    uploads: [],
    removals: [],
    from: (table: string) => new FakeQuery(db.tables, table, db.failInsertInto),
  storage: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    from: (_bucket: string) => ({
        download: async (path: string) => {
          db.downloads.push(path);
          return { data: new Blob(["bytes"]), error: null };
        },
        upload: async (path: string, _body: unknown, opts: { contentType: string; upsert: boolean }) => {
          db.uploads.push({ path, contentType: opts.contentType });
          return { data: { path }, error: null };
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: storageUrl(path) } }),
        remove: async (paths: string[]) => {
          db.removals.push(paths);
          return { data: null, error: null };
        },
      }),
    },
  };
  return db;
}

const FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString();
const PAST = new Date(Date.now() - 30 * 86_400_000).toISOString();

function seed(): FakeDb {
  const db = createFakeDb();
  db.tables.businesses = [
    {
      id: "biz-src",
      name: "Aqua Tours",
      phone: "+23050000000",
      email: "hello@aquatours.mu",
      timezone: "Indian/Mauritius",
      booking_mode: "capacity",
      slug: "aqua-tours",
      address: "Royal Road",
      description: "Boat trips.",
      is_demo: false,
      is_active: true,
      availability: { tue: { open: "09:00", close: "18:00" } },
      tagline: "See the blue.",
      cover_image_url: storageUrl("biz-src/cover/cover-1.jpg"),
      logo_url: storageUrl("biz-src/logo/logo-1.png"),
      theme_config: { primary: "#001122" },
      category: "tours",
      latitude: -20.1,
      longitude: 57.5,
    },
  ];
  db.tables.services = [
    {
      id: "svc-1",
      business_id: "biz-src",
      name: "Catamaran Day",
      description: "Full day sail.",
      duration_minutes: 480,
      price: 2500,
      image_url: storageUrl("biz-src/service/svc-1.jpg"),
      active: true,
    },
  ];
  db.tables.resources = [
    {
      id: "res-1",
      business_id: "biz-src",
      name: "Lagoon Cat",
      description: "40ft catamaran.",
      resource_type: "boat",
      image_url: "https://images.example.com/cat.jpg",
      active: true,
      metadata: {},
    },
  ];
  db.tables.booking_sessions = [
    { id: "sess-future", business_id: "biz-src", service_id: "svc-1", start_time: FUTURE, end_time: null, capacity: 10, active: true },
    { id: "sess-past", business_id: "biz-src", service_id: "svc-1", start_time: PAST, end_time: null, capacity: 10, active: true },
    { id: "sess-off", business_id: "biz-src", service_id: "svc-1", start_time: FUTURE, end_time: null, capacity: 10, active: false },
  ];
  db.tables.business_storefronts = [
    {
      business_id: "biz-src",
      template: "appointment_modern",
      headline: "Sail with us",
      subheadline: null,
      hero_image_url: storageUrl("biz-src/cover/hero-1.jpg"),
      show_gallery: true,
      show_team: true,
      show_reviews: true,
      show_about: true,
      show_hours: true,
      show_location: true,
      show_social: true,
      social_links: { instagram: "https://instagram.com/aqua" },
      amenities: [],
      section_order: null,
    },
  ];
  db.tables.storefront_gallery = [
    { id: "gal-1", business_id: "biz-src", image_url: storageUrl("biz-src/gallery/g-1.jpg"), caption: "Sunset", alt_text: null, sort_order: 0, is_featured: true },
  ];
  db.tables.storefront_team = [
    { id: "team-1", business_id: "biz-src", member_user_id: "user-999", name: "Skipper Jo", role: "Captain", bio: "20 years at sea.", photo_url: storageUrl("biz-src/team/jo.jpg"), visible: true, bookable: false, sort_order: 0 },
  ];
  db.tables.storefront_reviews = [
    { id: "rev-1", business_id: "biz-src", source: "manual", reviewer_name: "Ann", rating: 5, body: "Amazing trip.", visible: true },
  ];
  db.tables.business_members = [
    { id: "mem-1", business_id: "biz-src", user_id: "user-src-owner", role: "owner" },
  ];
  db.tables.customers = [
    { id: "cus-1", business_id: "biz-src", name: "Bob", phone: "+23051111111" },
  ];
  db.tables.bookings = [
    { id: "book-1", business_id: "biz-src", service_id: "svc-1", status: "confirmed" },
  ];
  db.tables.business_notification_settings = [
    { business_id: "biz-src", business_notification_phone: "+23052222222" },
  ];
  return db;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("duplicateBusiness", () => {
  it("creates a live tenant with fresh id/slug and blanked contact details", async () => {
    const db = seed();
    const result = await duplicateBusiness(
      "biz-src",
      { name: "Lagoon Cruises", ownerUserId: "user-admin" },
      db as never,
    );
    expect(result.id).toBeTruthy();
    expect(result.id).not.toBe("biz-src");
    expect(result.slug).toBe("lagoon-cruises");
    const clone = db.tables.businesses.find((b) => b.id === result.id)!;
    expect(clone.name).toBe("Lagoon Cruises");
    expect(clone.phone).toBeNull();
    expect(clone.email).toBeNull();
    expect(clone.address).toBeNull();
    expect(clone.latitude).toBeNull();
    expect(clone.is_demo).toBe(false);
    expect(clone.is_active).toBe(true);
    expect(clone.booking_mode).toBe("capacity");
    expect(clone.timezone).toBe("Indian/Mauritius");
    expect(clone.tagline).toBe("See the blue.");
    expect(clone.theme_config).toEqual({ primary: "#001122" });
    expect(result.counts).toMatchObject({ services: 1, resources: 1, sessions: 1, gallery: 1, team: 1 });
  });

  it("suffixes the slug when the base is taken", async () => {
    const db = seed();
    db.tables.businesses.push({ id: "biz-other", slug: "lagoon-cruises" });
    const result = await duplicateBusiness(
      "biz-src",
      { name: "Lagoon Cruises", ownerUserId: "user-admin" },
      db as never,
    );
    expect(result.slug).not.toBe("lagoon-cruises");
    expect(result.slug.startsWith("lagoon-cruises-")).toBe(true);
  });

  it("honours an explicit slug and 409s on collision", async () => {
    const db = seed();
    const ok = await duplicateBusiness(
      "biz-src",
      { name: "Whatever", slug: "custom-slug", ownerUserId: "user-admin" },
      db as never,
    );
    expect(ok.slug).toBe("custom-slug");
    await expect(
      duplicateBusiness(
        "biz-src",
        { name: "Whatever", slug: "custom-slug", ownerUserId: "user-admin" },
        db as never,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("remaps service ids and copies future sessions only", async () => {
    const db = seed();
    const result = await duplicateBusiness(
      "biz-src",
      { name: "Lagoon Cruises", ownerUserId: "user-admin" },
      db as never,
    );
    const sessions = db.tables.booking_sessions.filter((s) => s.business_id === result.id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].start_time).toBe(FUTURE);
    const newServiceId = db.tables.services.find(
      (s) => s.business_id === result.id,
    )!.id as string;
    expect(sessions[0].service_id).toBe(newServiceId);
  });

  it("skips sessions entirely when asked", async () => {
    const db = seed();
    const result = await duplicateBusiness(
      "biz-src",
      { name: "Lagoon Cruises", ownerUserId: "user-admin", includeFutureSessions: false },
      db as never,
    );
    expect(db.tables.booking_sessions.filter((s) => s.business_id === result.id)).toHaveLength(0);
    expect(result.counts.sessions).toBe(0);
  });

  it("never copies reviews, members, customers, bookings or notification phone", async () => {
    const db = seed();
    const result = await duplicateBusiness(
      "biz-src",
      { name: "Lagoon Cruises", ownerUserId: "user-admin" },
      db as never,
    );
    expect(
      db.tables.storefront_reviews.filter((r) => r.business_id === result.id),
    ).toHaveLength(0);
    expect(db.tables.customers.filter((c) => c.business_id === result.id)).toHaveLength(0);
    expect(db.tables.bookings.filter((b) => b.business_id === result.id)).toHaveLength(0);
    const members = db.tables.business_members.filter((m) => m.business_id === result.id);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ user_id: "user-admin", role: "owner" });
    const settings = db.tables.business_notification_settings.find(
      (s) => s.business_id === result.id,
    )!;
    expect(settings.business_notification_phone ?? null).toBeNull();
  });

  it("resets team auth links but keeps display fields", async () => {
    const db = seed();
    const result = await duplicateBusiness(
      "biz-src",
      { name: "Lagoon Cruises", ownerUserId: "user-admin" },
      db as never,
    );
    const team = db.tables.storefront_team.filter((t) => t.business_id === result.id);
    expect(team).toHaveLength(1);
    expect(team[0].member_user_id).toBeNull();
    expect(team[0].name).toBe("Skipper Jo");
  });

  it("copies tenant-hosted images and rewrites URLs, keeps hotlinks", async () => {
    const db = seed();
    const result = await duplicateBusiness(
      "biz-src",
      { name: "Lagoon Cruises", ownerUserId: "user-admin" },
      db as never,
    );
    // Every tenant-hosted object was downloaded once.
    expect(db.downloads).toContain("biz-src/cover/cover-1.jpg");
    expect(db.downloads).toContain("biz-src/service/svc-1.jpg");
    expect(db.downloads).toContain("biz-src/gallery/g-1.jpg");
    // Uploads land under the new tenant prefix.
    expect(db.uploads.length).toBeGreaterThan(0);
    for (const upload of db.uploads) {
      expect(upload.path.startsWith(`${result.id}/`)).toBe(true);
    }
    const clone = db.tables.businesses.find((b) => b.id === result.id)!;
    expect(clone.cover_image_url as string).toContain(`${result.id}/cover/`);
    expect(clone.cover_image_url).not.toContain("biz-src");
    const svc = db.tables.services.find((s) => s.business_id === result.id)!;
    expect(svc.image_url as string).toContain(`${result.id}/service/`);
    const res = db.tables.resources.find((r) => r.business_id === result.id)!;
    expect(res.image_url).toBe("https://images.example.com/cat.jpg");
  });

  it("validates name and owner", async () => {
    const db = seed();
    await expect(
      duplicateBusiness("biz-src", { name: "x", ownerUserId: "user-admin" }, db as never),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      duplicateBusiness("biz-src", { name: "Lagoon Cruises", ownerUserId: " " }, db as never),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("404s on unknown source", async () => {
    const db = seed();
    await expect(
      duplicateBusiness("biz-nope", { name: "Lagoon Cruises", ownerUserId: "user-admin" }, db as never),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("cleans up the half-clone when a later step fails", async () => {
    const db = seed();
    db.failInsertInto = "storefront_gallery";
    const outcome = await duplicateBusiness(
      "biz-src",
      { name: "Lagoon Cruises", ownerUserId: "user-admin" },
      db as never,
    ).then(
      (v) => ({ ok: true as const, value: v }),
      (e: unknown) => ({ ok: false as const, error: e }),
    );
    expect(outcome.ok).toBe(false);
    expect(db.tables.businesses.some((b) => b.name === "Lagoon Cruises")).toBe(false);
    expect(db.tables.services.some((s) => s.business_id !== "biz-src")).toBe(false);
    expect(db.tables.storefront_gallery.some((g) => g.business_id !== "biz-src")).toBe(false);
    expect(db.tables.business_members.some((m) => m.business_id !== "biz-src")).toBe(false);
  });
});
