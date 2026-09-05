import { NextRequest, NextResponse } from "next/server";
import { getConnectionStatus } from "@/lib/server/google-calendar/connections";
import { toApiErrorResponse } from "@/lib/server/route-helper";

/**
 * GET /api/integrations/google-calendar/status?business=<businessId>
 *
 * Safe read-only status. Response contains no tokens — only connection state,
 * the calendar id and the account email (when present). A revoked credential
 * is surfaced as requiresReconnect.
 */
export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get("business");
    if (!businessId) {
      return NextResponse.json({ error: "Missing business id." }, { status: 400 });
    }
    const status = await getConnectionStatus(businessId);
    return NextResponse.json(status);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}