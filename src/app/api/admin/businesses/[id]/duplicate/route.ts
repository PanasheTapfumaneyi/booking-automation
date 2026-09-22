import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/server/auth";
import { duplicateBusiness } from "@/lib/server/business-duplication";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/businesses/[id]/duplicate
 *
 * Platform-admin cold-call cloning: copies the source business into a new
 * live tenant with a fresh id/slug, blanked contact details, remapped
 * offering + storefront rows, and copied storage images. Reviews,
 * customers, bookings, credentials and history never copy.
 *
 * Body:
 *   { name, slug?, ownerUserId?, includeFutureSessions? }
 * `ownerUserId` defaults to the requesting admin (cold-call sites start
 * owned by their creator; transfer later with transfer-owner).
 */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const admin = await requirePlatformAdmin();
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      slug?: unknown;
      ownerUserId?: unknown;
      includeFutureSessions?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    }
    const ownerUserId =
      typeof body.ownerUserId === "string" && body.ownerUserId.trim()
        ? body.ownerUserId.trim()
        : admin.id;

    const db = getSupabase();
    const duplicated = await duplicateBusiness(
      id,
      {
        name: typeof body.name === "string" ? body.name : "",
        slug: typeof body.slug === "string" ? body.slug : null,
        ownerUserId,
        includeFutureSessions:
          body.includeFutureSessions === undefined
            ? undefined
            : body.includeFutureSessions === true,
      },
      db,
    );

    // The cloning admin keeps dashboard access unless they are the owner.
    if (admin.id !== ownerUserId) {
      const { error: memberError } = await db.from("business_members").insert({
        business_id: duplicated.id,
        user_id: admin.id,
        role: "admin",
      });
      if (memberError) {
        console.error("[admin/businesses/duplicate] Failed to add admin membership:", memberError);
      }
    }

    return NextResponse.json({ business: duplicated }, { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
