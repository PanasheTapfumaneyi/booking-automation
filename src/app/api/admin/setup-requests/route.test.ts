/**
 * Admin setup-request route tests.
 *
 * - Platform admins see and move leads; anyone else is denied by the
 *   platform-admin gate (401 anonymous, 403 non-admin).
 * - Status changes are allowlisted; unknown businesses 404.
 * - Moving to `live` activates the public page; other moves deactivate.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiError } from "@/lib/server/errors";
import { GET, PATCH } from "./route";

const requirePlatformAdminMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  getRequestUser: vi.fn(),
  findMembership: vi.fn(),
  requirePlatformAdmin: requirePlatformAdminMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({}),
}));

const listMock = vi.hoisted(() => vi.fn());
const getSetupMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const setActiveMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/onboarding", () => ({
  listSetupRequests: listMock,
  getSetupRequest: getSetupMock,
  updateSetupRequest: updateMock,
  setBusinessActive: setActiveMock,
  trackSetupEvent: trackMock,
  SETUP_STATUSES: [
    "new",
    "pending_setup",
    "contacted",
    "setting_up",
    "self_configuring",
    "ready_for_review",
    "live",
  ],
}));

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/admin/setup-requests", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  requirePlatformAdminMock.mockReset().mockResolvedValue({ id: "admin-1", email: "ops@kivo.mu" });
  listMock.mockReset().mockResolvedValue([
    {
      business_id: "biz-1",
      business_name: "ABC Cuts",
      status: "pending_setup",
      contact_phone: "+23057111111",
    },
  ]);
  getSetupMock.mockReset().mockResolvedValue({ business_id: "biz-1", status: "pending_setup" });
  updateMock.mockReset().mockImplementation(async (_id: string, patchBody: { status: string }) => ({
    business_id: "biz-1",
    status: patchBody.status,
  }));
  setActiveMock.mockReset().mockResolvedValue(undefined);
  trackMock.mockReset().mockReturnValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/admin/setup-requests", () => {
  it("lists leads for a platform admin", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { requests: Array<{ business_id: string }> };
    expect(body.requests).toHaveLength(1);
    expect(body.requests[0].business_id).toBe("biz-1");
  });

  it("denies anonymous callers (401)", async () => {
    requirePlatformAdminMock.mockRejectedValue(
      new ApiError(401, "UNAUTHENTICATED", "Please log in to continue."),
    );
    const res = await GET();
    expect(res.status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("denies business owners without the platform flag (403)", async () => {
    requirePlatformAdminMock.mockRejectedValue(
      new ApiError(403, "FORBIDDEN", "Platform administrator access required."),
    );
    const res = await GET();
    expect(res.status).toBe(403);
    expect(listMock).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/setup-requests", () => {
  it("moving to live activates the public page", async () => {
    const res = await patch({ businessId: "biz-1", status: "live" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { setupStatus: string };
    expect(body.setupStatus).toBe("live");
    expect(setActiveMock).toHaveBeenCalledWith("biz-1", true, {});
  });

  it("moving away from live deactivates the public page", async () => {
    getSetupMock.mockResolvedValue({ business_id: "biz-1", status: "live" });
    const res = await patch({ businessId: "biz-1", status: "setting_up" });
    expect(res.status).toBe(200);
    expect(setActiveMock).toHaveBeenCalledWith("biz-1", false, {});
  });

  it("rejects unknown statuses", async () => {
    const res = await patch({ businessId: "biz-1", status: "launched" });
    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
    expect(setActiveMock).not.toHaveBeenCalled();
  });

  it("404s when the business has no setup row (existing tenants untouched)", async () => {
    getSetupMock.mockResolvedValue(null);
    const res = await patch({ businessId: "biz-legacy", status: "live" });
    expect(res.status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
    expect(setActiveMock).not.toHaveBeenCalled();
  });

  it("denies non-admins", async () => {
    requirePlatformAdminMock.mockRejectedValue(
      new ApiError(403, "FORBIDDEN", "Platform administrator access required."),
    );
    const res = await patch({ businessId: "biz-1", status: "live" });
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
