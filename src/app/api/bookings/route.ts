import { NextResponse } from "next/server";
import type { NewBookingInput } from "@/types/booking";
import { createBooking } from "@/lib/server/booking-service";
import { toApiErrorResponse } from "@/lib/server/route-helper";
import { ApiError } from "@/lib/server/errors";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "VALIDATION", "Please provide booking details.");
    }

    if (!body || typeof body !== "object") {
      throw new ApiError(400, "VALIDATION", "Please provide booking details.");
    }

    const result = await createBooking(body as NewBookingInput);
    return NextResponse.json(
      { booking: result.booking, notifications: result.notifications },
      { status: 201 },
    );
  } catch (error) {
    return toApiErrorResponse(error);
  }
}