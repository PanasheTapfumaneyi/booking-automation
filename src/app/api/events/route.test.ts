/**
 * /api/events marketing-stream tests.
 *
 * Pins the separation contract: marketing.* names land in
 * `marketing_events` (with derived source/device/browser and sanitized
 * props), booking-funnel names still land in `operations_events`, and
 * unknown names are rejected.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "./route";

type Row = Record<string, unknown>;

const inserts: Record<string, Row[]> = {};

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({
    from: (table: string) => ({
      insert: (row: Row) => {
        (inserts[table] ??= []).push(row);
        return { error: null };
      },
    }),
  }),
}));

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function post(body: unknown, userAgent = CHROME_UA) {
  return POST(
    new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", "user-agent": userAgent },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  for (const key of Object.keys(inserts)) delete inserts[key];
  process.env.NEXT_PUBLIC_SITE_URL = "https://kivo.mu";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe("marketing stream", () => {
  it("stores page views with derived source, device, browser", async () => {
    const res = await post({
      kind: "marketing",
      eventName: "marketing_page_viewed",
      sessionId: "sess-abc",
      pathname: "/?utm_source=x",
      referrer: "https://www.instagram.com/p/123",
      utmSource: "instagram",
      utmMedium: "cpc",
      metadata: {},
    });
    expect(res.status).toBe(200);
    expect(inserts.operations_events ?? []).toHaveLength(0);
    expect(inserts.marketing_events).toHaveLength(1);
    expect(inserts.marketing_events[0]).toMatchObject({
      event_name: "marketing_page_viewed",
      session_id: "sess-abc",
      pathname: "/",
      utm_source: "instagram",
      source: "instagram",
      device: "desktop",
      browser: "chrome",
    });
    // Full referrer URL is never stored — host only.
    expect(inserts.marketing_events[0].referrer).toBe("www.instagram.com");
  });

  it("derives mobile and direct honestly", async () => {
    const res = await post(
      {
        kind: "marketing",
        eventName: "start_free_clicked",
        sessionId: "sess-m",
        pathname: "/",
        metadata: { cta_location: "hero" },
      },
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148",
    );
    expect(res.status).toBe(200);
    expect(inserts.marketing_events[0]).toMatchObject({
      device: "mobile",
      source: "direct",
    });
  });

  it("strips PII and token-shaped values from properties", async () => {
    const res = await post({
      kind: "marketing",
      eventName: "contact_clicked",
      sessionId: "sess-p",
      pathname: "/",
      metadata: {
        contact_type: "whatsapp",
        cta_location: "pricing",
        phone: "+23057123456",
        manage_token: "tok-secret-value-1234567890abcdef",
      },
    });
    expect(res.status).toBe(200);
    expect(inserts.marketing_events[0].metadata).toEqual({
      contact_type: "whatsapp",
      cta_location: "pricing",
    });
  });

  it("scrubs manage-token paths", async () => {
    const res = await post({
      kind: "marketing",
      eventName: "marketing_page_viewed",
      sessionId: "sess-x",
      pathname: "/manage/9f3a2b1c4d5e6f7a",
      metadata: {},
    });
    expect(res.status).toBe(200);
    expect(inserts.marketing_events[0].pathname).toBe("/manage");
  });

  it("rejects unknown marketing names", async () => {
    const res = await post({
      kind: "marketing",
      eventName: "booking_started",
      sessionId: "sess-x",
      metadata: {},
    });
    expect(res.status).toBe(400);
    expect(inserts.marketing_events ?? []).toHaveLength(0);
  });

  it("rejects missing session ids", async () => {
    const res = await post({
      kind: "marketing",
      eventName: "marketing_page_viewed",
      metadata: {},
    });
    expect(res.status).toBe(400);
  });
});

describe("booking stream (unchanged)", () => {
  it("still routes booking events to operations_events", async () => {
    const res = await post({
      eventName: "booking_started",
      businessId: "biz-1",
      attemptId: "attempt_1",
      metadata: {},
    });
    expect(res.status).toBe(200);
    expect(inserts.operations_events).toHaveLength(1);
    expect(inserts.marketing_events ?? []).toHaveLength(0);
  });
});
