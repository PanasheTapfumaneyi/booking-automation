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
    const excludeBookingId =
      searchParams.get("excludeBookingId") ?? undefined;

    if (!serviceId) {
      throw new ApiError(400, "VALIDATION", "A service is required.");
    }
    if (!date) {
      throw new ApiError(400, "VALIDATION", "A date is required.");
    }
    if (!isDateString(date)) {
      throw new ApiError(400, "VALIDATION", "The date format is invalid.");
    }

    const availability = await getAvailability({
      businessId,
      serviceId,
      date,
      excludeBookingToken,
      excludeBookingId,
    });
    return NextResponse.json(availability);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}