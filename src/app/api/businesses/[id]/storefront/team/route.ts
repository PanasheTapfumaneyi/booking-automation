import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import { createTeamMember } from "@/lib/server/storefront";
import { toApiErrorResponse } from "@/lib/server/route-helper";
import { revalidatePublicPages } from "../route";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/businesses/[id]/storefront/team — add one public team
 * profile. A profile never implies a login (no membership touched).
 */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
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
    const member = await createTeamMember(
      ctx.business.id,
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
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
