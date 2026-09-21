import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/server/auth";
import { toApiErrorResponse } from "@/lib/server/route-helper";

/**
 * PATCH /api/admin/businesses/[id]/transfer-owner
 *
 * Transfers business ownership to a different user. The current owner is
 * demoted to `admin` role (retains dashboard access). The new user is
 * promoted to `owner` — added as a member first if not already.
 *
 * Body: { newOwnerUserId: string }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePlatformAdmin();
    const { id: businessId } = await params;
    const db = getSupabase();

    const body = (await request.json().catch(() => null)) as {
      newOwnerUserId?: unknown;
    } | null;
    if (!body || typeof body.newOwnerUserId !== "string" || !body.newOwnerUserId) {
      return NextResponse.json(
        { error: "Please provide the new owner's user ID." },
        { status: 400 },
      );
    }
    const newOwnerUserId = body.newOwnerUserId;

    // Verify the business exists
    const { data: business, error: bizError } = await db
      .from("businesses")
      .select("id, name")
      .eq("id", businessId)
      .single();
    if (bizError || !business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    // Find the current owner
    const { data: currentOwner, error: ownerError } = await db
      .from("business_members")
      .select("id, user_id, role")
      .eq("business_id", businessId)
      .eq("role", "owner")
      .maybeSingle();
    if (ownerError) throw ownerError;

    // Check if new owner is already a member
    const { data: existingMember } = await db
      .from("business_members")
      .select("id, role")
      .eq("business_id", businessId)
      .eq("user_id", newOwnerUserId)
      .maybeSingle();

    if (existingMember) {
      // Promote existing member to owner
      const { error: promoteError } = await db
        .from("business_members")
        .update({ role: "owner" })
        .eq("id", existingMember.id);
      if (promoteError) throw promoteError;
    } else {
      // Add new user as owner
      const { error: insertError } = await db.from("business_members").insert({
        business_id: businessId,
        user_id: newOwnerUserId,
        role: "owner",
      });
      if (insertError) throw insertError;
    }

    // Demote current owner to admin (if they exist and aren't the same user)
    if (currentOwner && currentOwner.user_id !== newOwnerUserId) {
      const { error: demoteError } = await db
        .from("business_members")
        .update({ role: "admin" })
        .eq("id", currentOwner.id);
      if (demoteError) throw demoteError;
    }

    return NextResponse.json({
      business: { id: business.id, name: business.name },
      previousOwnerId: currentOwner?.user_id ?? null,
      newOwnerUserId,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
