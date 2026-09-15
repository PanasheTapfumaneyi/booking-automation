/**
 * Storefront public helper tests: timezone-correct opening status,
 * visibility rules (flags grant permission, absence always hides),
 * section ordering, social filtering, and honest rating aggregation.
 */
import { describe, it, expect } from "vitest";
import {
  aggregateRating,
  formatHourLabel,
  getTodayIndex,
  getTodayStatus,
  resolveSectionOrder,
  resolveSocialEntries,
  resolveVisibleSections,
} from "./storefront-public";

const HOURS = {
  mon: { open: "09:00", close: "18:00" },
  tue: { open: "09:00", close: "18:00" },
  wed: { open: "09:00", close: "18:00" },
  thu: { open: "09:00", close: "18:00" },
  fri: { open: "09:00", close: "18:00" },
  sat: { open: "09:00", close: "16:00" },
  sun: null,
};

// Monday 2026-09-14 10:00 UTC = 14:00 in Indian/Mauritius (UTC+4).
const MONDAY_AFTERNOON_UTC = new Date("2026-09-14T10:00:00.000Z");
// Monday 2026-09-14 03:00 UTC = 07:00 Mauritius (before 09:00 open).
const MONDAY_EARLY_UTC = new Date("2026-09-14T03:00:00.000Z");

describe("getTodayStatus", () => {
  it("reports open in business-local time (not server time)", () => {
    const status = getTodayStatus(HOURS, "Indian/Mauritius", MONDAY_AFTERNOON_UTC);
    expect(status).toEqual({ open: true, label: "Open today until 6:00 PM" });
  });

  it("reports closed before opening, same timezone", () => {
    const status = getTodayStatus(HOURS, "Indian/Mauritius", MONDAY_EARLY_UTC);
    expect(status).toEqual({ open: false, label: "Closed today" });
  });

  it("reports closed on days without hours", () => {
    // Sunday 2026-09-20 10:00 UTC = 14:00 Mauritius, Sunday has no hours.
    const status = getTodayStatus(
      HOURS,
      "Indian/Mauritius",
      new Date("2026-09-20T10:00:00.000Z"),
    );
    expect(status).toEqual({ open: false, label: "Closed today" });
  });

  it("returns null without usable hours", () => {
    expect(getTodayStatus(null, "Indian/Mauritius", MONDAY_AFTERNOON_UTC)).toBeNull();
    expect(getTodayStatus({} as never, "Indian/Mauritius", MONDAY_AFTERNOON_UTC)).toBeNull();
  });

  it("never throws on an invalid timezone", () => {
    expect(() =>
      getTodayStatus(HOURS, "Not/AZone", MONDAY_AFTERNOON_UTC),
    ).not.toThrow();
  });
});

describe("getTodayIndex", () => {
  it("resolves Monday in Mauritius for a Monday UTC morning", () => {
    expect(getTodayIndex("Indian/Mauritius", MONDAY_EARLY_UTC)).toBe(0);
  });
});

describe("formatHourLabel", () => {
  it("formats 24h wall times", () => {
    expect(formatHourLabel("09:00")).toBe("9:00 AM");
    expect(formatHourLabel("18:00")).toBe("6:00 PM");
    expect(formatHourLabel("12:30")).toBe("12:30 PM");
  });
});

describe("resolveVisibleSections", () => {
  const full = {
    flags: null,
    hasServices: true,
    galleryCount: 2,
    visibleTeamCount: 1,
    reviewCount: 3,
    hasAbout: true,
    hasHours: true,
    hasLocation: true,
    socialCount: 2,
  };

  it("shows everything populated when no row exists", () => {
    const visible = resolveVisibleSections(full);
    expect(visible).toMatchObject({
      services: true,
      gallery: true,
      team: true,
      reviews: true,
      about: true,
      hours: true,
      location: true,
      social: true,
      contact: true,
    });
  });

  it("absence always hides, even with flags on", () => {
    const visible = resolveVisibleSections({
      ...full,
      galleryCount: 0,
      visibleTeamCount: 0,
      reviewCount: 0,
      hasAbout: false,
      hasHours: false,
      hasLocation: false,
      socialCount: 0,
      hasServices: false,
    });
    expect(visible).toMatchObject({
      services: false,
      gallery: false,
      team: false,
      reviews: false,
      about: false,
      hours: false,
      location: false,
      social: false,
      contact: true,
    });
  });

  it("flags can only hide, never conjure content", () => {
    const visible = resolveVisibleSections({
      ...full,
      flags: {
        showGallery: false,
        showTeam: false,
        showReviews: false,
        showAbout: false,
        showHours: false,
        showLocation: false,
        showSocial: false,
      },
    });
    expect(visible.gallery).toBe(false);
    expect(visible.team).toBe(false);
    expect(visible.services).toBe(true);
  });
});

describe("resolveSectionOrder", () => {
  it("returns the canonical order by default", () => {
    const order = resolveSectionOrder(null);
    expect(order[0]).toBe("hero");
    expect(order).toContain("services");
    expect(order).toContain("contact");
  });

  it("honours a validated override and appends the rest", () => {
    const order = resolveSectionOrder(["reviews", "services"]);
    expect(order.slice(0, 2)).toEqual(["reviews", "services"]);
    expect(order).toContain("gallery");
  });

  it("drops unknown keys silently", () => {
    const order = resolveSectionOrder(["checkout", "services"]);
    expect(order).not.toContain("checkout");
    expect(order).toContain("services");
  });
});

describe("resolveSocialEntries", () => {
  it("keeps configured networks in stable order", () => {
    const entries = resolveSocialEntries({
      tiktok: "https://tiktok.com/@x",
      instagram: "https://instagram.com/x",
      unknown: "https://x.example",
    });
    expect(entries.map((entry) => entry.network)).toEqual(["instagram", "tiktok"]);
  });

  it("returns nothing for empty input", () => {
    expect(resolveSocialEntries(null)).toEqual([]);
    expect(resolveSocialEntries({})).toEqual([]);
  });
});

describe("aggregateRating", () => {
  it("averages legitimate ratings only", () => {
    expect(
      aggregateRating([{ rating: 5 }, { rating: 4 }, { rating: null }]),
    ).toEqual({ average: 4.5, count: 2 });
  });

  it("returns null with nothing rated", () => {
    expect(aggregateRating([])).toBeNull();
    expect(aggregateRating([{ rating: null }])).toBeNull();
  });
});
