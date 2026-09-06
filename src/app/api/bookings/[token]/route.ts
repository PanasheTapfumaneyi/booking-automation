import { NextResponse } from "next/server";
import { getBookingByToken } from "@/lib/server/booking-service";
import { toApiErrorResponse } from "@/lib/server/route-helper";

// Sensitive per-token lookup — never statically cache this response.
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { token } = await params;
    const booking = await getBookingByToken(decodeURIComponent(token));
    return NextResponse.json({ booking });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}