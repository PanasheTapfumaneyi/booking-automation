import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import { updateService } from "@/lib/server/businesses";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ id: string; serviceId: string }>;
}

/**
 * PATCH /api/businesses/[id]/services/[serviceId]
 * Body: `{ name?, duration_minutes?, price?, active?, description?, image_url? }` (deactivate via active:false).
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id, serviceId } = await params;
    const ctx = await requireBusinessOwner(id);
    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      duration_minutes?: unknown;
      price?: unknown;
      active?: unknown;
      description?: unknown;
      image_url?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    }
    await updateService(
      ctx.business.id,
      serviceId,
      {
        name: typeof body.name === "string" ? body.name : undefined,
        duration_minutes: body.duration_minutes === undefined ? undefined : Number(body.duration_minutes),
        price: body.price === undefined ? undefined : Number(body.price),
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
