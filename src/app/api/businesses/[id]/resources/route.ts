import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import { createResource, listResources } from "@/lib/server/businesses";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/businesses/[id]/resources — safe columns only. */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const resources = await listResources(ctx.business.id, getSupabase());
    return NextResponse.json({ resources });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

/** POST /api/businesses/[id]/resources — full listing fields (only name required). */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    }
    const str = (key: string): string | undefined =>
      typeof body[key] === "string" ? (body[key] as string) : undefined;
    const created = await createResource(
      ctx.business.id,
      {
        name: str("name") ?? "",
        resource_type: str("resource_type"),
        description: str("description"),
        image_url: str("image_url"),
        images: body.images,
        daily_rate: body.daily_rate,
        weekly_rate: body.weekly_rate,
        monthly_rate: body.monthly_rate,
        seats: body.seats,
        transmission: str("transmission"),
        fuel: str("fuel"),
        category: str("category"),
      },
      getSupabase(),
    );
    return NextResponse.json({ resource: created }, { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
