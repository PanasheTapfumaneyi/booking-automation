/**
 * Booking service — resource (rental) create path.
 *
 * Rental bookings must: require an item, persist the interval + resource,
 * compute and attach the day×rate total, drive calendar sync and the
 * WhatsApp notification with the vehicle name + total, and reject conflicts
 * before any write.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { createBooking } from "./booking-service";
import type { BookingRow } from "@/lib/server/database";

const rpcMock = vi.hoisted(() => vi.fn());
const syncAfterCreateMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());
const assertResourceFreeMock = vi.hoisted(() => vi.fn());
const validateResourceBookingMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({ rpc: rpcMock } as never),
}));

vi.mock("@/lib/server/database", () => ({
  normalizePhone: (phone: string) => phone.replace(/[^\d]/g, ""),
  BOOKING_SELECT:
    "id, business_id, resource:resources(id, name, metadata)",
  fetchBusiness: vi.fn(async () => ({
    id: "biz-1",
    name: "Kivo Drive",
    phone: "+230 5744 4444",
    email: "demo@kivodrive.mu",
    timezone: "Indian/Mauritius",
    booking_mode: "resource",
    calendar_id: null,
    slug: "kivo-drive",
    is_demo: true,
    is_active: true,
  })),
  fetchService: vi.fn(async () => ({
    id: "svc-car",
    business_id: "biz-1",
    name: "Car Rental",
    description: null,
    duration_minutes: 1440,
    price: "1500",
    image_url: null,
    active: true,
  })),
  fetchBookingByToken: vi.fn(async () => null),
  fetchBlocks: vi.fn(async () => []),
  findOrCreateCustomer: vi.fn(async () => "cust-1"),
}));

vi.mock("@/lib/server/strategies/appointment", () => ({
  requireAppointmentSlot: vi.fn(),
}));

vi.mock("@/lib/server/strategies/resource", () => ({
  assertResourceFree: assertResourceFreeMock,
  validateResourceBooking: validateResourceBookingMock,
  resourceAvailability: vi.fn(),
  resourceIntervalAvailability: vi.fn(),
  isUnitRatedCollection: vi.fn(),
}));

vi.mock("@/lib/server/strategies/capacity", () => ({
  validateCapacityBooking: vi.fn(),
}));

vi.mock("@/lib/server/google-calendar/sync", () => ({
  syncAfterCreate: syncAfterCreateMock,
  assertNewTimeCalendarFree: vi.fn(),
  moveCalendarEvent: vi.fn(),
  syncAfterCancel: vi.fn(),
}));

vi.mock("@/lib/server/notifications/service", () => ({
  dispatchBookingEvent: dispatchMock,
}));

const now = new Date().toISOString();

function rpcRow(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: "B001",
    business_id: "biz-1",
    service_id: "svc-car",
    customer_id: "cust-1",
    resource_id: "res-vitz",
    session_id: null,
    quantity: 1,
    start_time: "2026-10-14T06:00:00.000Z",
    end_time: "2026-10-16T06:00:00.000Z",
    status: "confirmed",
    google_event_id: null,
    manage_token: "tok-123",
    previous_start_time: null,
    created_at: now,
    updated_at: now,
    service: { name: "Car Rental", duration_minutes: 1440, price: "1500" },
    customer: {
      name: "Ayesha Ramdin",
      phone: "+230 5744 4444",
      email: "ayesha@example.com",
    },
    resource: { name: "Toyota Vitz", metadata: { rate: 1400, seats: 5 } },
    ...overrides,
  } as BookingRow;
}

const baseInput = {
  serviceId: "svc-car",
  resourceId: "res-vitz",
  name: "Ayesha Ramdin",
  phone: "+230 5744 4444",
  email: "ayesha@example.com",
  startTime: "2026-10-14T06:00:00.000Z",
  endTime: "2026-10-16T06:00:00.000Z",
};

beforeEach(() => {
  validateResourceBookingMock.mockReset().mockResolvedValue({
    id: "res-vitz",
    business_id: "biz-1",
    name: "Toyota Vitz",
    resource_type: "vehicle",
    image_url: null,
    active: true,
    metadata: { rate: 1400, seats: 5 },
  });
  assertResourceFreeMock.mockReset().mockResolvedValue(undefined);
  rpcMock.mockReset().mockResolvedValue({ data: { ok: true, booking: rpcRow() }, error: null });
  syncAfterCreateMock.mockReset().mockResolvedValue(undefined);
  dispatchMock.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createBooking — resource (rental)", () => {
  it("persists the interval + item and returns the computed day×rate total", async () => {
    const booking = await createBooking(baseInput);

    expect(rpcMock).toHaveBeenCalledOnce();
    const rpcArgs = rpcMock.mock.calls[0][1] as Record<string, unknown>;
    expect(rpcArgs).toMatchObject({
      p_business_id: "biz-1",
      p_service_id: "svc-car",
      p_resource_id: "res-vitz",
      p_start_time: "2026-10-14T06:00:00.000Z",
      p_end_time: "2026-10-16T06:00:00.000Z",
    });
    expect(rpcArgs.p_manage_token).toEqual(expect.any(String));

    expect(booking.resourceId).toBe("res-vitz");
    expect(booking.resourceName).toBe("Toyota Vitz");
    expect(booking.servicePrice).toBe(2800); // 2 days × 1400
  });

  it("drives calendar sync with the vehicle name and the formatted total", async () => {
    await createBooking(baseInput);
    const args = syncAfterCreateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(args).toMatchObject({
      resourceName: "Toyota Vitz",
      displayTotal: "Rs 2,800",
    });
  });

  it("drives the WhatsApp dispatch with vehicle name and total (customer copy)", async () => {
    await createBooking(baseInput);
    const args = dispatchMock.mock.calls[0][0] as Record<string, unknown>;
    expect(args).toMatchObject({
      type: "booking.created",
      resourceName: "Toyota Vitz",
      displayTotal: "Rs 2,800",
      business: expect.objectContaining({ id: "biz-1", name: "Kivo Drive" }),
    });
  });

  it("falls back to the service price when the item has no per-day rate", async () => {
    validateResourceBookingMock.mockResolvedValue({
      id: "res-x",
      business_id: "biz-1",
      name: "Some Item",
      resource_type: "vehicle",
      image_url: null,
      active: true,
      metadata: {},
    });
    await createBooking(baseInput);
    expect(syncAfterCreateMock.mock.calls[0][0]).toMatchObject({
      displayTotal: "Rs 1,500",
    });
  });

  it("rejects a conflict before any write", async () => {
    const { ApiError } = await import("@/lib/server/errors");
    assertResourceFreeMock.mockRejectedValue(
      new ApiError(409, "SLOT_UNAVAILABLE", "That time was just booked."),
    );

    await expect(createBooking(baseInput)).rejects.toMatchObject({
      status: 409,
      code: "SLOT_UNAVAILABLE",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects when no item is selected", async () => {
    await expect(
      createBooking({ ...baseInput, resourceId: undefined }),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION" });
    expect(validateResourceBookingMock).not.toHaveBeenCalled();
  });

  it("rejects an inverted or past interval", async () => {
    await expect(
      createBooking({
        ...baseInput,
        startTime: "2026-10-16T06:00:00.000Z",
        endTime: "2026-10-14T06:00:00.000Z",
      }),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION" });
    await expect(
      createBooking({
        ...baseInput,
        startTime: "2020-01-01T00:00:00.000Z",
        endTime: "2020-01-02T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION" });
    expect(rpcMock).not.toHaveBeenCalled();
  });
});