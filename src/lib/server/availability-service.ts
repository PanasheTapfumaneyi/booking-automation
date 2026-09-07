import { ApiError } from "@/lib/server/errors";
import {
  fetchBusiness,
  fetchService,
  fetchBookingById,
  fetchBookingByToken,
} from "@/lib/server/database";
import { appointmentAvailability } from "@/lib/server/strategies/appointment";
import { resourceAvailability } from "@/lib/server/strategies/resource";
import { capacityAvailability } from "@/lib/server/strategies/capacity";

export interface GetAvailabilityArgs {
  businessId?: string;
  serviceId: string;
  date: string;
  excludeBookingToken?: string;
  /**
   * Business-dashboard alternative to excludeBookingToken: a booking id to
   * exclude from conflict checks (the dashboard never holds manage tokens).
   * Like the token, it only loosens the caller's own availability view;
   * booking ids are unguessable UUIDs.
   */
  excludeBookingId?: string;
}

export type AvailabilityResponse =
  | Awaited<ReturnType<typeof appointmentAvailability>>
  | Awaited<ReturnType<typeof resourceAvailability>>
  | Awaited<ReturnType<typeof capacityAvailability>>;

const DEMO_BUSINESS_ID = "00000000-0000-4000-8000-000000000001";

/**
 * Dispatches availability to the strategy matching the business booking mode.
 * Appointment businesses keep the exact Phase 2 slot response; resource and
 * capacity businesses get their own payloads (no frontend consumes them yet).
 */
export async function getAvailability(
  args: GetAvailabilityArgs,
): Promise<AvailabilityResponse> {
  const businessId = args.businessId ?? DEMO_BUSINESS_ID;
  const business = await fetchBusiness(businessId);

  const service = await fetchService(args.serviceId);
  if (!service || service.business_id !== business.id || !service.active) {
    throw new ApiError(
      400,
      "SERVICE_NOT_FOUND",
      "That service isn't available right now.",
    );
  }

  let excludeBookingId: string | undefined;
  let ignoredGoogleEventId: string | undefined;
  if (args.excludeBookingToken) {
    const found = await fetchBookingByToken(args.excludeBookingToken);
    excludeBookingId = found?.row.id;
    ignoredGoogleEventId = found?.row.google_event_id ?? undefined;
  } else if (args.excludeBookingId) {
    const found = await fetchBookingById(args.excludeBookingId);
    excludeBookingId = found?.row.id;
    ignoredGoogleEventId = found?.row.google_event_id ?? undefined;
  }

  switch (business.booking_mode) {
    case "appointment":
      return appointmentAvailability({
        business,
        service,
        date: args.date,
        excludeBookingId,
        ignoreGoogleEventId: ignoredGoogleEventId,
      });
    case "resource":
      return resourceAvailability({ business, service, date: args.date });
    case "capacity":
      return capacityAvailability({
        business,
        service,
        date: args.date,
        excludeBookingId,
      });
  }
}