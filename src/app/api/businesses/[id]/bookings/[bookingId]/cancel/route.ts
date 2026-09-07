import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import { cancelBusinessBooking } from "@/lib/server/business-bookings";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ id: string; bookingId: string }>;
}

/**
 * POST /api/businesses/[id]/bookings/[bookingId]/cancel
 *
 * Same core as the customer flow: the booking becomes cancelled (history
 * preserved), the Calendar event is removed, and cancellation notifications
 * fire. Repeating the call is safe.
 */
export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id, bookingId } = await params;
    const ctx = await requireBusinessOwner(id);
    const booking = await cancelBusinessBooking(ctx.business.id, bookingId, getSupabase());
    return NextResponse.json({ booking });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
