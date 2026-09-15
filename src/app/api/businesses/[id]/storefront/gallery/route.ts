import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import { addGalleryImage } from "@/lib/server/storefront";
import { toApiErrorResponse } from "@/lib/server/route-helper";
import { revalidatePublicPages } from "../route";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/businesses/[id]/storefront/gallery — add one image by URL.
 * (Storage uploads go through /storefront/media and return a URL first.)
 */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const body = (await request.json().catch(() => null)) as {
      imageUrl?: unknown;
      caption?: unknown;
      altText?: unknown;
      sortOrder?: unknown;
      isFeatured?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    }
    const image = await addGalleryImage(
      ctx.business.id,
      {
        imageUrl: body.imageUrl,
        caption: body.caption,
        altText: body.altText,
        sortOrder: body.sortOrder,
        isFeatured: body.isFeatured,
      },
      getSupabase(),
    );
    revalidatePublicPages(ctx.business.slug);
    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
