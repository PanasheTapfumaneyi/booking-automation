/**
 * Capacity reschedule service tests (Bug pass 2, issue 2).
 *
 * A customer with a capacity booking must be able to change the guest
 * count (2 -> 3, 3 -> 2, up to the effective maximum) and/or move to
 * another departure — without their own seats being double-counted and
 * without ever overselling the session.
 *
 * Covered here (service layer, friendly validation + RPC contract):
 * increase / decrease / maximum / over-capacity rejection / zero /
 * negative / non-integer / self-exclusion / cross-session moves with a
 * new quantity / wrong-mode + cancelled + unknown-token guards.
 *
 * The authoritative atomicity (row locks inside `update_booking_session`)
 * lives in migration 0017; the RPC body is pinned by contract below.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rescheduleCapacityBooking } from "./booking-service";
import type { BookingRow } from "@/lib/server/database";
import { ApiError } from "./errors";

const rpcMock = vi.hoisted(() => vi.fn());
const moveCalendarEventMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());
const fetchBookingByTokenMock = vi.hoisted(() => vi.fn());
const fetchBookingSessionMock = vi.hoisted(() => vi.fn());
const fetchSessionBookedQuantityMock = vi.hoisted(() => vi.fn());
const revertBookingSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({ rpc: rpcMock } as never),
}));

vi.mock("@/lib/server/database", () => ({
  normalizePhone: (phone: string) => phone.replace(/[^\d]/g, ""),
  BOOKING_SELECT: "select",
  fetchBusiness: vi.fn(async () => ({
    id: "biz-lagoon",
    name: "Blue Lagoon",
    phone: null,
    email: null,
    timezone: "Indian/Mauritius",
    booking_mode: "capacity",
    calendar_id: null,
    slug: "blue-lagoon",
    is_demo: true,
    is_active: true,
  })),
  fetchService: vi.fn(async () => ({
    id: "svc-swim",
    business_id: "biz-lagoon",
    name: "Group Swim Lesson",
    description: null,
    duration_minutes: 60,
    price: "800",
    image_url: null,
    active: true,
  })),
  fetchBookingByToken: fetchBookingByTokenMock,
  fetchBookingSession: fetchBookingSessionMock,
  fetchBlocks: vi.fn(async () => []),
  findOrCreateCustomer: vi.fn(async () => "cust-1"),
  revertBookingSession: revertBookingSessionMock,
}));

vi.mock("@/lib/server/strategies/appointment", () => ({
  requireAppointmentSlot: vi.fn(),
}));

vi.mock("@/lib/server/strategies/resource", () => ({
  assertResourceFree: vi.fn(),
  validateResourceBooking: vi.fn(),
  resourceAvailability: vi.fn(),
  resourceIntervalAvailability: vi.fn(),
  isUnitRatedCollection: vi.fn(),
}));

vi.mock("@/lib/server/strategies/capacity", () => ({
  validateCapacityBooking: vi.fn(),
  fetchSessionBookedQuantity: fetchSessionBookedQuantityMock,
}));

vi.mock("@/lib/server/google-calendar/sync", () => ({
  syncAfterCreate: vi.fn(),
  assertNewTimeCalendarFree: vi.fn(),
  moveCalendarEvent: moveCalendarEventMock,
  syncAfterCancel: vi.fn(),
}));

vi.mock("@/lib/server/notifications/service", () => ({
  dispatchBookingEvent: dispatchMock,
}));

const SESSION_A = {
  id: "sess-A",
  business_id: "biz-lagoon",
  service_id: "svc-swim",
  start_time: "2026-11-01T08:00:00.000Z",
  end_time: "2026-11-01T09:00:00.000Z",
  capacity: 10,
  active: true,
};

const SESSION_B = {
  id: "sess-B",
  business_id: "biz-lagoon",
  service_id: "svc-swim",
  start_time: "2026-11-02T08:00:00.000Z",
  end_time: "2026-11-02T09:00:00.000Z",
  capacity: 10,
  active: true,
};

const now = new Date().toISOString();

function bookingRow(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: "b-cap",
    business_id: "biz-lagoon",
    service_id: "svc-swim",
    customer_id: "cust-1",
    resource_id: null,
    session_id: "sess-A",
    quantity: 2,
    start_time: SESSION_A.start_time,
    end_time: SESSION_A.end_time,
    status: "confirmed",
    google_event_id: null,
    manage_token: "tok-cap",
    previous_start_time: null,
    created_at: now,
    updated_at: now,
    service: { name: "Group Swim Lesson", duration_minutes: 60, price: "800" },
    customer: { name: "Priya S.", phone: "+23057123456", email: null },
    ...overrides,
  } as BookingRow;
}

function movedRow(overrides: Partial<BookingRow> = {}): BookingRow {
  return bookingRow({ status: "rescheduled", ...overrides });
}

beforeEach(() => {
  fetchBookingByTokenMock.mockReset().mockResolvedValue({ row: bookingRow() });
  fetchBookingSessionMock
    .mockReset()
    .mockImplementation(async (id: string) =>
      id === "sess-A" ? { ...SESSION_A } : id === "sess-B" ? { ...SESSION_B } : null,
    );
  // Others on session A (excluding this booking): 7 of 10 taken.
  fetchSessionBookedQuantityMock.mockReset().mockResolvedValue(7);
  rpcMock
    .mockReset()
    .mockImplementation(async (_fn: string, args: Record<string, unknown>) =>
      Promise.resolve({
        data: {
          ok: true,
          booking: movedRow({
            session_id: args.p_session_id as string,
            quantity: args.p_quantity as number,
            start_time:
              args.p_session_id === "sess-B" ? SESSION_B.start_time : SESSION_A.start_time,
            end_time:
              args.p_session_id === "sess-B" ? SESSION_B.end_time : SESSION_A.end_time,
          }),
        },
        error: null,
      }),
    );
  moveCalendarEventMock.mockReset().mockResolvedValue({ status: "synced" });
  revertBookingSessionMock.mockReset().mockResolvedValue(true);
  dispatchMock.mockReset().mockResolvedValue({
    dispatched: true,
    recipients: { customer: "sent", business: "not_notified" },
    primary: "customer",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function expectApiError(
  work: Promise<unknown>,
  status: number,
  code: string,
): Promise<ApiError> {
  const err = (await work.catch((e: unknown) => e)) as ApiError;
  expect(err).toBeInstanceOf(ApiError);
  expect(err.status).toBe(status);
  expect(err.code).toBe(code);
  return err;
}

describe("rescheduleCapacityBooking — quantity changes on the same session", () => {
  it("2 -> 3 with capacity available (own seats not double-counted)", async () => {
    const booking = await rescheduleCapacityBooking("tok-cap", { quantity: 3 });
    expect(booking.quantity).toBe(3);
    expect(booking.sessionId).toBe("sess-A");
    // Self-exclusion: pre-flight must exclude this booking's own 2 seats.
    expect(fetchSessionBookedQuantityMock).toHaveBeenCalledWith({
      sessionId: "sess-A",
      excludeBookingId: "b-cap",
    });
    expect(rpcMock).toHaveBeenCalledWith("update_booking_session", {
      p_booking_id: "b-cap",
      p_session_id: "sess-A",
      p_quantity: 3,
    });
  });

  it("3 -> 2 decrease succeeds", async () => {
    fetchBookingByTokenMock.mockResolvedValue({ row: bookingRow({ quantity: 3 }) });
    const booking = await rescheduleCapacityBooking("tok-cap", { quantity: 2 });
    expect(booking.quantity).toBe(2);
    expect(rpcMock).toHaveBeenCalledWith("update_booking_session", {
      p_booking_id: "b-cap",
      p_session_id: "sess-A",
      p_quantity: 2,
    });
  });

  it("2 -> maximum valid capacity (10 - 7 others = 3)", async () => {
    const booking = await rescheduleCapacityBooking("tok-cap", { quantity: 3 });
    expect(booking.quantity).toBe(3);
  });

  it("increase beyond remaining capacity is rejected before any write", async () => {
    await expectApiError(rescheduleCapacityBooking("tok-cap", { quantity: 4 }), 409, "CAPACITY_FULL");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("guest-count-only edits skip the calendar API (same times)", async () => {
    await rescheduleCapacityBooking("tok-cap", { quantity: 3 });
    expect(moveCalendarEventMock).not.toHaveBeenCalled();
  });

  it("still sends the reschedule notification with the updated booking", async () => {
    await rescheduleCapacityBooking("tok-cap", { quantity: 3 });
    expect(dispatchMock).toHaveBeenCalledOnce();
    const args = dispatchMock.mock.calls[0][0] as { type: string; booking: BookingRow };
    expect(args.type).toBe("booking.rescheduled");
    expect(args.booking.quantity).toBe(3);
  });
});

describe("rescheduleCapacityBooking — invalid quantities", () => {
  it.each([0, -1, -10])("quantity %i is rejected (never silently clamped)", async (q) => {
    await expectApiError(rescheduleCapacityBooking("tok-cap", { quantity: q }), 400, "VALIDATION");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([2.5, Number.NaN, "3" as unknown as number])(
    "non-integer quantity %p is rejected",
    async (q) => {
      await expectApiError(rescheduleCapacityBooking("tok-cap", { quantity: q }), 400, "VALIDATION");
      expect(rpcMock).not.toHaveBeenCalled();
    },
  );

  it("quantity above session capacity is rejected", async () => {
    fetchSessionBookedQuantityMock.mockResolvedValue(0);
    await expectApiError(rescheduleCapacityBooking("tok-cap", { quantity: 11 }), 400, "VALIDATION");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("rescheduleCapacityBooking — session moves", () => {
  it("session A qty 2 -> session B qty 4 uses session B capacity", async () => {
    fetchSessionBookedQuantityMock.mockResolvedValue(5); // 5 others on B
    const booking = await rescheduleCapacityBooking("tok-cap", {
      sessionId: "sess-B",
      quantity: 4,
    });
    expect(booking.sessionId).toBe("sess-B");
    expect(booking.quantity).toBe(4);
    expect(booking.startTime).toBe(SESSION_B.start_time);
    expect(fetchSessionBookedQuantityMock).toHaveBeenCalledWith({
      sessionId: "sess-B",
      excludeBookingId: "b-cap",
    });
    expect(rpcMock).toHaveBeenCalledWith("update_booking_session", {
      p_booking_id: "b-cap",
      p_session_id: "sess-B",
      p_quantity: 4,
    });
  });

  it("session moves drive the calendar move (times changed, no duplicate)", async () => {
    fetchSessionBookedQuantityMock.mockResolvedValue(5);
    await rescheduleCapacityBooking("tok-cap", { sessionId: "sess-B", quantity: 4 });
    expect(moveCalendarEventMock).toHaveBeenCalledOnce();
    const args = moveCalendarEventMock.mock.calls[0][0] as {
      newStartIso: string;
      previousStartIso: string;
    };
    expect(args.newStartIso).toBe(SESSION_B.start_time);
    expect(args.previousStartIso).toBe(SESSION_A.start_time);
  });

  it("move beyond the new session's remaining capacity is rejected", async () => {
    fetchSessionBookedQuantityMock.mockResolvedValue(7); // 7 others on B
    await expectApiError(
      rescheduleCapacityBooking("tok-cap", { sessionId: "sess-B", quantity: 4 }),
      409,
      "CAPACITY_FULL",
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("an RPC CAPACITY_FULL (lost race) surfaces as 409", async () => {
    fetchSessionBookedQuantityMock.mockResolvedValue(0);
    rpcMock.mockResolvedValue({ data: { ok: false, code: "CAPACITY_FULL" }, error: null });
    await expectApiError(rescheduleCapacityBooking("tok-cap", { quantity: 5 }), 409, "CAPACITY_FULL");
  });

  it("a database error surfaces as 500 without leaking internals", async () => {
    fetchSessionBookedQuantityMock.mockResolvedValue(0);
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expectApiError(rescheduleCapacityBooking("tok-cap", { quantity: 5 }), 500, "INTERNAL");
  });

  it("calendar failure reverts the session move atomically, then rethrows", async () => {
    fetchSessionBookedQuantityMock.mockResolvedValue(5);
    const calendarError = new Error("calendar down");
    moveCalendarEventMock.mockRejectedValue(calendarError);
    const err = await rescheduleCapacityBooking("tok-cap", {
      sessionId: "sess-B",
      quantity: 4,
    }).catch((e: unknown) => e);
    expect(err).toBe(calendarError);
    expect(revertBookingSessionMock).toHaveBeenCalledWith("b-cap", "sess-A", 2);
  });

  it("unknown departures, past departures and cross-service moves are rejected", async () => {
    await expectApiError(
      rescheduleCapacityBooking("tok-cap", { sessionId: "sess-nope" }),
      400,
      "SESSION_NOT_FOUND",
    );
    fetchBookingSessionMock.mockResolvedValueOnce({
      ...SESSION_B,
      start_time: "2020-01-01T08:00:00.000Z",
    });
    await expectApiError(
      rescheduleCapacityBooking("tok-cap", { sessionId: "sess-B" }),
      400,
      "VALIDATION",
    );
    fetchBookingSessionMock.mockResolvedValueOnce({
      ...SESSION_B,
      service_id: "svc-other",
    });
    await expectApiError(
      rescheduleCapacityBooking("tok-cap", { sessionId: "sess-B" }),
      400,
      "VALIDATION",
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("rescheduleCapacityBooking — guards", () => {
  it("unknown token is 404", async () => {
    fetchBookingByTokenMock.mockResolvedValue(null);
    await expectApiError(rescheduleCapacityBooking("tok-nope", { quantity: 3 }), 404, "BOOKING_NOT_FOUND");
  });

  it("cancelled bookings cannot be modified", async () => {
    fetchBookingByTokenMock.mockResolvedValue({ row: bookingRow({ status: "cancelled" }) });
    await expectApiError(rescheduleCapacityBooking("tok-cap", { quantity: 1 }), 409, "BOOKING_CANCELLED");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("non-capacity bookings are rejected", async () => {
    fetchBookingByTokenMock.mockResolvedValue({ row: bookingRow({ session_id: null }) });
    await expectApiError(rescheduleCapacityBooking("tok-cap", { quantity: 2 }), 400, "VALIDATION");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
