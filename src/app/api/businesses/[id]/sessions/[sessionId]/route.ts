import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import { setSessionActive } from "@/lib/server/businesses";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ id: string; sessionId: string }>;
}

/** PATCH /api/businesses/[id]/sessions/[sessionId] — `{ active }`. */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id, sessionId } = await params;
    const ctx = await requireBusinessOwner(id);
    const body = (await request.json().catch(() => null)) as {
      active?: unknown;
    } | null;
    if (!body || typeof body.active !== "boolean") {
      return NextResponse.json({ error: "An 'active' flag is required." }, { status: 400 });
    }
    await setSessionActive(ctx.business.id, sessionId, body.active, getSupabase());
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
