/**
 * Storefront 2.0 data-foundation tests.
 *
 * Covers validation (category/social/amenities/sections/template), reads
 * tolerating missing rows, tenant-scoped writes, media path safety, and
 * the no-manual-review-entry rule (delete-only helper exists; no create).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private patch: Row | null = null;
  private insertRow: Row | null = null;
  private upsertRow: Row | null = null;
  private pendingDelete = false;

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  upsert(row: Row, _opts?: unknown): this {
    this.upsertRow = { ...row };
    return this;
  }

  delete(): this {
    this.pendingDelete = true;
    return this;
  }

  private rows(): Row[] {
    if (!this.tables[this.tableName]) this.tables[this.tableName] = [];
    return this.tables[this.tableName];
  }

  private matching(): Row[] {
    return this.rows().filter((row) => this.filters.every((p) => p(row)));
  }

  async maybeSingle(): Promise<{ data: unknown; error: null }> {
    if (this.upsertRow) {
      const table = this.rows();
      const key = this.upsertRow.business_id as string;
      const existing = table.find((r) => r.business_id === key);
      const merged = { ...(existing ?? {}), ...this.upsertRow };
      if (existing) Object.assign(existing, this.upsertRow);
      else table.push(merged);
      this.upsertRow = null;
      return { data: merged, error: null };
    }
    if (this.patch) {
      const matched = this.matching();
      for (const row of matched) Object.assign(row, this.patch);
      this.patch = null;
      return { data: matched[0] ?? null, error: null };
    }
    return { data: this.matching()[0] ?? null, error: null };
  }

  async single(): Promise<{ data: unknown; error: unknown }> {
    if (this.insertRow) {
      const created = {
        id: "gen-1",
        created_at: "2026-01-01T00:00:00.000Z",
        ...this.insertRow,
      };
      this.rows().push(created);
      this.insertRow = null;
      return { data: created, error: null };
    }
    return this.maybeSingle();
  }

  then<TResult = { data: unknown; error: null }>(
    onfulfilled?: (value: { data: unknown; error: null }) => TResult,
  ) {
    if (this.patch) {
      for (const row of this.matching()) Object.assign(row, this.patch);
      this.patch = null;
    }
    if (this.pendingDelete) {
      const table = this.rows();
      this.tables[this.tableName] = table.filter(
        (row) => !this.filters.every((p) => p(row)),
      );
      this.pendingDelete = false;
    }
    return Promise.resolve({ data: this.matching(), error: null }).then(
      onfulfilled as never,
    );
  }
}

const storageUploadMock = vi.hoisted(() => vi.fn());
const storageRemoveMock = vi.hoisted(() => vi.fn());
const storagePublicUrlMock = vi.hoisted(() => vi.fn());

const holder: { tables: Record<string, Row[]> | null } = { tables: null };

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => {
    if (!holder.tables) throw new Error("fake db not installed");
    const tables = holder.tables;
    return {
      from: (table: string) => new FakeQuery(tables, table),
      storage: {
        from: () => ({
          upload: storageUploadMock,
          remove: storageRemoveMock,
          getPublicUrl: storagePublicUrlMock,
        }),
      },
    };
  },
}));

import {
  addGalleryImage,
  createTeamMember,
  deleteGalleryImage,
  deleteReview,
  deleteStorefrontMedia,
  deleteTeamMember,
  getStorefront,
  getStorefrontBundle,
  listGallery,
  listReviews,
  listTeam,
  parseAmenities,
  parseSectionOrder,
  parseSocialLinks,
  setBusinessCategory,
  setBusinessMedia,
  setBusinessTheme,
  storagePathFromUrl,
  updateGalleryImage,
  updateTeamMember,
  uploadStorefrontMedia,
  upsertStorefront,
  validateCategory,
} from "./storefront";
import { ApiError } from "./errors";

const BIZ = "11111111-1111-4111-8111-111111111111";
const OTHER_BIZ = "22222222-2222-4222-8222-222222222222";

function seed(): void {
  holder.tables = {
    business_storefronts: [
      {
        business_id: BIZ,
        template: "appointment_modern",
        headline: "Sharp cuts",
        subheadline: null,
        hero_image_url: null,
        show_gallery: true,
        show_team: true,
        show_reviews: true,
        show_about: true,
        show_hours: true,
        show_location: true,
        show_social: true,
        social_links: { instagram: "https://instagram.com/abc" },
        amenities: ["Wi-Fi"],
        section_order: null,
        created_at: "",
        updated_at: "",
      },
    ],
    storefront_gallery: [
      {
        id: "g-1",
        business_id: BIZ,
        image_url: "https://example.com/1.jpg",
        caption: null,
        alt_text: null,
        sort_order: 0,
        is_featured: true,
        created_at: "",
      },
    ],
    storefront_team: [
      {
        id: "t-1",
        business_id: BIZ,
        member_user_id: null,
        name: "Jay",
        role: "Barber",
        bio: null,
        photo_url: null,
        visible: true,
        bookable: false,
        sort_order: 0,
        created_at: "",
      },
      {
        id: "t-2",
        business_id: BIZ,
        member_user_id: null,
        name: "Hidden",
        role: null,
        bio: null,
        photo_url: null,
        visible: false,
        bookable: false,
        sort_order: 1,
        created_at: "",
      },
    ],
    storefront_reviews: [],
    businesses: [{ id: BIZ, category: null }],
  };
}

beforeEach(() => {
  seed();
  storageUploadMock.mockReset().mockResolvedValue({ error: null });
  storageRemoveMock.mockReset().mockResolvedValue({ error: null });
  storagePublicUrlMock
    .mockReset()
    .mockReturnValue({ data: { publicUrl: "https://cdn.example/storage/v1/object/public/storefront-media/abc.jpg" } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("validators", () => {
  it("accepts known categories, clears on empty, rejects unknown", () => {
    expect(validateCategory("barber")).toBe("barber");
    expect(validateCategory(null)).toBeNull();
    expect(validateCategory("  ")).toBeNull();
    expect(() => validateCategory("car_dealership")).toThrow(ApiError);
  });

  it("constrains social links to known networks with http URLs", () => {
    expect(
      parseSocialLinks({ instagram: "https://instagram.com/x", website: "https://x.mu" }),
    ).toEqual({ instagram: "https://instagram.com/x", website: "https://x.mu" });
    expect(parseSocialLinks(null)).toEqual({});
    expect(() => parseSocialLinks({ myspace: "https://x.mu" })).toThrow(ApiError);
    expect(() => parseSocialLinks({ instagram: "not-a-url" })).toThrow(ApiError);
  });

  it("constrains amenities to the controlled list", () => {
    expect(parseAmenities(["Wi-Fi", "Parking"])).toEqual(["Wi-Fi", "Parking"]);
    expect(parseAmenities(null)).toEqual([]);
    expect(() => parseAmenities(["Free yacht"])).toThrow(ApiError);
  });

  it("constrains section order to known unique sections", () => {
    expect(parseSectionOrder(["hero", "gallery"])).toEqual(["hero", "gallery"]);
    expect(parseSectionOrder(null)).toBeNull();
    expect(() => parseSectionOrder(["hero", "hero"])).toThrow(ApiError);
    expect(() => parseSectionOrder(["checkout"])).toThrow(ApiError);
  });
});

describe("reads tolerate missing rows", () => {
  it("getStorefront returns null without a row", async () => {
    expect(await getStorefront(OTHER_BIZ)).toBeNull();
  });

  it("bundle composes empty parts (page renders today's design)", async () => {
    const bundle = await getStorefrontBundle(OTHER_BIZ);
    expect(bundle).toEqual({ storefront: null, gallery: [], team: [], reviews: [] });
  });

  it("public team/reviews hide invisible rows; owner sees all", async () => {
    expect((await listTeam(BIZ)).map((m) => m.id)).toEqual(["t-1"]);
    expect((await listTeam(BIZ, undefined, { all: true })).map((m) => m.id)).toEqual([
      "t-1",
      "t-2",
    ]);
    expect(await listReviews(BIZ)).toEqual([]);
  });

  it("gallery lists in order and patches caption/alt", async () => {
    const gallery = await listGallery(BIZ);
    expect(gallery.map((g) => g.id)).toEqual(["g-1"]);
    expect(gallery[0].is_featured).toBe(true);
    await updateGalleryImage(BIZ, "g-1", { caption: "Fresh fade", altText: "Fade" });
    const rows = holder.tables?.storefront_gallery ?? [];
    expect(rows.find((r) => r.id === "g-1")?.caption).toBe("Fresh fade");
  });
});

describe("writes stay tenant-scoped", () => {
  it("upsert creates then patches the 1:1 config", async () => {
    const created = await upsertStorefront(OTHER_BIZ, { headline: "Hello" });
    expect(created.headline).toBe("Hello");
    expect(created.show_gallery).toBe(true);
    const patched = await upsertStorefront(OTHER_BIZ, {
      headline: "Hi",
      amenities: ["Parking"],
      socialLinks: { facebook: "https://facebook.com/x" },
    });
    expect(patched.headline).toBe("Hi");
    expect(patched.amenities).toEqual(["Parking"]);
    const rows = (holder.tables?.business_storefronts ?? []).filter(
      (r) => r.business_id === OTHER_BIZ,
    );
    expect(rows).toHaveLength(1);
  });

  it("upsert rejects bad template/socials", async () => {
    await expect(upsertStorefront(BIZ, { template: "marketplace" })).rejects.toThrow(ApiError);
    await expect(upsertStorefront(BIZ, { socialLinks: { x: "y" } })).rejects.toThrow(ApiError);
  });

  it("gallery add requires a valid URL; delete is tenant-scoped", async () => {
    await expect(addGalleryImage(BIZ, { imageUrl: "notaurl" })).rejects.toThrow(ApiError);
    const added = await addGalleryImage(BIZ, {
      imageUrl: "https://example.com/2.jpg",
      caption: "Chair",
    });
    expect(added.image_url).toBe("https://example.com/2.jpg");
    await deleteGalleryImage(OTHER_BIZ, added.id);
    expect(
      (holder.tables?.storefront_gallery ?? []).some((r) => r.id === added.id),
    ).toBe(true);
    await deleteGalleryImage(BIZ, added.id);
    expect(
      (holder.tables?.storefront_gallery ?? []).some((r) => r.id === added.id),
    ).toBe(false);
  });

  it("team create requires a name; updates touch only the same tenant", async () => {
    await expect(createTeamMember(BIZ, { name: "  " })).rejects.toThrow(ApiError);
    const member = await createTeamMember(BIZ, { name: "Sam", role: "Stylist" });
    expect(member.name).toBe("Sam");
    await updateTeamMember(OTHER_BIZ, member.id, { role: "Owner" });
    const rows = holder.tables?.storefront_team ?? [];
    expect(rows.find((r) => r.id === member.id)?.role).toBe("Stylist");
    await updateTeamMember(BIZ, member.id, { role: "Owner" });
    expect(
      (holder.tables?.storefront_team ?? []).find((r) => r.id === member.id)?.role,
    ).toBe("Owner");
    await deleteTeamMember(BIZ, member.id);
    expect((holder.tables?.storefront_team ?? []).some((r) => r.id === member.id)).toBe(false);
  });

  it("review deletion is tenant-scoped (no manual entry helper exists)", async () => {
    holder.tables!.storefront_reviews = [
      { id: "r-1", business_id: BIZ, source: "google", visible: true },
    ];
    await deleteReview(OTHER_BIZ, "r-1");
    expect(holder.tables?.storefront_reviews).toHaveLength(1);
    await deleteReview(BIZ, "r-1");
    expect(holder.tables?.storefront_reviews).toHaveLength(0);
  });

  it("category writes go through validation", async () => {
    await setBusinessCategory(BIZ, "barber");
    expect(
      (holder.tables?.businesses ?? []).find((r) => r.id === BIZ)?.category,
    ).toBe("barber");
    await expect(setBusinessCategory(BIZ, "yacht_club" as never)).rejects.toThrow(ApiError);
  });

  it("media fields accept valid URLs and clear on null", async () => {
    await setBusinessMedia(BIZ, { logoUrl: "https://example.com/logo.png" });
    const rows = holder.tables?.businesses ?? [];
    expect(rows.find((r) => r.id === BIZ)?.logo_url).toBe("https://example.com/logo.png");
    await setBusinessMedia(BIZ, { logoUrl: null });
    expect(
      (holder.tables?.businesses ?? []).find((r) => r.id === BIZ)?.logo_url,
    ).toBeNull();
    await expect(setBusinessMedia(BIZ, { coverUrl: "notaurl" })).rejects.toThrow(ApiError);
  });

  it("theme merge preserves other keys and enforces readability", async () => {
    holder.tables!.businesses = [
      { id: BIZ, theme_config: { primary: "#13847D", custom: "kept" } },
    ];
    await setBusinessTheme(BIZ, { primary: "#15547D" });
    const row = (holder.tables?.businesses ?? []).find((r) => r.id === BIZ);
    expect((row?.theme_config as Record<string, unknown>)?.primary).toBe("#15547D");
    expect((row?.theme_config as Record<string, unknown>)?.custom).toBe("kept");
    // Too light for white text.
    await expect(setBusinessTheme(BIZ, { primary: "#F5F5F5" })).rejects.toThrow(ApiError);
    await expect(setBusinessTheme(BIZ, { primary: "blue" })).rejects.toThrow(ApiError);
  });
});

describe("media uploads", () => {
  const bytes = new Uint8Array([1, 2, 3]);

  it("stores under {businessId}/{kind}/{uuid}.{ext}", async () => {
    const result = await uploadStorefrontMedia(BIZ, {
      kind: "gallery",
      filename: "photo.PNG",
      contentType: "image/png",
      sizeBytes: 100,
      bytes,
    });
    expect(storageUploadMock).toHaveBeenCalledOnce();
    const [path] = storageUploadMock.mock.calls[0] as [string, unknown];
    expect(path).toMatch(
      new RegExp(`^${BIZ}/gallery/[0-9a-f-]{36}\\.png$`),
    );
    expect(result.path).toBe(path);
    expect(result.url).toContain("storefront-media");
  });

  it("rejects bad kind, type, size, and business", async () => {
    const base = { filename: "a.jpg", contentType: "image/jpeg", sizeBytes: 10, bytes };
    await expect(uploadStorefrontMedia(BIZ, { ...base, kind: "avatar" })).rejects.toThrow(ApiError);
    await expect(
      uploadStorefrontMedia(BIZ, { ...base, kind: "logo", contentType: "image/gif" }),
    ).rejects.toThrow(ApiError);
    await expect(
      uploadStorefrontMedia(BIZ, { ...base, kind: "logo", sizeBytes: 6 * 1024 * 1024 }),
    ).rejects.toThrow(ApiError);
    await expect(
      uploadStorefrontMedia("not-a-uuid", { ...base, kind: "logo" }),
    ).rejects.toThrow(ApiError);
    expect(storageUploadMock).not.toHaveBeenCalled();
  });

  it("deletes only paths under the tenant prefix", async () => {
    await deleteStorefrontMedia(BIZ, `${BIZ}/gallery/abc.jpg`);
    expect(storageRemoveMock).toHaveBeenCalledWith([`${BIZ}/gallery/abc.jpg`]);
    await expect(deleteStorefrontMedia(BIZ, `${OTHER_BIZ}/gallery/abc.jpg`)).rejects.toThrow(
      ApiError,
    );
    await expect(deleteStorefrontMedia(BIZ, `${BIZ}/../x.jpg`)).rejects.toThrow(ApiError);
  });

  it("storagePathFromUrl only resolves storefront-media URLs", () => {
    expect(
      storagePathFromUrl(
        "https://xyz.supabase.co/storage/v1/object/public/storefront-media/abc/cover/1.jpg",
      ),
    ).toBe("abc/cover/1.jpg");
    expect(storagePathFromUrl("https://images.unsplash.com/photo-1")).toBeNull();
    expect(storagePathFromUrl(null)).toBeNull();
    expect(
      storagePathFromUrl("https://xyz.supabase.co/storage/v1/object/public/other/a.jpg"),
    ).toBeNull();
  });
});
