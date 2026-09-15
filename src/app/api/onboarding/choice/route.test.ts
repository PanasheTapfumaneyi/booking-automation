/**
 * Setup-choice route tests (managed vs self).
 *
 * Pins the idempotency + validation contract:
 * - non-members get 403 (no cross-business writes)
 * - invalid preference rejected, managed requires a contact
 * - operator notified on first/changed choice only (refresh-safe)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "./route";

const getRequestUserMock = vi.hoisted(() => vi.fn());
const findMembershipMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  getRequestUser: getRequestUserMock,
  findMembership: findMembershipMock,
  requirePlatformAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({}),
}));

const fetchBusinessMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/database", () => ({
  fetchBusiness: fetchBusinessMock,
}));

const ensureMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const setPhoneMock = vi.hoisted(() => vi.fn());
const notifyMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/onboarding", () => ({
  ensureSetupRequest: ensureMock,
  updateSetupRequest: updateMock,
  setBusinessPhone: setPhoneMock,
  notifyOperatorOfSetupRequest: notifyMock,
  trackSetupEvent: trackMock,
}));

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/onboarding/choice", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  getRequestUserMock.mockReset().mockResolvedValue({ id: "user-1", email: "a@b.c" });
  findMembershipMock.mockReset().mockResolvedValue({ business_id: "biz-1", role: "owner" });
  fetchBusinessMock.mockReset().mockResolvedValue({
    id: "biz-1",
    name: "ABC Cuts",
    phone: "+23057111111",
    slug: "abc-cuts",
  });
  ensureMock.mockReset().mockResolvedValue({
    business_id: "biz-1",
    preference: null,
    status: "new",
  });
  updateMock.mockReset().mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
    business_id: "biz-1",
    business_type: "Barbershop",
    contact_phone: "+23057111111",
    preference: patch.preference ?? null,
    status: patch.status ?? "new",
  }));
  setPhoneMock.mockReset().mockResolvedValue(undefined);
  notifyMock.mockReset().mockResolvedValue(true);
  trackMock.mockReset().mockReturnValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/onboarding/choice", () => {
  it("rejects owners of other businesses (403, no cross-tenant write)", async () => {
    findMembershipMock.mockResolvedValue(null);
    const res = await post({ businessId: "biz-2", preference: "managed" });
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid preference", async () => {
    const res = await post({ businessId: "biz-1", preference: "carrier-pigeon" });
    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("managed setup requires a contact number", async () => {
    fetchBusinessMock.mockResolvedValue({ id: "biz-1", name: "ABC", phone: null, slug: "abc" });
    const res = await post({ businessId: "biz-1", preference: "managed", contactPhone: "" });
    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("records managed choice and notifies once", async () => {
    const res = await post({ businessId: "biz-1", preference: "managed" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { setupStatus: string; operatorNotified: boolean };
    expect(body.setupStatus).toBe("pending_setup");
    expect(body.operatorNotified).toBe(true);
    expect(updateMock).toHaveBeenCalledWith(
      "biz-1",
      expect.objectContaining({ preference: "managed", status: "pending_setup" }),
      {},
    );
    expect(notifyMock).toHaveBeenCalledOnce();
  });

  it("repeating the same choice does not re-notify (refresh-safe)", async () => {
    ensureMock.mockResolvedValue({
      business_id: "biz-1",
      preference: "managed",
      status: "pending_setup",
    });
    const res = await post({ businessId: "biz-1", preference: "managed" });
    expect(res.status).toBe(200);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("a changed choice notifies again", async () => {
    ensureMock.mockResolvedValue({
      business_id: "biz-1",
      preference: "managed",
      status: "pending_setup",
    });
    const res = await post({ businessId: "biz-1", preference: "self" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { setupStatus: string };
    expect(body.setupStatus).toBe("self_configuring");
    expect(notifyMock).toHaveBeenCalledOnce();
  });

  it("falls back to the business phone when no contact is typed", async () => {
    const res = await post({ businessId: "biz-1", preference: "self", contactPhone: "" });
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      "biz-1",
      expect.objectContaining({ contactPhone: "+23057111111" }),
      {},
    );
    // Same number as the business already has: no phone rewrite.
    expect(setPhoneMock).not.toHaveBeenCalled();
  });
});
