import type { Booking, NewBookingInput, TimeSlot } from "@/types/booking";

interface ApiErrorBody {
  error?: { code?: string; userMessage?: string };
}

export class BookingApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "BookingApiError";
  }

  get isSlotUnavailable(): boolean {
    return this.code === "SLOT_UNAVAILABLE";
  }

  get isCapacityFull(): boolean {
    return this.code === "CAPACITY_FULL";
  }

  get isNotfound(): boolean {
    return this.code === "BOOKING_NOT_FOUND";
  }

  get isCancelled(): boolean {
    return this.code === "BOOKING_CANCELLED";
  }
}

const DEFAULT_FALLBACK = "Something went wrong. Please try again in a moment.";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new BookingApiError(
      "NETWORK",
      "We couldn't reach the booking service. Please check your connection.",
      0,
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON body — keep going so the status check below applies.
  }

  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new BookingApiError(
      error?.code ?? "INTERNAL",
      error?.userMessage ?? DEFAULT_FALLBACK,
      response.status,
    );
  }

  return body as T;
}

export function apiGetBooking(token: string): Promise<Booking> {
  return request<{ booking: Booking }>(
    `/api/bookings/${encodeURIComponent(token)}`,
  ).then((body) => body.booking);
}

export interface DispatchSummary {
  dispatched: boolean;
  recipients: {
    customer: "sent" | "failed" | "skipped" | "not_notified";
    business: "sent" | "failed" | "skipped" | "not_notified";
  };
  primary: "customer";
}

export interface CreateBookingResponse {
  booking: Booking;
  /** Honest non-throwing dispatch summary from the booking engine. */
  notifications: DispatchSummary;
}

export function apiCreateBooking(input: NewBookingInput): Promise<CreateBookingResponse> {
  return request<CreateBookingResponse>("/api/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface CapacityRescheduleOptions {
  /** Target departure (defaults server-side to the current session). */
  sessionId?: string;
  /** New guest count (defaults server-side to the current quantity). */
  quantity?: number;
}

export function apiRescheduleBooking(
  token: string,
  startTime?: string,
  endTime?: string,
  capacity?: CapacityRescheduleOptions,
): Promise<Booking> {
  return request<{ booking: Booking }>(
    `/api/bookings/${encodeURIComponent(token)}/reschedule`,
    {
      method: "POST",
      body: JSON.stringify({
        startTime,
        endTime,
        sessionId: capacity?.sessionId,
        quantity: capacity?.quantity,
      }),
    },
  ).then((body) => body.booking);
}

export function apiCancelBooking(token: string): Promise<Booking> {
  return request<{ booking: Booking }>(
    `/api/bookings/${encodeURIComponent(token)}/cancel`,
    { method: "POST" },
  ).then((body) => body.booking);
}

export interface ApiAvailabilityParams {
  serviceId: string;
  date: string;
  excludeBookingToken?: string;
  businessId?: string;
  /** Interval search (rentals): ISO instants bounding the requested range. */
  rangeStart?: string;
  rangeEnd?: string;
}

interface AvailabilityBase {
  business: {
    id: string;
    name: string;
    timezone: string;
    hours?: import("@/lib/availability/hours").BusinessHours | null;
  };
  service: { id: string; name: string; durationMinutes: number; price: number };
  date: string;
  timezone: string;
}

export interface AppointmentAvailability extends AvailabilityBase {
  kind: "appointment";
  slots: TimeSlot[];
}

export interface ResourceAvailability extends AvailabilityBase {
  kind: "resource";
  resources: Array<{
    id: string;
    name: string;
    resourceType: string;
    active: boolean;
    imageUrl?: string | null;
    metadata?: Record<string, unknown>;
    available?: boolean;
  }>;
  /** Present for interval (rental) searches. */
  startIso?: string;
  endIso?: string;
}

export interface CapacityAvailability extends AvailabilityBase {
  kind: "capacity";
  sessions: Array<{
    id: string;
    startTime: string;
    endTime: string | null;
    capacity: number;
    booked: number;
    remaining: number;
    active: boolean;
  }>;
}

export type ApiAvailability = AppointmentAvailability | ResourceAvailability | CapacityAvailability;

export function apiGetAvailability(
  params: ApiAvailabilityParams,
): Promise<ApiAvailability> {
  const query = new URLSearchParams({
    serviceId: params.serviceId,
    date: params.date,
  });
  if (params.excludeBookingToken) {
    query.set("excludeBookingToken", params.excludeBookingToken);
  }
  if (params.businessId) {
    query.set("businessId", params.businessId);
  }
  if (params.rangeStart) {
    query.set("rangeStart", params.rangeStart);
  }
  if (params.rangeEnd) {
    query.set("rangeEnd", params.rangeEnd);
  }
  return request<ApiAvailability>(`/api/availability?${query.toString()}`);
}

export interface BusinessAvailabilityParams {
  serviceId: string;
  date: string;
  bookingId: string;
}

/**
 * Membership-checked availability for business-side rescheduling. The
 * bookingId is an identifier only — the server re-resolves it scoped to
 * the owner's business and derives the exclusion internally.
 */
export function apiGetBusinessAvailability(
  businessId: string,
  params: BusinessAvailabilityParams,
): Promise<ApiAvailability> {
  const query = new URLSearchParams({
    serviceId: params.serviceId,
    date: params.date,
    bookingId: params.bookingId,
  });
  return request<ApiAvailability>(
    `/api/businesses/${encodeURIComponent(businessId)}/availability?${query.toString()}`,
  );
}