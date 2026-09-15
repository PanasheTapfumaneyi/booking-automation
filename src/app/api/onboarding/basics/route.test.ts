/**
 * Onboarding basics route tests.
 *
 * Minimal business creation must be idempotent: a user who already owns
 * a business (refresh/retry) gets it back instead of a duplicate.
 * Fresh signups land INACTIVE with a `new` setup row.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "./route";

const getRequestUserMock = vi.hoisted(() => vi.fn());
const getMyMembershipsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  getRequestUser: getRequestUserMock,
  getMyMemberships: getMyMembershipsMock,
  findMembership: vi.fn(),
  requirePlatformAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({}),
}));

const fetchBusinessMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/database", () => ({
  fetchBusiness: fetchBusinessMock,
}));

const createMock = vi.hoisted(() => vi.fn());
const ensureMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/businesses", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  createBusinessWithOwner: createMock,
}));

vi.mock("@/lib/server/onboarding", () => ({
  ensureSetupRequest: ensureMock,
  updateSetupRequest: updateMock,
  trackSetupEvent: trackMock,
}));

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/onboarding/basics", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  getRequestUserMock.mockReset().mockResolvedValue({ id: "user-1", email: "a@b.c" });
  getMyMembershipsMock.mockReset().mockResolvedValue([]);
  fetchBusinessMock.mockReset().mockResolvedValue({
    id: "biz-1",
    name: "ABC Cuts",
    slug: "abc-cuts",
  });
  createMock.mockReset().mockResolvedValue({ id: "biz-9", slug: "abc-cuts" });
  ensureMock.mockReset().mockResolvedValue({ business_id: "biz-9", status: "new" });
  updateMock.mockReset().mockResolvedValue({ business_id: "biz-9", status: "new" });
  trackMock.mockReset().mockReturnValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/onboarding/basics", () => {
  it("creates an inactive business with a setup row for fresh signups", async () => {
    const res = await post({
      name: "ABC Cuts",
      businessType: "Barbershop",
      phone: "+23057111111",
      booking_mode: "appointment",
    });
    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ name: "ABC Cuts", is_active: false }),
      {},
    );
    const body = (await res.json()) as { setupStatus: string; existing: boolean };
    expect(body.setupStatus).toBe("new");
    expect(body.existing).toBe(false);
    expect(ensureMock).toHaveBeenCalledWith("biz-9", "user-1", {});
    expect(trackMock).toHaveBeenCalledWith(
      "onboarding.basics_completed",
      "biz-9",
      expect.objectContaining({ bookingMode: "appointment" }),
    );
  });

  it("returns the existing business on refresh/retry (no duplicate)", async () => {
    getMyMembershipsMock.mockResolvedValue([{ business_id: "biz-1", role: "owner" }]);
    const res = await post({ name: "Another Name", booking_mode: "appointment" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { existing: boolean };
    expect(body.existing).toBe(true);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects a missing business name", async () => {
    const res = await post({ name: "A", booking_mode: "appointment" });
    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid booking mode", async () => {
    const res = await post({ name: "ABC Cuts", booking_mode: "teleport" });
    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });
});
