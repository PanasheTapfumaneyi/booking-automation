import { NextRequest, NextResponse } from "next/server";
import { startConnect } from "@/lib/server/google-calendar/connections";
import { toApiErrorResponse } from "@/lib/server/route-helper";

/**
 * GET /api/integrations/google-calendar/connect?business=<businessId>
 *
 * Starts the OAuth flow for a business. The business id is validated and only
 * allowlisted businesses (MVP: the Fade District demo business) may connect.
 * Produces a signed, expiring state token that encodes the business id and is
 * verified in the callback (CSRF protection).
 */
export async function GET(request: NextRequest) {
  const resultUrl = (path: string) =>
    new URL(path, request.nextUrl.origin).toString();
  try {
    const businessId = request.nextUrl.searchParams.get("business");
    if (!businessId) {
      throw new Error("Missing business id.");
    }
    const url = await startConnect({ businessId });
    return NextResponse.redirect(url, 302);
  } catch (error) {
    console.error("[google-calendar] connect failed:", error);
    if (error instanceof Error && error.message === "Missing business id.") {
      return NextResponse.redirect(
        resultUrl("/integrations/google-calendar/result?status=error&reason=missing-business"),
        302,
      );
    }
    const apiError = toApiErrorResponse(error);
    const message =
      apiError.status === 403
        ? "not-allowed"
        : apiError.status === 404
          ? "business-not-found"
          : "config";
    return NextResponse.redirect(
      resultUrl(`/integrations/google-calendar/result?status=error&reason=${message}`),
      302,
    );
  }
}