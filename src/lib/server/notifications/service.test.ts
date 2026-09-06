import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { dispatchBookingEvent, checkNotificationHealth } from "./service";
import { createNotificationMemoryDb, asSupabase } from "./test-helpers";
import { resetNotificationProviderForTests } from "./providers";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetNotificationProviderForTests();
});

function asDb(db: ReturnType<typeof createNotificationMemoryDb>) {
  return asSupabase(db) as import("@supabase/supabase-js").SupabaseClient;
}

describe("dispatchBookingEvent", () => {
  beforeEach(() => {
    vi.stubEnv("NOTIFICATION_PROVIDER", "mock");
  });

  it("sends a customer notification and skips business when phone is absent", async () => {
    const db = createNotificationMemoryDb();
    const summary = await dispatchBookingEvent({
      business: { id: "biz-1", name: "Fade District", timezone: "Indian/Mauritius" },
      serviceName: "Haircut",
      booking: { id: "b1", start_time: "2026-09-07T10:00:00.000Z", end_time: "2026-09-07T11:00:00.000Z", manage_token: "tok-1" },
      customer: { name: "Jean-Marc", phone: "+23057123456" },
      type: "booking.created",
      eventId: "evt-test-1",
      db: asDb(db),
    });
    expect(summary.dispatched).toBe(true);
    expect(summary.recipients.customer).toBe("sent");
    expect(summary.recipients.business).toBe("skipped");
    expect(db.tables.notifications).toHaveLength(1); // only customer row created
  });

  it("skips both recipients when all notifications are disabled", async () => {
    const db = createNotificationMemoryDb();
    db.tables.business_notification_settings.push({
      business_id: "biz-1",
      customer_notifications_enabled: false,
      business_notifications_enabled: false,
      whatsapp_enabled: false,
      business_notification_phone: null,
    });
    const summary = await dispatchBookingEvent({
      business: { id: "biz-1", name: "Fade District", timezone: "Indian/Mauritius" },
      serviceName: "Haircut",
      booking: { id: "b1", start_time: "2026-09-07T10:00:00.000Z", end_time: "2026-09-07T11:00:00.000Z", manage_token: "tok-1" },
      customer: { name: "Jean-Marc", phone: "+23057123456" },
      type: "booking.created",
      eventId: "evt-test-2",
      db: asDb(db),
    });
    expect(summary.dispatched).toBe(true);
    expect(summary.recipients.customer).toBe("skipped");
    expect(summary.recipients.business).toBe("skipped");
    expect(db.tables.notifications).toHaveLength(0);
  });

  it("is idempotent: a second call with the same eventId returns the first outcome", async () => {
    const db = createNotificationMemoryDb();
    const input = {
      business: { id: "biz-1", name: "Fade District", timezone: "Indian/Mauritius" },
      serviceName: "Haircut",
      booking: { id: "b1", start_time: "2026-09-07T10:00:00.000Z", end_time: "2026-09-07T11:00:00.000Z", manage_token: "tok-1" },
      customer: { name: "Jean-Marc", phone: "+23057123456" },
      type: "booking.created" as const,
      eventId: "evt-idempotent",
    };
    const first = await dispatchBookingEvent({ ...input, db: asDb(db) });
    expect(first.recipients.customer).toBe("sent");

    const second = await dispatchBookingEvent({ ...input, db: asDb(db) });
    expect(second.recipients.customer).toBe("sent");
    expect(db.tables.notifications).toHaveLength(1); // same customer row, not duplicated
  });

  it("never throws when the provider is misconfigured (failure isolation)", async () => {
    vi.stubEnv("NOTIFICATION_PROVIDER", "openwa");
    vi.stubEnv("OPENWA_API_KEY", ""); // missing key → OPENWA_AUTH_FAILED inside provider
    const db = createNotificationMemoryDb();
    const fn = () =>
      dispatchBookingEvent({
        business: { id: "biz-1", name: "Fade District", timezone: "Indian/Mauritius" },
        serviceName: "Haircut",
        booking: { id: "b1", start_time: "2026-09-07T10:00:00.000Z", end_time: "2026-09-07T11:00:00.000Z", manage_token: "tok-1" },
        customer: { name: "Jean-Marc", phone: "+23057123456" },
        type: "booking.created",
        eventId: "evt-auth-fail",
        db: asDb(db),
      });
    await expect(fn()).resolves.toBeDefined();
    const summary = await fn();
    expect(summary.recipients.customer).toBe("failed");
  });

  it("marks destination INVALID_PHONE when the phone cannot normalize", async () => {
    const db = createNotificationMemoryDb();
    const summary = await dispatchBookingEvent({
      business: { id: "biz-1", name: "Fade District", timezone: "Indian/Mauritius" },
      serviceName: "Haircut",
      booking: { id: "b1", start_time: "2026-09-07T10:00:00.000Z", end_time: "2026-09-07T11:00:00.000Z", manage_token: "tok-1" },
      customer: { name: "Jean-Marc", phone: "12345" },
      type: "booking.created",
      eventId: "evt-invalid",
      db: asDb(db),
    });
    expect(summary.recipients.customer).toBe("failed");
    const row = db.tables.notifications[0] as Record<string, unknown>;
    expect(row.status).toBe("failed");
    expect(row.error_code).toBe("INVALID_PHONE");
  });

  it("sends both customer and business when a phone is configured", async () => {
    const db = createNotificationMemoryDb();
    db.tables.business_notification_settings.push({
      business_id: "biz-1",
      customer_notifications_enabled: true,
      business_notifications_enabled: true,
      whatsapp_enabled: true,
      business_notification_phone: "+23057001234",
    });
    const summary = await dispatchBookingEvent({
      business: { id: "biz-1", name: "Fade District", timezone: "Indian/Mauritius" },
      serviceName: "Haircut",
      booking: { id: "b1", start_time: "2026-09-07T10:00:00.000Z", end_time: "2026-09-07T11:00:00.000Z", manage_token: "tok-1" },
      customer: { name: "Jean-Marc", phone: "+23057123456" },
      type: "booking.created",
      eventId: "evt-both",
      db: asDb(db),
    });
    expect(summary.recipients.customer).toBe("sent");
    expect(summary.recipients.business).toBe("sent");
    expect(db.tables.notifications).toHaveLength(2);
  });

  it("populates metadata.previousStart on reschedule events", async () => {
    const db = createNotificationMemoryDb();
    const summary = await dispatchBookingEvent({
      business: { id: "biz-1", name: "Fade District", timezone: "Indian/Mauritius" },
      serviceName: "Haircut",
      booking: { id: "b1", start_time: "2026-09-08T10:00:00.000Z", end_time: "2026-09-08T11:00:00.000Z", manage_token: "tok-1" },
      customer: { name: "Jean-Marc", phone: "+23057123456" },
      type: "booking.rescheduled",
      previous: { startTime: "2026-09-07T10:00:00.000Z", endTime: "2026-09-07T11:00:00.000Z" },
      eventId: "evt-resched",
      db: asDb(db),
    });
    expect(summary.recipients.customer).toBe("sent");
    const row = db.tables.notifications.find(
      (r) => (r as Record<string, unknown>).recipient_type === "customer",
    ) as Record<string, unknown>;
    const meta = row.metadata as Record<string, unknown>;
    expect(meta.previousStart).toBe("2026-09-07T10:00:00.000Z");
  });
});

describe("checkNotificationHealth", () => {
  it("returns mock config and healthy state when NOTIFICATION_PROVIDER=mock", async () => {
    vi.stubEnv("NOTIFICATION_PROVIDER", "mock");
    const health = await checkNotificationHealth();
    expect(health.provider).toBe("mock");
    expect(health.configured).toBe(true);
    expect(health.reachable).toBe(true);
    expect(health.sessionReady).toBe(true);
  });

  it("reports not configured when NOTIFICATION_PROVIDER is empty", async () => {
    vi.stubEnv("NOTIFICATION_PROVIDER", "");
    const health = await checkNotificationHealth();
    expect(health.provider).toBe("none");
    expect(health.configured).toBe(false);
  });
});