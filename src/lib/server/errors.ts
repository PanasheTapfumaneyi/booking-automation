export type ApiErrorCode =
  | "VALIDATION"
  | "SERVICE_NOT_FOUND"
  | "RESOURCE_NOT_FOUND"
  | "SESSION_NOT_FOUND"
  | "BOOKING_NOT_FOUND"
  | "BOOKING_CANCELLED"
  | "SLOT_UNAVAILABLE"
  | "CAPACITY_FULL"
  | "CALENDAR_NOT_CONNECTED"
  | "CALENDAR_AUTH_REQUIRED"
  | "CALENDAR_CONFLICT"
  | "CALENDAR_SYNC_FAILED"
  | "CALENDAR_UNAVAILABLE"
  | "CONFIG"
  | "INTERNAL";

/**
 * Error that carries an HTTP status and a safe, user-facing message.
 * Thrown by the service layer and translated into a JSON response by the
 * route handlers. Raw database / infrastructure errors never reach clients.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Raised when required environment configuration is missing. */
export class AppConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppConfigError";
  }
}