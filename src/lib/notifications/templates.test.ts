import { describe, it, expect } from "vitest";
import {
  buildCustomerMessage,
  buildBusinessMessage,
  buildReminderMessage,
  type TemplateContext,
} from "./templates";

const BASE: TemplateContext = {
  businessName: "Fade District",
  businessTimezone: "Indian/Mauritius",
  serviceName: "Haircut + Beard",
  customerName: "Jean-Marc",
  customerPhone: "+23057123456",
  // Local Monday 2026-09-07 14:00 in Indian/Mauritius (UTC+4).
  startIso: "2026-09-07T10:00:00.000Z",
  endIso: "2026-09-07T11:00:00.000Z",
  manageUrl: "http://localhost:3000/manage/abc123",
};

describe("evergreen template guarantees", () => {
  it.each(["booking.created", "booking.rescheduled", "booking.cancelled"] as const)(
    "renders %s using the business name, never a hardcoded brand",
    (type) => {
      const customer = buildCustomerMessage(type, BASE);
      const business = buildBusinessMessage(type, BASE);
      expect(customer).toContain("Fade District");
      expect(business).toContain("Fade District");
      expect(customer).not.toContain("barbershop");
      expect(business).not.toContain("barbershop");
    },
  );

  it.each(["booking.created", "booking.rescheduled", "booking.cancelled"] as const)(
    "renders times in the BUSINESS timezone (Mauritius local)",
    (type) => {
      const customer = buildCustomerMessage(type, BASE);
      expect(customer).toContain("Monday, 7 September");
      expect(customer).toContain("14:00");
    },
  );
});

describe("customer messages", () => {
  it("created confirms the slot with a /manage link", () => {
    const message = buildCustomerMessage("booking.created", BASE);
    expect(message).toContain("appointment confirmed");
    expect(message).toContain("Haircut + Beard");
    expect(message).toContain(BASE.manageUrl as string);
    expect(message).toContain("Jean-Marc");
  });

  it("created includes a calendar URL", () => {
    const message = buildCustomerMessage("booking.created", {
      ...BASE,
      calendarUrl: "http://localhost:3000/api/bookings/abc123/calendar",
    });
    expect(message).toContain("Add to your calendar");
    expect(message).toContain("http://localhost:3000/api/bookings/abc123/calendar");
  });

  it("rescheduled shows the new time and the previous time", () => {
    const message = buildCustomerMessage("booking.rescheduled", {
      ...BASE,
      previousStartIso: "2026-09-05T10:00:00.000Z", // local Saturday 14:00
    });
    expect(message).toContain("has moved to Monday, 7 September at 14:00");
    expect(message).toContain("Saturday, 5 September at 14:00");
    expect(message).toContain(BASE.manageUrl as string);
  });

  it("rescheduled includes a calendar URL", () => {
    const message = buildCustomerMessage("booking.rescheduled", {
      ...BASE,
      previousStartIso: "2026-09-05T10:00:00.000Z",
      calendarUrl: "http://localhost:3000/api/bookings/abc123/calendar",
    });
    expect(message).toContain("Add to your calendar");
    expect(message).toContain("http://localhost:3000/api/bookings/abc123/calendar");
  });

  it("cancelled confirms the cancellation and still links back", () => {
    const message = buildCustomerMessage("booking.cancelled", BASE);
    expect(message).toContain("has been cancelled");
    expect(message).toContain("Monday, 7 September at 14:00");
    expect(message).toContain("Need to rebook?");
  });
});

describe("business messages", () => {
  it("never leaks the manage URL/token or calendar URL", () => {
    for (const type of [
      "booking.created",
      "booking.rescheduled",
      "booking.cancelled",
    ] as const) {
      const message = buildBusinessMessage(type, {
        ...BASE,
        calendarUrl: "http://localhost:3000/api/bookings/abc123/calendar",
      });
      expect(message).not.toContain("manage");
      expect(message).not.toContain("abc123");
      expect(message).not.toContain("http://");
      expect(message).not.toContain("calendar");
    }
  });

  it("never leaks booking/customer Supabase ids", () => {
    const message = buildBusinessMessage("booking.created", BASE);
    expect(message).not.toContain("supabase");
    expect(message).not.toContain("00000000-0000-4000-8000");
  });

  it("created reports the new booking with the customer phone", () => {
    const message = buildBusinessMessage("booking.created", BASE);
    expect(message).toContain("New booking");
    expect(message).toContain("Jean-Marc · +23057123456");
  });

  it("rescheduled reports the move", () => {
    const message = buildBusinessMessage("booking.rescheduled", {
      ...BASE,
      previousStartIso: "2026-09-05T10:00:00.000Z",
    });
    expect(message).toContain("moved from");
    expect(message).toContain("New: Monday, 7 September at 14:00");
  });

  it("cancelled reports the cancellation", () => {
    const message = buildBusinessMessage("booking.cancelled", BASE);
    expect(message).toContain("Cancellation");
    expect(message).toContain("cancelled");
  });
});

describe("reminder messages (Phase 5 — customer only)", () => {
  it("24h reminder names the service, the business-local time, and the manage link", () => {
    const message = buildReminderMessage("booking.reminder.24h", {
      ...BASE,
      calendarUrl: "http://localhost:3000/api/bookings/abc123/calendar",
    });
    expect(message).toContain("appointment reminder");
    expect(message).toContain("Fade District");
    expect(message).toContain("Haircut + Beard");
    expect(message).toContain("tomorrow");
    expect(message).toContain("Monday, 7 September at 14:00");
    expect(message).toContain(BASE.manageUrl as string);
    expect(message).toContain("Jean-Marc");
    expect(message).not.toContain("calendar");
  });

  it("2h reminder carries the 2-hour intent with the same guarantees", () => {
    const message = buildReminderMessage("booking.reminder.2h", {
      ...BASE,
      calendarUrl: "http://localhost:3000/api/bookings/abc123/calendar",
    });
    expect(message).toContain("appointment reminder");
    expect(message).toContain("in about 2 hours");
    expect(message).toContain("Monday, 7 September at 14:00");
    expect(message).toContain(BASE.manageUrl as string);
    expect(message).not.toContain("barbershop");
    expect(message).not.toContain("calendar");
  });
});