import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import {
  listBusinessBookings,
  fetchBusinessBookingCounts,
  getBusinessDayBounds,
} from "@/lib/server/business-bookings";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/businesses/[id]/bookings/overview
 *
 * Operational homepage data: today's bookings, next upcoming bookings, and
 * small bounded counts. Day bounds use the business timezone.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const db = getSupabase();
    const now = new Date();
    const { dayStartUtc, dayEndUtc } = getBusinessDayBounds(ctx.business.timezone, now);

    const [today, upcoming, counts] = await Promise.all([
      listBusinessBookings(
        ctx.business.id,
        {
          statuses: ["confirmed", "rescheduled"],
          fromIso: dayStartUtc,
          toIso: dayEndUtc,
          limit: 50,
        },
        db,
      ),
      listBusinessBookings(
        ctx.business.id,
        {
          statuses: ["confirmed", "rescheduled"],
          fromIso: dayEndUtc,
          limit: 10,
        },
        db,
      ),
      fetchBusinessBookingCounts(ctx.business, now, db),
    ]);

    return NextResponse.json({
      business: {
        id: ctx.business.id,
        name: ctx.business.name,
        slug: ctx.business.slug,
        timezone: ctx.business.timezone,
        booking_mode: ctx.business.booking_mode,
        todayKey: getBusinessDayBounds(ctx.business.timezone, now).todayKey,
      },
      today,
      upcoming,
      counts,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
