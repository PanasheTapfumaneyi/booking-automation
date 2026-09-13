import { NextResponse } from "next/server";
import { getBookingByToken } from "@/lib/server/booking-service";
import { fetchBusiness } from "@/lib/server/database";
import { toApiErrorResponse } from "@/lib/server/route-helper";
import { generateIcsDownloadHeaders, googleCalendarUrl } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/calendar";
import { ApiError } from "@/lib/server/errors";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ token: string }>;
}

async function buildCalendarEvent(token: string): Promise<CalendarEvent> {
  const booking = await getBookingByToken(token);

  if (booking.status === "cancelled") {
    throw new ApiError(
      400,
      "BOOKING_CANCELLED",
      "This appointment has already been cancelled.",
    );
  }

  const business = await fetchBusiness(booking.businessId);

  return {
    businessName: business.name,
    serviceName: booking.serviceName,
    startTime: booking.startTime,
    endTime: booking.endTime,
    timezone: business.timezone,
    manageUrl: `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/manage/${token}`,
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { token } = await params;
    const event = await buildCalendarEvent(decodeURIComponent(token));
    const { filename, contentType, content } = generateIcsDownloadHeaders(event);

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { token } = await params;
    const event = await buildCalendarEvent(decodeURIComponent(token));
    const url = googleCalendarUrl(event);

    return NextResponse.json({ url });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
