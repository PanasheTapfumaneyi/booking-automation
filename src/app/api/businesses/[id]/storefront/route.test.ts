/**
 * Storefront API route tests (Phase 2 data foundation).
 *
 * Every storefront route is owner-gated (401 anonymous, 403 non-member)
 * and validates before writing. Tenant isolation itself is enforced by
 * passing ctx.business.id (never client input) into lib helpers.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiError } from "@/lib/server/errors";
import { GET as getStorefront, PATCH as patchStorefront } from "./route";
import { POST as postGallery } from "./gallery/route";
import { POST as postMedia } from "./media/route";

const requireBusinessOwnerMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  getRequestUser: vi.fn(),
  findMembership: vi.fn(),
  requireBusinessOwner: requireBusinessOwnerMock,
  requirePlatformAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({}),
}));

const upsertMock = vi.hoisted(() => vi.fn());
const setCategoryMock = vi.hoisted(() => vi.fn());
const setMediaMock = vi.hoisted(() => vi.fn());
const setThemeMock = vi.hoisted(() => vi.fn());
const bundleMock = vi.hoisted(() => vi.fn());
const addGalleryMock = vi.hoisted(() => vi.fn());
const uploadMediaMock = vi.hoisted(() => vi.fn());
const deleteMediaMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/storefront", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  getStorefrontBundle: bundleMock,
  listTeam: vi.fn(async () => []),
  listReviews: vi.fn(async () => []),
  upsertStorefront: upsertMock,
  setBusinessCategory: setCategoryMock,
  setBusinessMedia: setMediaMock,
  setBusinessTheme: setThemeMock,
  addGalleryImage: addGalleryMock,
  uploadStorefrontMedia: uploadMediaMock,
  deleteStorefrontMedia: deleteMediaMock,
}));

function ownerCtx() {
  return {
    user: { id: "user-1", email: "o@x.mu" },
    membership: { business_id: "biz-1", role: "owner" },
    business: { id: "biz-1", name: "Watpo Hair Studio", slug: "watpo-hair-studio" },
  };
}

function req(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  requireBusinessOwnerMock.mockReset().mockResolvedValue(ownerCtx());
  bundleMock.mockReset().mockResolvedValue({
    storefront: null,
    gallery: [],
    team: [],
    reviews: [],
  });
  upsertMock.mockReset().mockResolvedValue({ business_id: "biz-1" });
  setCategoryMock.mockReset().mockResolvedValue(undefined);
  setMediaMock.mockReset().mockResolvedValue(undefined);
  setThemeMock.mockReset().mockResolvedValue(undefined);
  addGalleryMock.mockReset().mockResolvedValue({ id: "g-9" });
  uploadMediaMock.mockReset().mockResolvedValue({
    url: "https://cdn.example/storefront-media/biz-1/logo/abc.png",
    path: "biz-1/logo/abc.png",
  });
  deleteMediaMock.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("storefront routes — authorization", () => {
  it("GET denies anonymous owners-to-be (401)", async () => {
    requireBusinessOwnerMock.mockRejectedValue(
      new ApiError(401, "UNAUTHENTICATED", "Please log in to continue."),
    );
    const res = await getStorefront(req("http://x/api", "GET"), {
      params: Promise.resolve({ id: "biz-1" }),
    });
    expect(res.status).toBe(401);
    expect(bundleMock).not.toHaveBeenCalled();
  });

  it("PATCH denies other tenants (403) without touching data", async () => {
    requireBusinessOwnerMock.mockRejectedValue(
      new ApiError(403, "FORBIDDEN", "You don't have access to this business."),
    );
    const res = await patchStorefront(req("http://x/api", "PATCH", { headline: "Hi" }), {
      params: Promise.resolve({ id: "biz-9" }),
    });
    expect(res.status).toBe(403);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(setCategoryMock).not.toHaveBeenCalled();
  });

  it("gallery POST denies non-members", async () => {
    requireBusinessOwnerMock.mockRejectedValue(
      new ApiError(403, "FORBIDDEN", "You don't have access to this business."),
    );
    const res = await postGallery(
      req("http://x/api", "POST", { imageUrl: "https://x.mu/a.jpg" }),
      { params: Promise.resolve({ id: "biz-9" }) },
    );
    expect(res.status).toBe(403);
    expect(addGalleryMock).not.toHaveBeenCalled();
  });
});

describe("storefront routes — validation", () => {
  it("PATCH rejects an unknown category before writing anything", async () => {
    const res = await patchStorefront(
      req("http://x/api", "PATCH", { category: "yacht_club" }),
      { params: Promise.resolve({ id: "biz-1" }) },
    );
    expect(res.status).toBe(400);
    expect(setCategoryMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("PATCH saves category plus config in one call", async () => {
    const res = await patchStorefront(
      req("http://x/api", "PATCH", { category: "barber", headline: "Sharp" }),
      { params: Promise.resolve({ id: "biz-1" }) },
    );
    expect(res.status).toBe(200);
    expect(setCategoryMock).toHaveBeenCalledWith("biz-1", "barber", {});
    expect(upsertMock).toHaveBeenCalledWith(
      "biz-1",
      expect.objectContaining({ headline: "Sharp" }),
      {},
    );
    expect(setMediaMock).not.toHaveBeenCalled();
    expect(setThemeMock).not.toHaveBeenCalled();
  });

  it("PATCH saves logo and theme through targeted setters", async () => {
    const res = await patchStorefront(
      req("http://x/api", "PATCH", {
        logoUrl: "https://x.mu/logo.png",
        themePrimary: "#15547D",
        themeAccent: "#15547D",
      }),
      { params: Promise.resolve({ id: "biz-1" }) },
    );
    expect(res.status).toBe(200);
    expect(setMediaMock).toHaveBeenCalledWith(
      "biz-1",
      { logoUrl: "https://x.mu/logo.png", coverUrl: undefined },
      {},
    );
    expect(setThemeMock).toHaveBeenCalledWith(
      "biz-1",
      { primary: "#15547D", accent: "#15547D" },
      {},
    );
  });

  it("media POST rejects non-image slots without touching storage", async () => {
    const form = new FormData();
    form.set("kind", "avatar");
    form.set("file", new File(["x"], "a.jpg", { type: "image/jpeg" }));
    const res = await postMedia(
      new Request("http://x/api", { method: "POST", body: form }),
      { params: Promise.resolve({ id: "biz-1" }) },
    );
    expect(res.status).toBe(400);
  });

  it("media POST rejects missing files", async () => {
    const form = new FormData();
    form.set("kind", "logo");
    const res = await postMedia(
      new Request("http://x/api", { method: "POST", body: form }),
      { params: Promise.resolve({ id: "biz-1" }) },
    );
    expect(res.status).toBe(400);
  });

  it("media POST uploads valid images and returns url plus path", async () => {
    const form = new FormData();
    form.set("kind", "gallery");
    form.set("file", new File(["bytes"], "photo.jpg", { type: "image/jpeg" }));
    const res = await postMedia(
      new Request("http://x/api", { method: "POST", body: form }),
      { params: Promise.resolve({ id: "biz-1" }) },
    );
    expect(res.status).toBe(201);
    expect(uploadMediaMock).toHaveBeenCalledWith(
      "biz-1",
      expect.objectContaining({ kind: "gallery", contentType: "image/jpeg" }),
      {},
    );
    const body = (await res.json()) as { url: string; path: string };
    expect(body.url).toContain("storefront-media");
    expect(body.path).toBe("biz-1/logo/abc.png");
  });

  it("media DELETE rejects foreign business paths", async () => {
    deleteMediaMock.mockRejectedValue(
      new ApiError(400, "VALIDATION", "That image doesn't belong to this business."),
    );
    const { DELETE: deleteMedia } = await import("./media/route");
    const res = await deleteMedia(
      req("http://x/api", "DELETE", { path: "biz-9/gallery/abc.jpg" }),
      { params: Promise.resolve({ id: "biz-1" }) },
    );
    expect(res.status).toBe(400);
  });
});
