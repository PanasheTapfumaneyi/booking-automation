import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import {
  deleteGalleryImage,
  deleteStorefrontMedia,
  storagePathFromUrl,
  updateGalleryImage,
} from "@/lib/server/storefront";
import { toApiErrorResponse } from "@/lib/server/route-helper";
import { revalidatePublicPages } from "../../route";

interface ImageRouteContext {
  params: Promise<{ id: string; imageId: string }>;
}

/** PATCH — caption/alt/order/featured on one gallery image. */
export async function PATCH(request: Request, { params }: ImageRouteContext) {
  try {
    const { id, imageId } = await params;
    const ctx = await requireBusinessOwner(id);
    const body = (await request.json().catch(() => null)) as {
      caption?: unknown;
      altText?: unknown;
      sortOrder?: unknown;
      isFeatured?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    }
    await updateGalleryImage(
      ctx.business.id,
      imageId,
      {
        caption: body.caption,
        altText: body.altText,
        sortOrder: body.sortOrder,
        isFeatured: body.isFeatured,
      },
      getSupabase(),
    );
    revalidatePublicPages(ctx.business.slug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

/** DELETE — gallery row plus its stored object (best-effort). */
export async function DELETE(_request: Request, { params }: ImageRouteContext) {
  try {
    const { id, imageId } = await params;
    const ctx = await requireBusinessOwner(id);
    const db = getSupabase();
    // Best-effort storage cleanup first (external hotlinks resolve null
    // and are simply skipped — never touched).
    const { data } = await db
      .from("storefront_gallery")
      .select("image_url")
      .eq("id", imageId)
      .eq("business_id", ctx.business.id)
      .maybeSingle();
    const path = storagePathFromUrl(
      (data as { image_url?: unknown } | null)?.image_url as string | null,
    );
    await deleteGalleryImage(ctx.business.id, imageId, db);
    if (path) {
      await deleteStorefrontMedia(ctx.business.id, path, db).catch(() => undefined);
    }
    revalidatePublicPages(ctx.business.slug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
