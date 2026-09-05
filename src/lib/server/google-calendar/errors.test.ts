import { describe, it, expect } from "vitest";
import {
  classifyCalendarError,
  CalendarIntegrationError,
} from "./errors";

describe("classifyCalendarError", () => {
  it("maps revoked/invalid credentials to AUTH_REQUIRED", () => {
    expect(
      classifyCalendarError({ code: 400, message: "invalid_grant" }),
    ).toBe("CALENDAR_AUTH_REQUIRED");
    expect(
      classifyCalendarError({ code: 401, message: "Request had invalid authentication credentials" }),
    ).toBe("CALENDAR_AUTH_REQUIRED");
    expect(
      classifyCalendarError(new Error("token_expired")),
    ).toBe("CALENDAR_AUTH_REQUIRED");
  });

  it("maps HTTP statuses to the taxonomy", () => {
    expect(classifyCalendarError({ code: 404 })).toBe("CALENDAR_EVENT_NOT_FOUND");
    expect(classifyCalendarError({ code: 409 })).toBe("CALENDAR_CONFLICT");
    expect(classifyCalendarError({ code: 429 })).toBe("CALENDAR_UNAVAILABLE");
  });

  it("maps timeouts/network failures to UNAVAILABLE", () => {
    expect(classifyCalendarError(new Error("connect ETIMEDOUT"))).toBe(
      "CALENDAR_UNAVAILABLE",
    );
    expect(classifyCalendarError(new Error("socket hang up"))).toBe(
      "CALENDAR_UNAVAILABLE",
    );
  });

  it("falls back to SYNC_FAILED for unknown errors", () => {
    expect(classifyCalendarError(new Error("weird one"))).toBe(
      "CALENDAR_SYNC_FAILED",
    );
  });

  it("passes through an explicit CalendarIntegrationError", () => {
    const explicit = new CalendarIntegrationError(
      "CALENDAR_CONFLICT",
      "busy",
    );
    expect(classifyCalendarError(explicit)).toBe("CALENDAR_CONFLICT");
  });
});