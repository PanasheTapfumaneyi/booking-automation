/**
 * Marketing attribution + sanitization tests.
 *
 * Pins the privacy contract: taxonomy membership, PII/secret stripping,
 * token-URL scrubbing, and honest acquisition/device derivation (direct
 * and other instead of guesses).
 */
import { describe, it, expect } from "vitest";
import {
  MARKETING_EVENTS,
  deriveBrowser,
  deriveDevice,
  deriveSource,
  isMarketingEventName,
  sanitizeMarketingProps,
  scrubPathname,
} from "./marketing-attribution";

describe("taxonomy", () => {
  it("covers the full acquisition funnel", () => {
    for (const name of [
      "marketing_page_viewed",
      "featured_business_clicked",
      "pricing_viewed",
      "start_free_clicked",
      "see_how_it_works_clicked",
      "contact_clicked",
      "signup_started",
      "signup_completed",
      "business_details_submitted",
      "setup_choice_viewed",
      "managed_setup_selected",
      "self_setup_selected",
      "onboarding_completed",
      "temporary_business_page_viewed",
    ]) {
      expect(MARKETING_EVENTS).toContain(name);
      expect(isMarketingEventName(name)).toBe(true);
    }
  });

  it("rejects booking-funnel and unknown names", () => {
    expect(isMarketingEventName("booking_started")).toBe(false);
    expect(isMarketingEventName("start_free_click")).toBe(false);
    expect(isMarketingEventName(undefined)).toBe(false);
    expect(isMarketingEventName(42)).toBe(false);
  });
});

describe("sanitizeMarketingProps", () => {
  it("strips credential, token, and contact keys", () => {
    const out = sanitizeMarketingProps({
      cta_location: "hero",
      password: "secret",
      manage_token: "tok-abc",
      auth_token: "x",
      phone: "+23057123456",
      email: "a@b.c",
      customer_name: "Jean",
      api_key: "k",
    });
    expect(out).toEqual({ cta_location: "hero" });
  });

  it("matches blocked keys case-insensitively", () => {
    expect(sanitizeMarketingProps({ PHONE: "123", Email: "a@b" })).toEqual({});
  });

  it("drops token-shaped values regardless of key", () => {
    expect(
      sanitizeMarketingProps({
        business_slug: "island-surf",
        ref: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
        next: "/manage/9f3a2b1c4d5e6f7a8b9c0d1e2f3a4b5c",
      }),
    ).toEqual({ business_slug: "island-surf" });
  });

  it("keeps safe business properties", () => {
    expect(
      sanitizeMarketingProps({
        business_slug: "island-surf",
        category: "surf-rental",
        booking_mode: "resource",
        action: "book_now",
        cta_location: "pricing",
        contact_type: "whatsapp",
        setup_preference: "managed",
      }),
    ).toEqual({
      business_slug: "island-surf",
      category: "surf-rental",
      booking_mode: "resource",
      action: "book_now",
      cta_location: "pricing",
      contact_type: "whatsapp",
      setup_preference: "managed",
    });
  });

  it("handles missing input", () => {
    expect(sanitizeMarketingProps(undefined)).toEqual({});
    expect(sanitizeMarketingProps(null)).toEqual({});
  });
});

describe("scrubPathname", () => {
  it("drops query strings and hashes", () => {
    expect(scrubPathname("/?utm_source=x")).toBe("/");
    expect(scrubPathname("/business/fade-area?x=1#y")).toBe("/business/fade-area");
  });

  it("scrubs token-bearing manage URLs", () => {
    expect(scrubPathname("/manage/9f3a2b1c")).toBe("/manage");
    expect(scrubPathname("/manage")).toBe("/manage");
  });

  it("handles missing input", () => {
    expect(scrubPathname(undefined)).toBeNull();
    expect(scrubPathname("")).toBeNull();
  });
});

describe("deriveSource", () => {
  it("prefers explicit UTM", () => {
    expect(deriveSource({ utmSource: "instagram" })).toBe("instagram");
    expect(deriveSource({ utmSource: "FB" })).toBe("facebook");
    expect(deriveSource({ utmSource: "whatsapp" })).toBe("whatsapp");
    expect(deriveSource({ utmSource: "google" })).toBe("google");
    expect(deriveSource({ utmSource: "newsletter" })).toBe("other");
  });

  it("maps known referrer hosts", () => {
    expect(deriveSource({ referrer: "https://www.instagram.com/p/x" })).toBe("instagram");
    expect(deriveSource({ referrer: "https://www.facebook.com/y" })).toBe("facebook");
    expect(deriveSource({ referrer: "https://www.google.com/search?q=k" })).toBe("google");
    expect(deriveSource({ referrer: "https://www.bing.com/search?q=k" })).toBe("search");
    expect(deriveSource({ referrer: "https://unknown-blog.example/a" })).toBe("other");
  });

  it("reports direct only when genuinely unattributable", () => {
    expect(deriveSource({})).toBe("direct");
    expect(deriveSource({ referrer: "" })).toBe("direct");
    expect(
      deriveSource({ referrer: "https://kivo.mu/pricing", siteHost: "kivo.mu" }),
    ).toBe("direct");
  });
});

describe("deriveDevice", () => {
  it("classifies mobile, tablet, desktop", () => {
    expect(
      deriveDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148"),
    ).toBe("mobile");
    expect(
      deriveDevice("Mozilla/5.0 (Linux; Android 13; Pixel 7) Mobile Safari/537.36"),
    ).toBe("mobile");
    expect(deriveDevice("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("tablet");
    expect(
      deriveDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0"),
    ).toBe("desktop");
    expect(deriveDevice(undefined)).toBe("desktop");
  });
});

describe("deriveBrowser", () => {
  const CHROME =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  it("identifies major browsers in the right order", () => {
    expect(deriveBrowser(CHROME)).toBe("chrome");
    expect(
      deriveBrowser(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      ),
    ).toBe("edge");
    expect(
      deriveBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1"),
    ).toBe("safari");
    expect(
      deriveBrowser("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"),
    ).toBe("firefox");
    expect(deriveBrowser("curl/8.0")).toBe("other");
    expect(deriveBrowser(undefined)).toBe("other");
  });
});
