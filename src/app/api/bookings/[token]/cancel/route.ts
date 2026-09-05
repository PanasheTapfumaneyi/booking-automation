import { NextResponse } from "next/server";
import { cancelBooking } from "@/lib/server/booking-service";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { token } = await params;
    const booking = await cancelBooking(decodeURIComponent(token));
    return NextResponse.json({ booking });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}