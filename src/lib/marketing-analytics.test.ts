/**
 * Marketing analytics client tests.
 *
 * Verifies payload shape, taxonomy gating, sanitization, environment
 * gating, session persistence, and — critically — that analytics can
 * never throw or block the product.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

function localStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    _dump: () => store,
  };
}

const storage = localStorageMock();
const sendBeaconMock = vi.fn();

function installBrowser(hostname = "kivo.mu", search = ""): void {
  vi.stubGlobal("window", {
    location: { hostname, pathname: "/test-page", search },
    localStorage: storage,
  });
  vi.stubGlobal("document", { referrer: "https://www.google.com/search?q=kivo" });
  vi.stubGlobal("navigator", { sendBeacon: sendBeaconMock });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
}

async function sentJson(): Promise<Record<string, unknown> | null> {
  if (sendBeaconMock.mock.calls.length === 0) return null;
  const [, blob] = sendBeaconMock.mock.calls[0] as [string, Blob];
  return JSON.parse(await blob.text()) as Record<string, unknown>;
}

import {
  getMarketingSession,
  isMarketingAnalyticsEnabled,
  trackMarketingEvent,
} from "./marketing-analytics";

beforeEach(() => {
  storage.clear();
  sendBeaconMock.mockReset().mockReturnValue(true);
  installBrowser();
  process.env.NEXT_PUBLIC_SITE_URL = "https://kivo.mu";
  delete process.env.NEXT_PUBLIC_ANALYTICS_ENABLED;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_ANALYTICS_ENABLED;
});

describe("trackMarketingEvent", () => {
  it("sends start_free with location and session context", async () => {
    trackMarketingEvent("start_free_clicked", {
      cta_location: "hero",
      cta_label: "Start free for 1 month",
    });
    const body = await sentJson();
    expect(body).toMatchObject({
      kind: "marketing",
      eventName: "start_free_clicked",
      pathname: "/test-page",
    });
    expect(typeof body?.sessionId).toBe("string");
    expect(body?.metadata).toEqual({
      cta_location: "hero",
      cta_label: "Start free for 1 month",
    });
  });

  it("attaches first-touch UTM and referrer", async () => {
    installBrowser("kivo.mu", "?utm_source=instagram&utm_medium=cpc");
    trackMarketingEvent("marketing_page_viewed", {});
    const body = await sentJson();
    expect(body).toMatchObject({
      utmSource: "instagram",
      utmMedium: "cpc",
      referrer: "https://www.google.com/search?q=kivo",
    });
  });

  it("emits featured-business properties intact", async () => {
    trackMarketingEvent("featured_business_clicked", {
      business_slug: "island-surf",
      category: "surf-rental",
      booking_mode: "resource",
      action: "book_now",
    });
    const body = await sentJson();
    expect(body?.metadata).toEqual({
      business_slug: "island-surf",
      category: "surf-rental",
      booking_mode: "resource",
      action: "book_now",
    });
  });

  it("drops non-taxonomy event names", () => {
    trackMarketingEvent("booking_started", {});
    trackMarketingEvent("anything_at_all", {});
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });

  it("strips sensitive properties before sending", async () => {
    trackMarketingEvent("contact_clicked", {
      contact_type: "whatsapp",
      cta_location: "pricing",
      phone: "+23057123456",
      manage_token: "tok-secret",
    });
    const body = await sentJson();
    expect(body?.metadata).toEqual({
      contact_type: "whatsapp",
      cta_location: "pricing",
    });
  });

  it("reuses one session id across calls", async () => {
    trackMarketingEvent("marketing_page_viewed", {});
    const first = await sentJson();
    sendBeaconMock.mockClear();
    trackMarketingEvent("start_free_clicked", { cta_location: "hero" });
    const second = await sentJson();
    expect(second?.sessionId).toBe(first?.sessionId);
  });
});

describe("environment gating", () => {
  it("never sends on localhost", () => {
    installBrowser("localhost", "");
    trackMarketingEvent("start_free_clicked", { cta_location: "hero" });
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });

  it("honours an explicit opt-out", () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "false";
    expect(isMarketingAnalyticsEnabled()).toBe(false);
    trackMarketingEvent("start_free_clicked", { cta_location: "hero" });
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });

  it("sends on the production host", () => {
    expect(isMarketingAnalyticsEnabled()).toBe(true);
  });

  it("stays silent on preview hosts unless overridden", () => {
    installBrowser("booking-automation-abc123.vercel.app", "");
    expect(isMarketingAnalyticsEnabled()).toBe(false);
    trackMarketingEvent("start_free_clicked", { cta_location: "hero" });
    expect(sendBeaconMock).not.toHaveBeenCalled();
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "true";
    expect(isMarketingAnalyticsEnabled()).toBe(true);
  });
});

describe("failure safety", () => {
  it("never throws when sendBeacon throws", () => {
    sendBeaconMock.mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() =>
      trackMarketingEvent("start_free_clicked", { cta_location: "hero" }),
    ).not.toThrow();
  });

  it("falls back to keepalive fetch without sendBeacon", () => {
    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", fetchMock);
    trackMarketingEvent("start_free_clicked", { cta_location: "hero" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchMock.mock.calls[0][0]).toBe("/api/events");
    expect(init.keepalive).toBe(true);
    expect(init.method).toBe("POST");
  });

  it("never throws without a browser", () => {
    vi.unstubAllGlobals();
    expect(() => trackMarketingEvent("start_free_clicked", {})).not.toThrow();
    expect(() => getMarketingSession()).not.toThrow();
  });
});

describe("getMarketingSession", () => {
  it("rotates the session after 30 minutes of inactivity", () => {
    const first = getMarketingSession();
    expect(first).not.toBeNull();
    const stored = JSON.parse(storage._dump()["kivo_mkt_session"] as string) as {
      lastSeen: number;
    };
    stored.lastSeen = Date.now() - 31 * 60 * 1000;
    storage.setItem("kivo_mkt_session", JSON.stringify({ ...first, lastSeen: stored.lastSeen }));
    const second = getMarketingSession();
    expect(second?.id).not.toBe(first?.id);
  });
});
