import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import { createBusinessBooking } from "@/lib/server/business-bookings";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/businesses/[id]/bookings
 *
 * Owner-side create reusing the shared booking engine (constraints, Calendar
 * sync, notifications identical to public booking). Body:
 * `{ serviceId, startTime, endTime?, resourceId?, sessionId?, quantity?,
 *    customerId? | (name, phone, email?) }`.
 * The service/resource/session must belong to the business. The response is
 * a sanitized booking (no manage token).
 */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const body = (await request.json().catch(() => null)) as {
      serviceId?: unknown;
      startTime?: unknown;
      endTime?: unknown;
      resourceId?: unknown;
      sessionId?: unknown;
      quantity?: unknown;
      customerId?: unknown;
      name?: unknown;
      phone?: unknown;
      email?: unknown;
    } | null;
    if (!body || typeof body.serviceId !== "string") {
      return NextResponse.json({ error: "A service is required." }, { status: 400 });
    }
    const booking = await createBusinessBooking(
      ctx.business,
      {
        serviceId: body.serviceId,
        startTime: typeof body.startTime === "string" ? body.startTime : "",
        endTime: typeof body.endTime === "string" ? body.endTime : "",
        resourceId: typeof body.resourceId === "string" ? body.resourceId : null,
        sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
        quantity: body.quantity === undefined ? undefined : Number(body.quantity),
        customerId: typeof body.customerId === "string" ? body.customerId : undefined,
        name: typeof body.name === "string" ? body.name : "",
        phone: typeof body.phone === "string" ? body.phone : "",
        email: typeof body.email === "string" ? body.email : undefined,
      },
      getSupabase(),
    );
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
