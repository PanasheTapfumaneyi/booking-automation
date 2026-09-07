import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import {
  requireAuthenticatedUser,
  getMyMemberships,
} from "@/lib/server/auth";
import { fetchBusiness } from "@/lib/server/database";
import { toApiErrorResponse } from "@/lib/server/route-helper";

/**
 * GET /api/business/memberships
 *
 * Businesses of the current session user. Only safe profile columns are
 * returned — no credentials exist on these tables.
 */
export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const memberships = await getMyMemberships(user.id);
    const db = getSupabase();
    const result = [];
    for (const membership of memberships) {
      const business = await fetchBusiness(membership.business_id, db).catch(
        () => null,
      );
      if (!business) continue;
      result.push({
        business_id: business.id,
        role: membership.role,
        business: {
          id: business.id,
          name: business.name,
          slug: business.slug,
          booking_mode: business.booking_mode,
          timezone: business.timezone,
        },
      });
    }
    return NextResponse.json({ memberships: result });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
