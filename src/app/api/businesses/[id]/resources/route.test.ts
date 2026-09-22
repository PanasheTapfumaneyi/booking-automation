/**
 * Rental-item API tests.
 *
 * - Owner gate: anonymous/foreign callers are denied before any write.
 * - POST accepts the full listing shape (rates, specs, photos) and
 *   passes it through to createResource.
 * - PATCH forwards pricing/spec/photo fields to updateResource.
 * - DELETE removes scoped to the owning business.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiError } from "@/lib/server/errors";
import { POST } from "./route";
import { PATCH, DELETE } from "./[resourceId]/route";

const requireBusinessOwnerMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  getRequestUser: vi.fn(),
  requireBusinessOwner: requireBusinessOwnerMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({}),
}));

const createMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/businesses", () => ({
  createResource: createMock,
  updateResource: updateMock,
  deleteResource: deleteMock,
  listResources: vi.fn().mockResolvedValue([]),
}));

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/businesses/biz-1/resources", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "biz-1" }) },
  );
}

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/businesses/biz-1/resources/res-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "biz-1", resourceId: "res-1" }) },
  );
}

function remove() {
  return DELETE(
    new Request("http://localhost/api/businesses/biz-1/resources/res-1", { method: "DELETE" }),
    { params: Promise.resolve({ id: "biz-1", resourceId: "res-1" }) },
  );
}

beforeEach(() => {
  requireBusinessOwnerMock.mockReset().mockResolvedValue({ business: { id: "biz-1" } });
  createMock.mockReset().mockResolvedValue({ id: "res-9" });
  updateMock.mockReset().mockResolvedValue(undefined);
  deleteMock.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/businesses/[id]/resources", () => {
  it("denies callers without ownership", async () => {
    requireBusinessOwnerMock.mockRejectedValue(new ApiError(403, "FORBIDDEN", "Not your business."));
    const response = await post({ name: "Corolla" });
    expect(response.status).toBe(403);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates a listing with rates, specs and photos", async () => {
    const response = await post({
      name: "Corolla",
      resource_type: "vehicle",
      description: "Reliable sedan.",
      image_url: "https://example.com/corolla.jpg",
      images: ["https://example.com/corolla-2.jpg"],
      daily_rate: 1400,
      weekly_rate: 8000,
      monthly_rate: 30000,
      seats: 5,
      transmission: "Automatic",
      fuel: "Petrol",
      category: "Compact",
    });
    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      "biz-1",
      expect.objectContaining({
        name: "Corolla",
        daily_rate: 1400,
        weekly_rate: 8000,
        monthly_rate: 30000,
        seats: 5,
        images: ["https://example.com/corolla-2.jpg"],
      }),
      expect.anything(),
    );
  });
});

describe("PATCH /api/businesses/[id]/resources/[resourceId]", () => {
  it("forwards pricing and photo fields", async () => {
    const response = await patch({ daily_rate: 1500, weekly_rate: null, images: [] });
    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      "biz-1",
      "res-1",
      expect.objectContaining({ daily_rate: 1500, weekly_rate: null, images: [] }),
      expect.anything(),
    );
  });

  it("maps server errors to responses", async () => {
    updateMock.mockRejectedValue(new ApiError(404, "RESOURCE_NOT_FOUND", "That resource wasn't found."));
    const response = await patch({ name: "Ghost" });
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/businesses/[id]/resources/[resourceId]", () => {
  it("deletes scoped to the owning business", async () => {
    const response = await remove();
    expect(response.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith("biz-1", "res-1", expect.anything());
  });

  it("denies callers without ownership", async () => {
    requireBusinessOwnerMock.mockRejectedValue(new ApiError(403, "FORBIDDEN", "Not your business."));
    const response = await remove();
    expect(response.status).toBe(403);
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
