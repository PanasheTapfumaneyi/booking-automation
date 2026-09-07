import { NextRequest, NextResponse } from "next/server";
import {
  disconnectBusiness,
  assertCalendarRouteAccess,
} from "@/lib/server/google-calendar/connections";
import { toApiErrorResponse } from "@/lib/server/route-helper";

/**
 * POST /api/integrations/google-calendar/disconnect
 * Body: { "business": "<businessId>" }
 *
 * Deactivates the connection and revokes the Google refresh token (best
 * effort). Historical bookings are untouched; the platform keeps booking via
 * Supabase alone afterwards.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      business?: string;
    } | null;
    const businessId =
      typeof body?.business === "string" && body.business.length > 0
        ? body.business
        : null;
    if (!businessId) {
      return NextResponse.json(
        { error: "Missing business id." },
        { status: 400 },
      );
    }
    const memberBusinessIds = await assertCalendarRouteAccess(businessId);
    const result = await disconnectBusiness(businessId, memberBusinessIds);
    return NextResponse.json(result);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}