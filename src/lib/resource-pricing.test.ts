/**
 * Unit-rate resource pricing (rentals) — client-safe pure functions.
 *
 * The whole point of isolating this logic is that the same day×rate total is
 * used by the availability engine, the booking service, the calendar event
 * and .ics, notifications and the client-side preview — and that a resource
 * without a rate falls back to the service price so no other mode changes.
 */
import { describe, it, expect } from "vitest";
import {
  readUnitRate,
  hasUnitRate,
  rentalDays,
  computeResourceTotal,
  formatMauritianRupees,
} from "./resource-pricing";

const OCT_14 = "2026-10-14T06:00:00.000Z";
const OCT_15 = "2026-10-15T06:00:00.000Z";
const OCT_16 = "2026-10-16T06:00:00.000Z";
const OCT_18 = "2026-10-18T06:00:00.000Z";

describe("readUnitRate / hasUnitRate", () => {
  it("reads a numeric per-day rate from metadata", () => {
    expect(readUnitRate({ rate: 1400 })).toBe(1400);
    expect(readUnitRate({ rate: 0 })).toBe(0);
    expect(readUnitRate({ rate: 1400, seats: 5 })).toBe(1400);
  });

  it("returns null for missing, non-numeric and non-finite rates", () => {
    expect(readUnitRate({})).toBeNull();
    expect(readUnitRate({ rate: "1400" })).toBeNull();
    expect(readUnitRate({ rate: null })).toBeNull();
    expect(readUnitRate({ rate: Infinity })).toBeNull();
    expect(readUnitRate(null)).toBeNull();
    expect(readUnitRate(undefined)).toBeNull();
  });

  it("hasUnitRate follows readUnitRate", () => {
    expect(hasUnitRate({ rate: 1400 })).toBe(true);
    expect(hasUnitRate({})).toBe(false);
    expect(hasUnitRate(null)).toBe(false);
  });
});

describe("rentalDays", () => {
  it("charges one day for a same-day interval", () => {
    expect(rentalDays(OCT_14, new Date(Date.parse(OCT_14) + 60 * 60 * 1000).toISOString())).toBe(1);
    expect(rentalDays(OCT_14, new Date(Date.parse(OCT_14) + 23 * 60 * 60 * 1000).toISOString())).toBe(1);
  });

  it("charges the ceil of 24-hour blocks", () => {
    expect(rentalDays(OCT_14, OCT_15)).toBe(1);
    expect(rentalDays(OCT_14, OCT_16)).toBe(2);
    expect(rentalDays(OCT_14, OCT_18)).toBe(4);
    // 24h + 1 minute counts as 2 days (any started block counts).
    const plusMinute = new Date(Date.parse(OCT_15) + 60_000).toISOString();
    expect(rentalDays(OCT_14, plusMinute)).toBe(2);
  });

  it("returns 0 for invalid or inverted intervals", () => {
    expect(rentalDays(OCT_16, OCT_14)).toBe(0);
    expect(rentalDays(OCT_14, OCT_14)).toBe(0);
    expect(rentalDays("nonsense", OCT_14)).toBe(0);
  });
});

describe("computeResourceTotal", () => {
  it("multiplies the per-day rate by rental days", () => {
    expect(computeResourceTotal({ metadata: { rate: 1400 }, startTime: OCT_14, endTime: OCT_16, fallbackPrice: 1000 })).toBe(2800);
    expect(computeResourceTotal({ metadata: { rate: 2500 }, startTime: OCT_14, endTime: OCT_18, fallbackPrice: 1000 })).toBe(10000);
  });

  it("falls back to the service price when the resource has no rate", () => {
    expect(computeResourceTotal({ metadata: {}, startTime: OCT_14, endTime: OCT_16, fallbackPrice: 1200 })).toBe(1200);
    expect(computeResourceTotal({ metadata: null, startTime: OCT_14, endTime: OCT_16, fallbackPrice: 1200 })).toBe(1200);
  });

  it("falls back for inverted or invalid intervals", () => {
    expect(computeResourceTotal({ metadata: { rate: 1400 }, startTime: OCT_16, endTime: OCT_14, fallbackPrice: 700 })).toBe(700);
  });

  it("never produces fractional rupees", () => {
    expect(computeResourceTotal({ metadata: { rate: 999.99 }, startTime: OCT_14, endTime: OCT_15, fallbackPrice: 1 })).toBe(999.99);
  });
});

describe("formatMauritianRupees", () => {
  it("formats with thousands separators and a Rs prefix", () => {
    expect(formatMauritianRupees(4200)).toBe("Rs 4,200");
    expect(formatMauritianRupees(1400)).toBe("Rs 1,400");
    expect(formatMauritianRupees(0)).toBe("Rs 0");
  });
});