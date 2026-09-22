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
  readWeeklyRate,
  readMonthlyRate,
  hasUnitRate,
  rentalDays,
  breakdownRentalTotal,
  computeResourceTotal,
  formatBreakdown,
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

describe("readWeeklyRate / readMonthlyRate", () => {
  it("reads numeric period rates from metadata", () => {
    expect(readWeeklyRate({ weekly_rate: 8000 })).toBe(8000);
    expect(readWeeklyRate({ weekly_rate: 0 })).toBe(0);
    expect(readMonthlyRate({ monthly_rate: 30000 })).toBe(30000);
  });

  it("returns null for missing, non-numeric and non-finite values", () => {
    expect(readWeeklyRate({})).toBeNull();
    expect(readWeeklyRate({ weekly_rate: "8000" })).toBeNull();
    expect(readWeeklyRate({ weekly_rate: Infinity })).toBeNull();
    expect(readWeeklyRate(null)).toBeNull();
    expect(readMonthlyRate({ monthly_rate: null })).toBeNull();
    expect(readMonthlyRate(undefined)).toBeNull();
  });
});

describe("breakdownRentalTotal", () => {
  it("bills short stays at the daily rate", () => {
    expect(
      breakdownRentalTotal(3, { daily: 1400, weekly: 8000, monthly: 30000 }),
    ).toEqual({ months: 0, weeks: 0, days: 3, total: 4200 });
  });

  it("breaks 10 days into 1 week + 3 days", () => {
    expect(
      breakdownRentalTotal(10, { daily: 1400, weekly: 8000, monthly: 30000 }),
    ).toEqual({ months: 0, weeks: 1, days: 3, total: 12200 });
  });

  it("breaks 37 days into 1 month + 1 week + 0 days", () => {
    expect(
      breakdownRentalTotal(37, { daily: 1400, weekly: 8000, monthly: 30000 }),
    ).toEqual({ months: 1, weeks: 1, days: 0, total: 38000 });
  });

  it("skips unset tiers and bills the remainder daily", () => {
    expect(breakdownRentalTotal(10, { daily: 1400, weekly: null, monthly: null })).toEqual({
      months: 0,
      weeks: 0,
      days: 10,
      total: 14000,
    });
    expect(breakdownRentalTotal(10, { daily: 1400, weekly: 8000, monthly: null })).toEqual({
      months: 0,
      weeks: 1,
      days: 3,
      total: 12200,
    });
  });

  it("ignores tiers larger than the stay", () => {
    expect(
      breakdownRentalTotal(5, { daily: 1400, weekly: 8000, monthly: 30000 }),
    ).toEqual({ months: 0, weeks: 0, days: 5, total: 7000 });
  });
});

describe("computeResourceTotal with period tiers", () => {
  const meta = { rate: 1400, weekly_rate: 8000, monthly_rate: 30000 };
  const at = (start: string, days: number) =>
    new Date(Date.parse(start) + days * 86_400_000).toISOString();

  it("uses the weekly tier for a 10-day stay", () => {
    expect(
      computeResourceTotal({ metadata: meta, startTime: OCT_14, endTime: at(OCT_14, 10), fallbackPrice: 1000 }),
    ).toBe(12200);
  });

  it("uses the monthly tier for a 35-day stay", () => {
    expect(
      computeResourceTotal({ metadata: meta, startTime: OCT_14, endTime: at(OCT_14, 35), fallbackPrice: 1000 }),
    ).toBe(30000 + 7000);
  });

  it("behaves exactly as before with daily rate only", () => {
    expect(
      computeResourceTotal({ metadata: { rate: 1400 }, startTime: OCT_14, endTime: at(OCT_14, 10), fallbackPrice: 1000 }),
    ).toBe(14000);
  });
});

describe("formatBreakdown", () => {
  it("formats months, weeks and days", () => {
    expect(formatBreakdown({ months: 1, weeks: 1, days: 3, total: 0 })).toBe("1 mo + 1 wk + 3 days");
    expect(formatBreakdown({ months: 0, weeks: 0, days: 1, total: 0 })).toBe("1 day");
    expect(formatBreakdown({ months: 0, weeks: 2, days: 0, total: 0 })).toBe("2 wk");
  });

  it("returns an empty string for a flat stay", () => {
    expect(formatBreakdown({ months: 0, weeks: 0, days: 0, total: 0 })).toBe("");
  });
});

describe("formatMauritianRupees", () => {
  it("formats with thousands separators and a Rs prefix", () => {
    expect(formatMauritianRupees(4200)).toBe("Rs 4,200");
    expect(formatMauritianRupees(1400)).toBe("Rs 1,400");
    expect(formatMauritianRupees(0)).toBe("Rs 0");
  });
});