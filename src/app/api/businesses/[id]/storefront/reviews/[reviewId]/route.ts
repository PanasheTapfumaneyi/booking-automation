import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import { deleteReview } from "@/lib/server/storefront";
import { toApiErrorResponse } from "@/lib/server/route-helper";
import { revalidatePublicPages } from "../../route";

interface ReviewRouteContext {
  params: Promise<{ id: string; reviewId: string }>;
}

/**
 * DELETE /api/businesses/[id]/storefront/reviews/[reviewId] — owner
 * moderation of an imported review. V1 has no manual review-entry
 * feature by design; this only removes.
 */
export async function DELETE(_request: Request, { params }: ReviewRouteContext) {
  try {
    const { id, reviewId } = await params;
    const ctx = await requireBusinessOwner(id);
    await deleteReview(ctx.business.id, reviewId, getSupabase());
    revalidatePublicPages(ctx.business.slug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
