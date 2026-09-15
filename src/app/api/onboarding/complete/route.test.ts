/**
 * Self-configuration completion route tests.
 *
 * Only self_configuring setups can complete (at most once); anything
 * else is rejected or returned as-is, so refresh/retry is safe.
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

const getSetupMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const notifyMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/onboarding", () => ({
  getSetupRequest: getSetupMock,
  updateSetupRequest: updateMock,
  notifyOperatorOfSetupRequest: notifyMock,
  trackSetupEvent: trackMock,
}));

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/onboarding/complete", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  getRequestUserMock.mockReset().mockResolvedValue({ id: "user-1", email: "a@b.c" });
  findMembershipMock.mockReset().mockResolvedValue({ business_id: "biz-1", role: "owner" });
  fetchBusinessMock.mockReset().mockResolvedValue({ id: "biz-1", name: "ABC Cuts" });
  getSetupMock.mockReset().mockResolvedValue({
    business_id: "biz-1",
    status: "self_configuring",
    contact_phone: "+23057111111",
    business_type: "Barbershop",
  });
  updateMock.mockReset().mockResolvedValue({
    business_id: "biz-1",
    status: "ready_for_review",
    contact_phone: "+23057111111",
    business_type: "Barbershop",
  });
  notifyMock.mockReset().mockResolvedValue(true);
  trackMock.mockReset().mockReturnValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/onboarding/complete", () => {
  it("completes a self-configuring setup and notifies once", async () => {
    const res = await post({ businessId: "biz-1" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { setupStatus: string };
    expect(body.setupStatus).toBe("ready_for_review");
    expect(updateMock).toHaveBeenCalledWith("biz-1", { status: "ready_for_review" }, {});
    expect(notifyMock).toHaveBeenCalledOnce();
  });

  it("re-completion returns the state without duplicating work", async () => {
    getSetupMock.mockResolvedValue({ business_id: "biz-1", status: "ready_for_review" });
    const res = await post({ businessId: "biz-1" });
    expect(res.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("managed-pending setups cannot complete this way", async () => {
    getSetupMock.mockResolvedValue({ business_id: "biz-1", status: "pending_setup" });
    const res = await post({ businessId: "biz-1" });
    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("non-members cannot complete another business", async () => {
    findMembershipMock.mockResolvedValue(null);
    const res = await post({ businessId: "biz-9" });
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
