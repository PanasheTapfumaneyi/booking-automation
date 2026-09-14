import { NextResponse } from "next/server";
import { ApiError, AppConfigError } from "@/lib/server/errors";

/**
 * Translates any error thrown by the service layer into a structured JSON
 * response. Only safe, user-facing messages are included; raw database or
 * infrastructure errors are logged server-side and never sent to clients.
 */
export function toApiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, userMessage: error.message } },
      { status: error.status },
    );
  }

  if (error instanceof AppConfigError) {
    console.error("[config]", error.message);
    return NextResponse.json(
      {
        error: {
          code: "CONFIG",
          userMessage:
            "The booking system isn't fully set up yet. Please contact the business.",
        },
      },
      { status: 500 },
    );
  }

  console.error("[api] unexpected error:", error);
  // Development-only diagnostic category so a failing catalog/slot call
  // can be attributed (public resolution vs service query vs booked-count
  // vs schema drift) without exposing anything to production clients.
  // PostgREST errors carry message/details/hint/code — never credentials —
  // and this branch never runs when NODE_ENV is production.
  const devDetail =
    process.env.NODE_ENV === "production"
      ? undefined
      : error instanceof Error
        ? {
            devKind: "Error",
            devMessage: error.message,
          }
        : typeof error === "object" && error !== null
          ? {
              devKind: "PostgrestLike",
              devMessage:
                (error as { message?: unknown }).message != null
                  ? String((error as { message?: unknown }).message)
                  : undefined,
              devDetails: (error as { details?: unknown }).details,
              devHint: (error as { hint?: unknown }).hint,
              devCode: (error as { code?: unknown }).code,
            }
          : undefined;
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL",
        userMessage:
          "Something went wrong on our side. Please try again in a moment.",
        ...(devDetail ? { dev: devDetail } : {}),
      },
    },
    { status: 500 },
  );
}