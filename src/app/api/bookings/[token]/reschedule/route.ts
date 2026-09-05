import { NextResponse } from "next/server";
import { rescheduleBooking } from "@/lib/server/booking-service";
import { toApiErrorResponse } from "@/lib/server/route-helper";
import { ApiError } from "@/lib/server/errors";

interface RouteContext {
  params: Promise<{ token: string }>;
}

interface RescheduleRequestBody {
  startTime?: string;
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
    if (!body?.startTime) {
      throw new ApiError(400, "VALIDATION", "Please choose a new time.");
    }

    const booking = await rescheduleBooking(
      decodeURIComponent(token),
      body.startTime,
    );
    return NextResponse.json({ booking });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}