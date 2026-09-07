import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import {
  fetchBusinessBookingById,
  fetchBookingNotificationSummary,
} from "@/lib/server/business-bookings";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ id: string; bookingId: string }>;
}

/**
 * GET /api/businesses/[id]/bookings/[bookingId]
 *
 * Business-side detail: safe booking fields, delivery timeline (statuses
 * only), and calendar state. Unknown ids and other businesses' bookings
 * share one safe 404. manage_token is never selected or returned.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id, bookingId } = await params;
    const ctx = await requireBusinessOwner(id);
    const db = getSupabase();
    const booking = await fetchBusinessBookingById(ctx.business.id, bookingId, db);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }
    const notifications = await fetchBookingNotificationSummary(booking.id, db);
    return NextResponse.json({
      booking,
      notifications,
      calendar: {
        status: booking.calendarSyncStatus,
        error: booking.calendarSyncError,
        syncedAt: booking.calendarSyncedAt,
      },
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
