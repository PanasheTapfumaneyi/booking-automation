/**
 * Business availability authorization tests (hardening patch).
 *
 * The bookingId in the URL is an identifier only: the server re-resolves it
 * scoped to the owner's business and derives the exclusion internally.
 * Unknown ids, other businesses' bookings, and unauthenticated callers all
 * fail safely; a client-supplied business scope can never widen the query.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiError } from "@/lib/server/errors";
import { GET } from "./route";

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];

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

  private matching(): Row[] {
    return (this.tables[this.tableName] ?? []).filter((row) =>
      this.filters.every((pred) => pred(row)),
    );
  }

  async maybeSingle(): Promise<{ data: unknown; error: null }> {
    return { data: this.matching()[0] ?? null, error: null };
  }
}

const holder: { tables: Record<string, Row[]> | null } = { tables: null };

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => {
    if (!holder.tables) throw new Error("fake db not installed");
    const tables = holder.tables;
    return { from: (table: string) => new FakeQuery(tables, table) };
  },
}));

const authMock = vi.hoisted(() => ({
  requireBusinessOwner: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => authMock);

const availabilityMock = vi.hoisted(() => ({ getAvailability: vi.fn() }));

vi.mock("@/lib/server/availability-service", () => availabilityMock);

const BIZ = {
  id: "biz-1",
  name: "Fade District",
  timezone: "Indian/Mauritius",
  booking_mode: "appointment",
  slug: "fade-district",
};

function seed(): void {
  holder.tables = {
    bookings: [
      {
        id: "b-1",
        business_id: "biz-1",
        service_id: "svc-1",
        manage_token: "tok-secret-a",
        status: "confirmed",
        start_time: "2026-09-10T06:00:00.000Z",
        end_time: "2026-09-10T07:00:00.000Z",
      },
      {
        id: "b-9",
        business_id: "biz-9",
        service_id: "svc-9",
        manage_token: "tok-secret-other",
        status: "confirmed",
        start_time: "2026-09-10T06:00:00.000Z",
        end_time: "2026-09-10T07:00:00.000Z",
      },
    ],
  };
}

function ownerCtx() {
  return {
    user: { id: "user-1", email: "owner@example.com" },
    membership: { business_id: "biz-1", role: "owner" },
    business: BIZ,
  };
}

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

function get(url: string, id: string) {
  return GET(new Request(url) as never, paramsFor(id));
}

beforeEach(() => {
  seed();
  authMock.requireBusinessOwner.mockImplementation(async () => ownerCtx());
  availabilityMock.getAvailability.mockReset();
  availabilityMock.getAvailability.mockResolvedValue({ slots: [] });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  holder.tables = null;
});

describe("GET /api/businesses/[id]/availability", () => {
  it("rejects unauthenticated callers with 401", async () => {
    authMock.requireBusinessOwner.mockRejectedValueOnce(
      new ApiError(401, "UNAUTHENTICATED", "Please log in to continue."),
    );
    const response = await get(
      "http://localhost/api/businesses/biz-1/availability?serviceId=s1&date=2026-09-10&bookingId=b-1",
      "biz-1",
    );
    expect(response.status).toBe(401);
    expect(availabilityMock.getAvailability).not.toHaveBeenCalled();
  });

  it("rejects non-members with 403", async () => {
    authMock.requireBusinessOwner.mockRejectedValueOnce(
      new ApiError(403, "FORBIDDEN", "You don't have access to this business."),
    );
    const response = await get(
      "http://localhost/api/businesses/biz-1/availability?serviceId=s1&date=2026-09-10&bookingId=b-1",
      "biz-1",
    );
    expect(response.status).toBe(403);
    expect(availabilityMock.getAvailability).not.toHaveBeenCalled();
  });

  it("returns safe 404 for unknown booking ids", async () => {
    const response = await get(
      "http://localhost/api/businesses/biz-1/availability?serviceId=s1&date=2026-09-10&bookingId=missing",
      "biz-1",
    );
    expect(response.status).toBe(404);
    expect(availabilityMock.getAvailability).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain("tok-secret");
  });

  it("returns safe 404 for another business's booking without touching the engine", async () => {
    const response = await get(
      "http://localhost/api/businesses/biz-1/availability?serviceId=s1&date=2026-09-10&bookingId=b-9",
      "biz-1",
    );
    expect(response.status).toBe(404);
    expect(availabilityMock.getAvailability).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain("tok-secret-other");
  });

  it("derives the exclusion server-side for an owned booking", async () => {
    const response = await get(
      "http://localhost/api/businesses/biz-1/availability?serviceId=s1&date=2026-09-10&bookingId=b-1",
      "biz-1",
    );
    expect(response.status).toBe(200);
    expect(availabilityMock.getAvailability).toHaveBeenCalledOnce();
    const args = availabilityMock.getAvailability.mock.calls[0][0] as Record<string, unknown>;
    expect(args.businessId).toBe("biz-1");
    expect(args.excludeBookingId).toBe("b-1");
    expect(args).not.toHaveProperty("excludeBookingToken");
    expect(JSON.stringify(await response.json())).not.toContain("tok-secret-a");
  });

  it("ignores client-supplied business scope", async () => {
    const response = await get(
      "http://localhost/api/businesses/biz-1/availability?serviceId=s1&date=2026-09-10&bookingId=b-1&businessId=biz-9",
      "biz-1",
    );
    expect(response.status).toBe(200);
    const args = availabilityMock.getAvailability.mock.calls[0][0] as Record<string, unknown>;
    expect(args.businessId).toBe("biz-1");
    expect(args.excludeBookingId).toBe("b-1");
  });

  it("validates required params", async () => {
    const base = "http://localhost/api/businesses/biz-1/availability";
    for (const query of [
      "date=2026-09-10&bookingId=b-1",
      "serviceId=s1&bookingId=b-1",
      "serviceId=s1&date=not-a-date&bookingId=b-1",
      "serviceId=s1&date=2026-09-10",
    ]) {
      const response = await get(`${base}?${query}`, "biz-1");
      expect(response.status).toBe(400);
    }
    expect(availabilityMock.getAvailability).not.toHaveBeenCalled();
  });
});
