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

describe("dispatchBookingEvent with the baileys provider", () => {
  beforeEach(() => {
    vi.stubEnv("NOTIFICATION_PROVIDER", "baileys");
    vi.stubEnv("BAILEYS_API_KEY", "test-key");
    vi.stubEnv("BAILEYS_BASE_URL", "http://localhost:8081");
  });

  function stubBaileysSuccess(fetchMock = vi.fn()) {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, messageId: "WA-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const baseInput = {
    business: { id: "biz-1", name: "Fade District", timezone: "Indian/Mauritius" },
    serviceName: "Haircut",
    booking: { id: "b1", start_time: "2026-09-07T10:00:00.000Z", end_time: "2026-09-07T11:00:00.000Z", manage_token: "tok-1" },
    customer: { name: "Jean-Marc", phone: "+23057123456" },
  };

  it.each(["booking.created", "booking.rescheduled", "booking.cancelled"] as const)(
    "dispatches %s via baileys and persists the provider message id",
    async (type) => {
      const fetchMock = stubBaileysSuccess();
      const db = createNotificationMemoryDb();
      const summary = await dispatchBookingEvent({
        ...baseInput,
        type,
        previous:
          type === "booking.rescheduled"
            ? { startTime: "2026-09-06T10:00:00.000Z", endTime: "2026-09-06T11:00:00.000Z" }
            : undefined,
        eventId: `evt-baileys-${type}`,
        db: asDb(db),
      });
      expect(summary.dispatched).toBe(true);
      expect(summary.recipients.customer).toBe("sent");
      const row = db.tables.notifications[0] as Record<string, unknown>;
      expect(row.provider).toBe("baileys");
      expect(row.provider_message_id).toBe("WA-1");
      expect(row.status).toBe("sent");
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );

  it("customer body keeps the manage link while business body never carries the token", async () => {
    const fetchMock = stubBaileysSuccess();
    const db = createNotificationMemoryDb();
    db.tables.business_notification_settings.push({
      business_id: "biz-1",
      customer_notifications_enabled: true,
      business_notifications_enabled: true,
      whatsapp_enabled: true,
      business_notification_phone: "+23057001234",
    });
    await dispatchBookingEvent({ ...baseInput, type: "booking.created", eventId: "evt-baileys-links", db: asDb(db) });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map(([, opts]) => JSON.parse((opts as RequestInit).body as string).text as string);
    expect(bodies).toHaveLength(2);
    const customerBody = bodies.find((b) => b.includes("/manage/")) ?? "";
    expect(customerBody).toContain("/manage/tok-1");
    // The business body must never embed the raw manage token.
    const businessBody = bodies.find((b) => !b.includes("/manage/")) ?? "";
    expect(businessBody).not.toContain("tok-1");
  });

  it("records BAILEYS_UNAVAILABLE without throwing when the service is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch failed")));
    const db = createNotificationMemoryDb();
    const input = { ...baseInput, type: "booking.created" as const };
    await expect(dispatchBookingEvent({ ...input, eventId: "evt-baileys-down", db: asDb(db) })).resolves.toBeDefined();
    const summary = await dispatchBookingEvent({ ...input, eventId: "evt-baileys-down-2", db: asDb(db) });
    expect(summary.recipients.customer).toBe("failed");
    const row = db.tables.notifications.find(
      (r) => (r as Record<string, unknown>).event_id === "evt-baileys-down-2",
    ) as Record<string, unknown>;
    expect(row.status).toBe("failed");
    expect(row.error_code).toBe("BAILEYS_UNAVAILABLE");
  });

  it("stays idempotent: one event produces one send", async () => {
    const fetchMock = stubBaileysSuccess();
    const db = createNotificationMemoryDb();
    const input = { ...baseInput, type: "booking.created" as const, eventId: "evt-baileys-idem" };
    await dispatchBookingEvent({ ...input, db: asDb(db) });
    const second = await dispatchBookingEvent({ ...input, db: asDb(db) });
    expect(second.recipients.customer).toBe("sent");
    expect(db.tables.notifications).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledOnce();
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

  it("delegates to the baileys provider when NOTIFICATION_PROVIDER=baileys", async () => {
    vi.stubEnv("NOTIFICATION_PROVIDER", "baileys");
    vi.stubEnv("BAILEYS_API_KEY", "test-key");
    vi.stubEnv("BAILEYS_BASE_URL", "http://localhost:8081");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ service: "baileys", connected: true, state: "connected" }),
      }),
    );
    const health = await checkNotificationHealth();
    expect(health).toEqual({ provider: "baileys", configured: true, reachable: true, sessionReady: true });
  });
});