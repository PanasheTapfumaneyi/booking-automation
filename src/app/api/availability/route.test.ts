/**
 * Public availability boundary tests (hardening patch).
 *
 * The public endpoint must never honor a client-supplied booking UUID:
 * excludeBookingId is rejected outright, while the manage-token capability
 * path keeps working untouched.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { GET } from "./route";

const availabilityMock = vi.hoisted(() => ({ getAvailability: vi.fn() }));

vi.mock("@/lib/server/availability-service", () => availabilityMock);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  availabilityMock.getAvailability.mockReset();
});

function get(url: string) {
  return GET(new Request(url) as never);
}

describe("GET /api/availability", () => {
  it("rejects excludeBookingId with 400 without touching the engine", async () => {
    const response = await get(
      "http://localhost/api/availability?serviceId=s1&date=2026-09-10&excludeBookingId=b-1",
    );
    expect(response.status).toBe(400);
    expect(availabilityMock.getAvailability).not.toHaveBeenCalled();
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION");
  });

  it("forwards the manage-token capability without any booking id", async () => {
    availabilityMock.getAvailability.mockResolvedValue({ slots: [] });
    const response = await get(
      "http://localhost/api/availability?serviceId=s1&date=2026-09-10&excludeBookingToken=tok-a",
    );
    expect(response.status).toBe(200);
    expect(availabilityMock.getAvailability).toHaveBeenCalledOnce();
    const args = availabilityMock.getAvailability.mock.calls[0][0] as Record<string, unknown>;
    expect(args.excludeBookingToken).toBe("tok-a");
    expect(args).not.toHaveProperty("excludeBookingId");
  });

  it("serves ordinary new-booking queries unchanged", async () => {
    availabilityMock.getAvailability.mockResolvedValue({ slots: [] });
    const response = await get(
      "http://localhost/api/availability?serviceId=s1&date=2026-09-10",
    );
    expect(response.status).toBe(200);
    const args = availabilityMock.getAvailability.mock.calls[0][0] as Record<string, unknown>;
    expect(args).not.toHaveProperty("excludeBookingId");
  });

  it("keeps existing validation (missing service)", async () => {
    const response = await get("http://localhost/api/availability?date=2026-09-10");
    expect(response.status).toBe(400);
    expect(availabilityMock.getAvailability).not.toHaveBeenCalled();
  });
});
