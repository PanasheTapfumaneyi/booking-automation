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
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL",
        userMessage:
          "Something went wrong on our side. Please try again in a moment.",
      },
    },
    { status: 500 },
  );
}