/**
 * Demo safety tests (Phase 7 hardening).
 *
 * Demo state is an explicit server-side `businesses.is_demo` boolean,
 * resolved via `isDemoBusiness()` — never from client input and never
 * from UUID prefixes.
 */
import { describe, it, expect, vi } from "vitest";
import { isDemoBusiness } from "@/lib/server/demo";

describe("isDemoBusiness — explicit server-side flag", () => {
  it("returns true only for literal is_demo === true", () => {
    expect(isDemoBusiness({ id: "a", is_demo: true })).toBe(true);
    expect(isDemoBusiness({ id: "a", is_demo: false })).toBe(false);
  });

  it("treats missing/null flags as production", () => {
    expect(isDemoBusiness({ id: "a" })).toBe(false);
    expect(isDemoBusiness({ id: "a", is_demo: null })).toBe(false);
  });

  it("ignores the business id entirely (no UUID-prefix sniffing)", () => {
    expect(
      isDemoBusiness({ id: "10000000-0000-4000-8000-000000000001", is_demo: false }),
    ).toBe(false);
    expect(
      isDemoBusiness({ id: "00000000-0000-4000-8000-000000000001", is_demo: true }),
    ).toBe(true);
  });
});

describe("demo safety — notification suppression", () => {
  it("dispatchBookingEvent returns noop for is_demo businesses", async () => {
    const { dispatchBookingEvent } = await import(
      "@/lib/server/notifications/service"
    );

    const result = await dispatchBookingEvent({
      type: "booking.created",
      business: {
        id: "10000000-0000-4000-8000-000000000001",
        name: "Fade Area",
        timezone: "Indian/Mauritius",
        is_demo: true,
      },
      serviceName: "Haircut",
      booking: {
        id: "booking-demo",
        start_time: "2026-10-01T09:00:00.000Z",
        end_time: "2026-10-01T09:45:00.000Z",
        manage_token: "demo-token",
      },
      customer: { name: "Test", phone: "+23000000000" },
    });

    expect(result.dispatched).toBe(false);
  });

  it("production dispatch is unaffected by demo suppression", async () => {
    const { dispatchBookingEvent } = await import(
      "@/lib/server/notifications/service"
    );

    const result = await dispatchBookingEvent({
      type: "booking.created",
      business: {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Fade District",
        timezone: "Indian/Mauritius",
        is_demo: false,
      },
      serviceName: "Haircut",
      booking: {
        id: "booking-prod",
        start_time: "2026-10-01T09:00:00.000Z",
        end_time: "2026-10-01T09:45:00.000Z",
        manage_token: "prod-token",
      },
      customer: { name: "Test", phone: "+23000000000" },
    });

    // With NOTIFICATION_PROVIDER=none (default in test env), returns noop
    expect(result.dispatched).toBe(false);
  });
});

describe("demo safety — calendar sync", () => {
  it("syncAfterCreate returns not_connected for is_demo businesses", async () => {
    const { syncAfterCreate } = await import(
      "@/lib/server/google-calendar/sync"
    );

    const result = await syncAfterCreate({
      business: {
        id: "10000000-0000-4000-8000-000000000001",
        name: "Fade Area",
        phone: "+23057111111",
        email: "demo@fadearea.mu",
        timezone: "Indian/Mauritius",
        booking_mode: "appointment",
        calendar_id: null,
        slug: "fade-area",
        is_demo: true,
        is_active: true,
        availability: null,
        tagline: null,
        description: null,
        cover_image_url: null,
        logo_url: null,
        theme_config: null,
        address: null,
        latitude: null,
        longitude: null,
        created_at: "2026-10-01T00:00:00.000Z",
        updated_at: "2026-10-01T00:00:00.000Z",
      },
      service: {
        id: "svc-demo",
        business_id: "10000000-0000-4000-8000-000000000001",
        name: "Haircut",
        description: null,
        duration_minutes: 45,
        price: 450,
        image_url: null,
        active: true,
        created_at: "2026-10-01T00:00:00.000Z",
        updated_at: "2026-10-01T00:00:00.000Z",
      },
      row: {
        id: "booking-demo",
        business_id: "10000000-0000-4000-8000-000000000001",
        service_id: "svc-demo",
        customer_id: "cust-demo",
        resource_id: null,
        session_id: null,
        quantity: 1,
        start_time: "2026-10-01T09:00:00.000Z",
        end_time: "2026-10-01T09:45:00.000Z",
        status: "confirmed",
        google_event_id: null,
        manage_token: "demo-token",
        previous_start_time: null,
        created_at: "2026-10-01T00:00:00.000Z",
        updated_at: "2026-10-01T00:00:00.000Z",
      },
      customerName: "Test",
      customerPhone: "+23000000000",
      db: { from: vi.fn() } as never,
    });

    expect(result.status).toBe("not_connected");
  });
});
