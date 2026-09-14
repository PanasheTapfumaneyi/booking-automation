import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAvailability } from "@/lib/server/availability-service";
import { toApiErrorResponse } from "@/lib/server/route-helper";
import { ApiError } from "@/lib/server/errors";

function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get("serviceId") ?? "";
    const date = searchParams.get("date") ?? "";
    const businessId = searchParams.get("businessId") ?? undefined;
    const excludeBookingToken =
      searchParams.get("excludeBookingToken") ?? undefined;
    const rangeStart = searchParams.get("rangeStart") ?? undefined;
    const rangeEnd = searchParams.get("rangeEnd") ?? undefined;
    // Booking-UUID exclusion is never accepted here: a UUID is not an
    // authorization capability. Reschedule flows use authorized paths
    // (manage token for customers, membership-checked business routes).
    if (searchParams.get("excludeBookingId")) {
      throw new ApiError(
        400,
        "VALIDATION",
        "This parameter isn't supported on public availability.",
      );
    }

    if (!serviceId) {
      throw new ApiError(400, "VALIDATION", "A service is required.");
    }
    if (!date) {
      throw new ApiError(400, "VALIDATION", "A date is required.");
    }
    if (!isDateString(date)) {
      throw new ApiError(400, "VALIDATION", "The date format is invalid.");
    }
    const startIso = rangeStart ? parseInstant(rangeStart) : undefined;
    const endIso = rangeEnd ? parseInstant(rangeEnd) : undefined;
    if (Boolean(rangeStart) !== Boolean(rangeEnd)) {
      throw new ApiError(
        400,
        "VALIDATION",
        "Both rangeStart and rangeEnd are required for an interval search.",
      );
    }
    if (rangeStart && (!startIso || !endIso || endIso.getTime() <= startIso.getTime())) {
      throw new ApiError(
        400,
        "VALIDATION",
        "The availability range must be a valid start and end time.",
      );
    }

    const availability = await getAvailability({
      businessId,
      serviceId,
      date,
      excludeBookingToken,
      startIso: startIso?.toISOString(),
      endIso: endIso?.toISOString(),
    });
    return NextResponse.json(availability);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

function parseInstant(value: string): Date | null {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}