/**
 * Admin business-duplicate route tests.
 *
 * - Platform-admin gate: 401 anonymous, 403 non-admin.
 * - Missing/invalid body rejected before touching duplication.
 * - Owner defaults to the requesting admin; explicit owner honored.
 * - Cloning admin keeps dashboard access unless they are the owner.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiError } from "@/lib/server/errors";
import { POST } from "./route";

const requirePlatformAdminMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  getRequestUser: vi.fn(),
  requirePlatformAdmin: requirePlatformAdminMock,
}));

const memberInsertMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({
    from: () => ({
      insert: memberInsertMock.mockResolvedValue({ error: null }),
    }),
  }),
}));

const duplicateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/business-duplication", () => ({
  duplicateBusiness: duplicateMock,
}));

function post(sourceId: string, body: unknown) {
  return POST(
    new Request("http://localhost/api/admin/businesses/x/duplicate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: sourceId }) },
  );
}

beforeEach(() => {
  requirePlatformAdminMock.mockReset().mockResolvedValue({ id: "admin-1", email: "ops@kivo.mu" });
  memberInsertMock.mockReset().mockResolvedValue({ error: null });
  duplicateMock.mockReset().mockResolvedValue({ id: "biz-new", slug: "lagoon-cruises", counts: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/admin/businesses/[id]/duplicate", () => {
  it("denies anonymous callers", async () => {
    requirePlatformAdminMock.mockRejectedValue(new ApiError(401, "UNAUTHENTICATED", "Please log in."));
    const response = await post("biz-src", { name: "Lagoon Cruises" });
    expect(response.status).toBe(401);
    expect(duplicateMock).not.toHaveBeenCalled();
  });

  it("denies non-admin callers", async () => {
    requirePlatformAdminMock.mockRejectedValue(new ApiError(403, "FORBIDDEN", "Admins only."));
    const response = await post("biz-src", { name: "Lagoon Cruises" });
    expect(response.status).toBe(403);
    expect(duplicateMock).not.toHaveBeenCalled();
  });

  it("rejects a missing body", async () => {
    const response = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ id: "biz-src" }),
    });
    expect(response.status).toBe(400);
    expect(duplicateMock).not.toHaveBeenCalled();
  });

  it("defaults the owner to the requesting admin", async () => {
    const response = await post("biz-src", { name: "Lagoon Cruises" });
    expect(response.status).toBe(201);
    expect(duplicateMock).toHaveBeenCalledWith(
      "biz-src",
      expect.objectContaining({ name: "Lagoon Cruises", ownerUserId: "admin-1" }),
      expect.anything(),
    );
    // Admin is the owner: no extra membership row.
    expect(memberInsertMock).not.toHaveBeenCalled();
    const body = (await response.json()) as Record<string, unknown>;
    expect((body.business as Record<string, unknown>).slug).toBe("lagoon-cruises");
  });

  it("honours an explicit owner and keeps admin access", async () => {
    const response = await post("biz-src", { name: "Lagoon Cruises", ownerUserId: "user-prospect" });
    expect(response.status).toBe(201);
    expect(duplicateMock).toHaveBeenCalledWith(
      "biz-src",
      expect.objectContaining({ ownerUserId: "user-prospect" }),
      expect.anything(),
    );
    expect(memberInsertMock).toHaveBeenCalled();
  });

  it("maps duplication errors to responses", async () => {
    duplicateMock.mockRejectedValue(new ApiError(404, "BOOKING_NOT_FOUND", "That business wasn't found."));
    const response = await post("biz-nope", { name: "Lagoon Cruises" });
    expect(response.status).toBe(404);
  });
});
