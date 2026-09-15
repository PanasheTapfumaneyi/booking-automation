import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import {
  deleteStorefrontMedia,
  MEDIA_KINDS,
  storagePathFromUrl,
  uploadStorefrontMedia,
} from "@/lib/server/storefront";
import { toApiErrorResponse } from "@/lib/server/route-helper";
import { revalidatePublicPages } from "../route";
import { ApiError } from "@/lib/server/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/businesses/[id]/storefront/media — owner image upload.
 *
 * Multipart form: `kind` (logo|cover|gallery|team) + `file`. The storage
 * path is built server-side as {businessId}/{kind}/{uuid}.{ext}, so one
 * tenant can never write into another tenant's prefix. Responds with the
 * public URL (saved by the caller into logo/cover/gallery/team fields)
 * and the storage path (needed for later deletion).
 */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ApiError(400, "VALIDATION", "Please choose an image to upload.");
    }
    const kind = form.get("kind");
    const file = form.get("file");
    if (typeof kind !== "string" || !(MEDIA_KINDS as readonly string[]).includes(kind)) {
      throw new ApiError(400, "VALIDATION", "Invalid upload slot.");
    }
    if (!(file instanceof File)) {
      throw new ApiError(400, "VALIDATION", "Please choose an image to upload.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await uploadStorefrontMedia(
      ctx.business.id,
      {
        kind,
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        bytes,
      },
      getSupabase(),
    );
    revalidatePublicPages(ctx.business.slug);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

/**
 * DELETE /api/businesses/[id]/storefront/media — removes one stored
 * object. Body: `{ path }` or `{ url }` (a public storefront-media URL,
 * whose path is derived and verified server-side). External hotlinks
 * resolve to nothing and are rejected — remote providers are never
 * touched. Rejected unless the path lives under the caller's own
 * business prefix.
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const body = (await request.json().catch(() => null)) as {
      path?: unknown;
      url?: unknown;
    } | null;
    let path: string | null = null;
    if (body && typeof body.path === "string") {
      path = body.path;
    } else if (body && typeof body.url === "string") {
      path = storagePathFromUrl(body.url);
    }
    if (!path) {
      return NextResponse.json({ error: "Missing image path." }, { status: 400 });
    }
    await deleteStorefrontMedia(ctx.business.id, path, getSupabase());
    revalidatePublicPages(ctx.business.slug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
