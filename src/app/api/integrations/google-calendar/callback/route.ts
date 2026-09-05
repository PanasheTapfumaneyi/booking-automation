import { NextRequest, NextResponse } from "next/server";
import { completeConnection } from "@/lib/server/google-calendar/connections";
import { toApiErrorResponse } from "@/lib/server/route-helper";

/**
 * GET /api/integrations/google-calendar/callback?code=...&state=...
 *
 * OAuth redirect target. Validates the signed state (CSRF), exchanges the
 * code for tokens, stores the connection, then redirects to a simple result
 * page. Never echoes tokens or codes anywhere in URLs or responses.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const denied = request.nextUrl.searchParams.get("error");

  if (denied) {
    return NextResponse.redirect(
      "/integrations/google-calendar/result?status=error&reason=denied",
      302,
    );
  }

  try {
    const outcome = await completeConnection({ code, state });
    if (outcome.status === "denied") {
      return NextResponse.redirect(
        "/integrations/google-calendar/result?status=error&reason=denied",
        302,
      );
    }
    return NextResponse.redirect(
      `/integrations/google-calendar/result?status=success&business=${encodeURIComponent(outcome.businessId)}`,
      302,
    );
  } catch (error) {
    const apiError = toApiErrorResponse(error);
    const reason =
      apiError.status === 400 ? "invalid-state" : "exchange-failed";
    console.error("[google-calendar] callback failed:", error);
    return NextResponse.redirect(
      `/integrations/google-calendar/result?status=error&reason=${reason}`,
      302,
    );
  }
}