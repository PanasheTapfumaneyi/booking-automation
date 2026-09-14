/**
 * Availability route — interval (rental) search parameters.
 *
 * `rangeStart`/`rangeEnd` must be passed together and form a valid, ordered
 * interval. When present they are forwarded to the engine as startIso/endIso
 * and the interval payload is returned verbatim.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { GET } from "./route";
import type { NextRequest } from "next/server";

const getAvailabilityMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/availability-service", () => ({
  getAvailability: getAvailabilityMock,
}));

const INTERVAL_PAYLOAD = {
  kind: "resource",
  business: { id: "biz-1", name: "Kivo Drive", timezone: "Indian/Mauritius" },
  service: { id: "svc-car", name: "Car Rental", durationMinutes: 1440, price: 1500 },
  date: "2026-10-14",
  startIso: "2026-10-14T06:00:00.000Z",
  endIso: "2026-10-16T06:00:00.000Z",
  timezone: "Indian/Mauritius",
  resources: [{ id: "res-1", name: "Toyota Vitz", resourceType: "vehicle", active: true, imageUrl: null, metadata: { rate: 1400 }, available: false }],
};

function req(query: string): NextRequest {
  return new Request(`http://localhost/api/availability?${query}`) as NextRequest;
}

async function body(response: Response) {
  return (await response.json()) as {
    error?: { code: string; userMessage: string };
    [key: string]: unknown;
  };
}

afterEach(() => {
  getAvailabilityMock.mockReset();
});

describe("GET /api/availability — interval search", () => {
  it("forwards rangeStart and rangeEnd as startIso/endIso", async () => {
    getAvailabilityMock.mockResolvedValue(INTERVAL_PAYLOAD);
    const response = await GET(
      req("serviceId=svc-car&date=2026-10-14&rangeStart=2026-10-14T06%3A00%3A00.000Z&rangeEnd=2026-10-16T06%3A00%3A00.000Z"),
    );
    expect(response.status).toBe(200);
    expect(getAvailabilityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: "svc-car",
        startIso: "2026-10-14T06:00:00.000Z",
        endIso: "2026-10-16T06:00:00.000Z",
      }),
    );
    const json = await body(response);
    expect(json.kind).toBe("resource");
    expect(json.startIso).toBe("2026-10-14T06:00:00.000Z");
  });

  it("rejects when only rangeStart is provided", async () => {
    const response = await GET(
      req("serviceId=svc-car&date=2026-10-14&rangeStart=2026-10-14T06%3A00%3A00.000Z"),
    );
    expect(response.status).toBe(400);
    const json = await body(response);
    expect(String(json.error?.userMessage)).toMatch(/Both rangeStart and rangeEnd are required/i);
    expect(getAvailabilityMock).not.toHaveBeenCalled();
  });

  it("rejects when only rangeEnd is provided", async () => {
    const response = await GET(
      req("serviceId=svc-car&date=2026-10-14&rangeEnd=2026-10-16T06%3A00%3A00.000Z"),
    );
    expect(response.status).toBe(400);
    const json = await body(response);
    expect(String(json.error?.userMessage)).toMatch(/Both rangeStart and rangeEnd are required/i);
  });

  it("rejects an inverted interval", async () => {
    const response = await GET(
      req("serviceId=svc-car&date=2026-10-14&rangeStart=2026-10-16T06%3A00%3A00.000Z&rangeEnd=2026-10-14T06%3A00%3A00.000Z"),
    );
    expect(response.status).toBe(400);
    const json = await body(response);
    expect(String(json.error?.userMessage)).toMatch(/valid start and end time/i);
  });

  it("rejects an unparseable interval", async () => {
    const response = await GET(
      req("serviceId=svc-car&date=2026-10-14&rangeStart=bananas&rangeEnd=2026-10-16"),
    );
    expect(response.status).toBe(400);
    expect(getAvailabilityMock).not.toHaveBeenCalled();
  });

  it("leaves plain date searches unaffected (no range params)", async () => {
    getAvailabilityMock.mockResolvedValue({ kind: "appointment", slots: [] });
    const response = await GET(req("serviceId=svc-car&date=2026-10-14"));
    expect(response.status).toBe(200);
    expect(getAvailabilityMock).toHaveBeenCalledWith(
      expect.objectContaining({ startIso: undefined, endIso: undefined }),
    );
  });
});