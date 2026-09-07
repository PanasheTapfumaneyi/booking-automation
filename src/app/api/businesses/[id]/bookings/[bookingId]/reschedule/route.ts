import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import { rescheduleBusinessBooking } from "@/lib/server/business-bookings";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ id: string; bookingId: string }>;
}

/**
 * POST /api/businesses/[id]/bookings/[bookingId]/reschedule
 * Body: `{ startTime, endTime? }` (endTime required for resource bookings).
 * Same core, token, event, and notifications as the customer flow — the
 * manage token stays server-side throughout.
 */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id, bookingId } = await params;
    const ctx = await requireBusinessOwner(id);
    const body = (await request.json().catch(() => null)) as {
      startTime?: unknown;
      endTime?: unknown;
    } | null;
    if (!body || typeof body.startTime !== "string") {
      return NextResponse.json({ error: "A new time is required." }, { status: 400 });
    }
    const booking = await rescheduleBusinessBooking(
      ctx.business.id,
      bookingId,
      body.startTime,
      typeof body.endTime === "string" ? body.endTime : undefined,
      getSupabase(),
    );
    return NextResponse.json({ booking });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
