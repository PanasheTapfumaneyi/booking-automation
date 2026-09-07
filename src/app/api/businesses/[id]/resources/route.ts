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

/** POST /api/businesses/[id]/resources — `{ name }`. */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    }
    const created = await createResource(
      ctx.business.id,
      { name: typeof body.name === "string" ? body.name : "" },
      getSupabase(),
    );
    return NextResponse.json({ resource: created }, { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
