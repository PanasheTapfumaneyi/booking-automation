import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import { updateResource, deleteResource } from "@/lib/server/businesses";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ id: string; resourceId: string }>;
}

/**
 * PATCH /api/businesses/[id]/resources/[resourceId]
 * Body: `{ name?, active?, resource_type?, description?, image_url?,
 * images?, daily_rate?, weekly_rate?, monthly_rate?, seats?,
 * transmission?, fuel?, category? }`.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id, resourceId } = await params;
    const ctx = await requireBusinessOwner(id);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    }
    const str = (key: string): string | undefined =>
      typeof body[key] === "string" ? (body[key] as string) : undefined;
    const nullableStr = (key: string): string | null | undefined =>
      body[key] === undefined ? undefined : typeof body[key] === "string" ? (body[key] as string) : null;
    await updateResource(
      ctx.business.id,
      resourceId,
      {
        name: str("name"),
        active: typeof body.active === "boolean" ? body.active : undefined,
        resource_type: nullableStr("resource_type"),
        description: nullableStr("description"),
        image_url: nullableStr("image_url"),
        images: body.images,
        daily_rate: body.daily_rate,
        weekly_rate: body.weekly_rate,
        monthly_rate: body.monthly_rate,
        seats: body.seats,
        transmission: nullableStr("transmission"),
        fuel: nullableStr("fuel"),
        category: nullableStr("category"),
      },
      getSupabase(),
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

/**
 * DELETE /api/businesses/[id]/resources/[resourceId]
 *
 * Removes a rental item. Past bookings survive (their item link nulls).
 * Prefer deactivation when the item has booking history.
 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id, resourceId } = await params;
    const ctx = await requireBusinessOwner(id);
    await deleteResource(ctx.business.id, resourceId, getSupabase());
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
