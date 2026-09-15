import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import {
  deleteStorefrontMedia,
  deleteTeamMember,
  storagePathFromUrl,
  updateTeamMember,
} from "@/lib/server/storefront";
import { toApiErrorResponse } from "@/lib/server/route-helper";
import { revalidatePublicPages } from "../../route";

interface MemberRouteContext {
  params: Promise<{ id: string; memberId: string }>;
}

/** PATCH — profile fields on one team member (same tenant). */
export async function PATCH(request: Request, { params }: MemberRouteContext) {
  try {
    const { id, memberId } = await params;
    const ctx = await requireBusinessOwner(id);
    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      role?: unknown;
      bio?: unknown;
      photoUrl?: unknown;
      visible?: unknown;
      bookable?: unknown;
      sortOrder?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    }
    await updateTeamMember(
      ctx.business.id,
      memberId,
      {
        name: body.name,
        role: body.role,
        bio: body.bio,
        photoUrl: body.photoUrl,
        visible: body.visible,
        bookable: body.bookable,
        sortOrder: body.sortOrder,
      },
      getSupabase(),
    );
    revalidatePublicPages(ctx.business.slug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

/** DELETE — profile row plus its stored photo (best-effort). */
export async function DELETE(_request: Request, { params }: MemberRouteContext) {
  try {
    const { id, memberId } = await params;
    const ctx = await requireBusinessOwner(id);
    const db = getSupabase();
    const { data } = await db
      .from("storefront_team")
      .select("photo_url")
      .eq("id", memberId)
      .eq("business_id", ctx.business.id)
      .maybeSingle();
    const path = storagePathFromUrl(
      (data as { photo_url?: unknown } | null)?.photo_url as string | null,
    );
    await deleteTeamMember(ctx.business.id, memberId, db);
    if (path) {
      await deleteStorefrontMedia(ctx.business.id, path, db).catch(() => undefined);
    }
    revalidatePublicPages(ctx.business.slug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
