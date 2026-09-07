import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import { setSessionActive, updateSession } from "@/lib/server/businesses";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ id: string; sessionId: string }>;
}

/**
 * PATCH /api/businesses/[id]/sessions/[sessionId]
 * - `{ active }` toggles availability (bookings untouched).
 * - `{ start_time?, end_time?, capacity? }` edits the session; capacity can
 *   never drop below the already-booked quantity.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id, sessionId } = await params;
    const ctx = await requireBusinessOwner(id);
    const body = (await request.json().catch(() => null)) as {
      active?: unknown;
      start_time?: unknown;
      end_time?: unknown;
      capacity?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    }
    const hasEdits =
      body.start_time !== undefined || body.end_time !== undefined || body.capacity !== undefined;
    if (hasEdits) {
      await updateSession(
        ctx.business.id,
        sessionId,
        {
          start_time: typeof body.start_time === "string" ? body.start_time : undefined,
          end_time:
            body.end_time === null
              ? null
              : typeof body.end_time === "string"
                ? body.end_time
                : undefined,
          capacity: body.capacity === undefined ? undefined : Number(body.capacity),
        },
        getSupabase(),
      );
      return NextResponse.json({ ok: true });
    }
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "An 'active' flag is required." }, { status: 400 });
    }
    await setSessionActive(ctx.business.id, sessionId, body.active, getSupabase());
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
