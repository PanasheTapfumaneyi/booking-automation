import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import { getAvailability } from "@/lib/server/availability-service";
import { fetchBusinessBookingById } from "@/lib/server/business-bookings";
import { toApiErrorResponse } from "@/lib/server/route-helper";
import { ApiError } from "@/lib/server/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * GET /api/businesses/[id]/availability?serviceId=&date=&bookingId=
 *
 * Membership-checked availability for business-side rescheduling. The
 * booking to exclude is re-resolved server-side, scoped to the owner's
 * business — unknown ids and other businesses' bookings share one safe
 * 404, and the exclusion can never escape that scope. The client-supplied
 * bookingId is an identifier only, never authority.
 */
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const searchParams = new URL(request.url).searchParams;
    const serviceId = searchParams.get("serviceId") ?? "";
    const date = searchParams.get("date") ?? "";
    const bookingId = searchParams.get("bookingId") ?? "";

    if (!serviceId) {
      throw new ApiError(400, "VALIDATION", "A service is required.");
    }
    if (!date) {
      throw new ApiError(400, "VALIDATION", "A date is required.");
    }
    if (!isDateString(date)) {
      throw new ApiError(400, "VALIDATION", "The date format is invalid.");
    }
    if (!bookingId) {
      throw new ApiError(400, "VALIDATION", "A booking is required.");
    }

    const db = getSupabase();
    const booking = await fetchBusinessBookingById(ctx.business.id, bookingId, db);
    if (!booking) {
      throw new ApiError(404, "BOOKING_NOT_FOUND", "We couldn't find this booking.");
    }

    const availability = await getAvailability({
      businessId: ctx.business.id,
      serviceId,
      date,
      excludeBookingId: booking.id,
    });
    return NextResponse.json(availability);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
