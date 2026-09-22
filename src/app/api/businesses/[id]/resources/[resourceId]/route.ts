import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import { updateResource } from "@/lib/server/businesses";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ id: string; resourceId: string }>;
}

/**
 * PATCH /api/businesses/[id]/resources/[resourceId]
 * Body: `{ name?, active?, description?, image_url? }`.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id, resourceId } = await params;
    const ctx = await requireBusinessOwner(id);
    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      active?: unknown;
      description?: unknown;
      image_url?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    }
    await updateResource(
      ctx.business.id,
      resourceId,
      {
        name: typeof body.name === "string" ? body.name : undefined,
        active: typeof body.active === "boolean" ? body.active : undefined,
        description: body.description === undefined ? undefined : typeof body.description === "string" ? body.description : null,
        image_url: body.image_url === undefined ? undefined : typeof body.image_url === "string" ? body.image_url : null,
      },
      getSupabase(),
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
