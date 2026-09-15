import { NextResponse } from "next/server";
import { rescheduleBooking, rescheduleCapacityBooking } from "@/lib/server/booking-service";
import { toApiErrorResponse } from "@/lib/server/route-helper";
import { ApiError } from "@/lib/server/errors";

interface RouteContext {
  params: Promise<{ token: string }>;
}

interface RescheduleRequestBody {
  startTime?: string;
  endTime?: string;
  /** Capacity path: target departure (defaults to the current session). */
  sessionId?: string;
  /** Capacity path: new guest count (defaults to the current quantity). */
  quantity?: unknown;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    let body: RescheduleRequestBody | null = null;
    try {
      body = (await request.json()) as RescheduleRequestBody;
    } catch {
      throw new ApiError(400, "VALIDATION", "Please choose a new time.");
    }

    const { token } = await params;

    // Capacity bookings (session move and/or guest-count change) carry
    // sessionId and/or quantity instead of start/end times.
    if (typeof body?.sessionId === "string" || body?.quantity !== undefined) {
      const booking = await rescheduleCapacityBooking(decodeURIComponent(token), {
        sessionId: typeof body?.sessionId === "string" ? body.sessionId : undefined,
        quantity: body?.quantity as number | undefined,
      });
      return NextResponse.json({ booking });
    }

    if (!body?.startTime) {
      throw new ApiError(400, "VALIDATION", "Please choose a new time.");
    }

    const booking = await rescheduleBooking(
      decodeURIComponent(token),
      body.startTime,
      typeof body.endTime === "string" ? body.endTime : undefined,
    );
    return NextResponse.json({ booking });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}