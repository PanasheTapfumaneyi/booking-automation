import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import { createService, listServices } from "@/lib/server/businesses";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/businesses/[id]/services — active + inactive services, safe columns. */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const services = await listServices(ctx.business.id, getSupabase());
    return NextResponse.json({ services });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

/** POST /api/businesses/[id]/services — `{ name, duration_minutes, price? }`. */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      duration_minutes?: unknown;
      price?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    }
    const created = await createService(
      ctx.business.id,
      {
        name: typeof body.name === "string" ? body.name : "",
        duration_minutes: Number(body.duration_minutes),
        price: body.price === undefined ? undefined : Number(body.price),
      },
      getSupabase(),
    );
    return NextResponse.json({ service: created }, { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
