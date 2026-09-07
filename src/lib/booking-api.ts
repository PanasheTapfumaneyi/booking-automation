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

export function apiCreateBooking(input: NewBookingInput): Promise<Booking> {
  return request<{ booking: Booking }>("/api/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((body) => body.booking);
}

export function apiRescheduleBooking(
  token: string,
  startTime: string,
): Promise<Booking> {
  return request<{ booking: Booking }>(
    `/api/bookings/${encodeURIComponent(token)}/reschedule`,
    {
      method: "POST",
      body: JSON.stringify({ startTime }),
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
  excludeBookingId?: string;
  businessId?: string;
}

export interface ApiAvailability {
  business: {
    id: string;
    name: string;
    timezone: string;
    hours?: import("@/lib/availability/hours").BusinessHours | null;
  };
  service: { id: string; name: string; durationMinutes: number; price: number };
  date: string;
  timezone: string;
  slots: TimeSlot[];
}

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
  if (params.excludeBookingId) {
    query.set("excludeBookingId", params.excludeBookingId);
  }
  if (params.businessId) {
    query.set("businessId", params.businessId);
  }
  return request<ApiAvailability>(`/api/availability?${query.toString()}`);
}