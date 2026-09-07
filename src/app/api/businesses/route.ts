import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { createBusinessWithOwner } from "@/lib/server/businesses";
import { toApiErrorResponse } from "@/lib/server/route-helper";

/**
 * POST /api/businesses
 *
 * Onboarding step 1: creates a business plus the caller's owner membership
 * (and default notification settings) in one call. Body:
 * `{ name, phone?, timezone?, booking_mode }`.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      phone?: unknown;
      timezone?: unknown;
      booking_mode?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    }
    const created = await createBusinessWithOwner(
      user.id,
      {
        name: typeof body.name === "string" ? body.name : "",
        phone: typeof body.phone === "string" ? body.phone : null,
        timezone: typeof body.timezone === "string" ? body.timezone : undefined,
        booking_mode: typeof body.booking_mode === "string" ? body.booking_mode : "",
      },
      getSupabase(),
    );
    return NextResponse.json({ business: created }, { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
