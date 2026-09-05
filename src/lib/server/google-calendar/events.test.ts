import { describe, it, expect } from "vitest";
import {
  buildEventPayload,
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEventTime,
} from "./events";
import type { BusinessRow, ServiceRow } from "@/lib/server/database";
import { createFakeCalendarApi } from "./test-helpers";

const business = {
  id: "00000000-0000-4000-8000-000000000001",
  timezone: "Indian/Mauritius",
} as Pick<BusinessRow, "id" | "timezone">;

const service = { name: "Haircut + Beard", price: 700 } as Pick<
  ServiceRow,
  "name" | "price"
>;

describe("event payload", () => {
  const payload = buildEventPayload({
    business,
    service,
    bookingId: "booking-1",
    customerName: "John Doe",
    customerPhone: "+230 5000 1111",
    customerEmail: "john@example.com",
    startIso: "2026-09-16T05:00:00.000Z",
    endIso: "2026-09-16T06:00:00.000Z",
  });

  it("uses the booking's exact start/end instants", () => {
    expect(payload.start.dateTime).toBe("2026-09-16T05:00:00.000Z");
    expect(payload.end.dateTime).toBe("2026-09-16T06:00:00.000Z");
  });

  it("sets the business timezone on the event", () => {
    expect(payload.start.timeZone).toBe("Indian/Mauritius");
    expect(payload.end.timeZone).toBe("Indian/Mauritius");
  });

  it("does not contain the manage token", () => {
    const text = JSON.stringify(payload);
    expect(text).not.toMatch(/manageToken|manage_token|demo/);
  });

  it("embeds operational details and reconciliation ids", () => {
    expect(payload.summary).toBe("Haircut + Beard - John Doe");
    expect(payload.description).toContain("Service: Haircut + Beard");
    expect(payload.description).toContain("Customer: John Doe");
    expect(payload.description).toContain("Phone: +230 5000 1111");
    expect(payload.description).toContain("Email: john@example.com");
    expect(payload.description).toContain("Booking ID: booking-1");
    expect(payload.extendedProperties?.private.platform_booking_id).toBe(
      "booking-1",
    );
    expect(payload.extendedProperties?.private.platform_business_id).toBe(
      business.id,
    );
  });
});

describe("event operations (fake CalendarApi)", () => {
  it("creates an event and returns Google's event id", async () => {
    const { api, calls } = createFakeCalendarApi();
    const id = await createCalendarEvent(api, {
      calendarId: "primary",
      requestBody: buildEventPayload({
        business,
        service,
        bookingId: "booking-1",
        customerName: "John Doe",
        customerPhone: "+230",
        startIso: "2026-09-16T05:00:00.000Z",
        endIso: "2026-09-16T06:00:00.000Z",
      }),
    });
    expect(id).toBe("event-1");
    const inserted = calls.insert[0] as {
      calendarId: string;
      requestBody: { start: { dateTime: string } };
    };
    expect(inserted.calendarId).toBe("primary");
    expect(inserted.requestBody.start.dateTime).toBe("2026-09-16T05:00:00.000Z");
  });

  it("moves an event by patching start/end (same event id)", async () => {
    const { api, calls } = createFakeCalendarApi();
    await updateCalendarEventTime(api, {
      calendarId: "primary",
      eventId: "event-99",
      startIso: "2026-09-17T06:00:00.000Z",
      endIso: "2026-09-17T07:00:00.000Z",
      timeZone: "Indian/Mauritius",
    });
    const patched = calls.patch[0] as {
      eventId: string;
      requestBody: { start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string } };
    };
    expect(patched.eventId).toBe("event-99");
    expect(patched.requestBody.start.dateTime).toBe("2026-09-17T06:00:00.000Z");
    expect(patched.requestBody.end.dateTime).toBe("2026-09-17T07:00:00.000Z");
    expect(patched.requestBody.start.timeZone).toBe("Indian/Mauritius");
  });

  it("deletes an event", async () => {
    const { api } = createFakeCalendarApi();
    const result = await deleteCalendarEvent(api, {
      calendarId: "primary",
      eventId: "event-1",
    });
    expect(result).toBe("deleted");
  });

  it("treats a missing event as an idempotent, safe state", async () => {
    const { api } = createFakeCalendarApi({
      deleteThrows: { code: 404, message: "not_found" },
    });
    const result = await deleteCalendarEvent(api, {
      calendarId: "primary",
      eventId: "gone",
    });
    expect(result).toBe("not-found");
  });
});