import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/server/auth";
import { createBusinessWithOwner } from "@/lib/server/businesses";
import { toApiErrorResponse } from "@/lib/server/route-helper";

/**
 * POST /api/admin/businesses
 *
 * Platform-admin endpoint for creating a business and assigning it to an
 * existing user. The admin is also added as an `admin`-role member so they
 * can manage the business through the dashboard.
 *
 * Body:
 *   { name, phone?, timezone?, booking_mode, ownerUserId, is_demo? }
 */
export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin();
    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      phone?: unknown;
      timezone?: unknown;
      booking_mode?: unknown;
      ownerUserId?: unknown;
      is_demo?: unknown;
    } | null;

    if (!body) {
      return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    }
    if (typeof body.ownerUserId !== "string" || !body.ownerUserId) {
      return NextResponse.json(
        { error: "Please specify the user who will own this business." },
        { status: 400 },
      );
    }

    const db = getSupabase();

    const created = await createBusinessWithOwner(
      body.ownerUserId,
      {
        name: typeof body.name === "string" ? body.name : "",
        phone: typeof body.phone === "string" ? body.phone : null,
        timezone: typeof body.timezone === "string" ? body.timezone : undefined,
        booking_mode: typeof body.booking_mode === "string" ? body.booking_mode : "",
        is_demo: body.is_demo === true,
      },
      db,
    );

    // Add the platform admin as an admin-role member so they can manage
    // the business through the dashboard.
    const { error: memberError } = await db.from("business_members").insert({
      business_id: created.id,
      user_id: admin.id,
      role: "admin",
    });
    if (memberError) {
      console.error("[admin/businesses] Failed to add admin membership:", memberError);
    }

    return NextResponse.json({ business: created }, { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
