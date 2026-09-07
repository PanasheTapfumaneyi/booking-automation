import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import { createSession, listSessions } from "@/lib/server/businesses";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/businesses/[id]/sessions — safe columns only. */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const sessions = await listSessions(ctx.business.id, getSupabase());
    return NextResponse.json({ sessions });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

/** POST /api/businesses/[id]/sessions — `{ service_id, start_time, end_time?, capacity }`. */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const body = (await request.json().catch(() => null)) as {
      service_id?: unknown;
      start_time?: unknown;
      end_time?: unknown;
      capacity?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    }
    const created = await createSession(
      ctx.business.id,
      {
        service_id: typeof body.service_id === "string" ? body.service_id : "",
        start_time: typeof body.start_time === "string" ? body.start_time : "",
        end_time: typeof body.end_time === "string" ? body.end_time : null,
        capacity: Number(body.capacity),
      },
      getSupabase(),
    );
    return NextResponse.json({ session: created }, { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
