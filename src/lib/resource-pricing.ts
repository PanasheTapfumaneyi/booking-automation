/**
 * Generic unit-rate pricing for resource bookings (rentals).
 *
 * A resource carries its prices in `metadata`:
 * - `rate` — per-day Rs (required for rental pricing)
 * - `weekly_rate` — per-7-days Rs (optional, usually discounted)
 * - `monthly_rate` — per-30-days Rs (optional, usually discounted)
 *
 * When a booking spans multiple periods the total breaks down
 * largest-first (months → weeks → leftover days), so a 10-day stay bills
 * as 1 week + 3 days. Period tiers only apply on top of a daily rate;
 * without one the service price is authoritative — so appointment
 * businesses, Island Surf-style resource rentals and capacity are
 * untouched.
 *
 * Pure and framework-agnostic: usable by the booking service, calendar event
 * builder and client-side previews.
 */

/** Reads the per-day rate from resource metadata. Non-numbers → null. */
export function readUnitRate(
  metadata: Record<string, unknown> | null | undefined,
): number | null {
  const rate = metadata?.["rate"];
  if (typeof rate !== "number" || !Number.isFinite(rate)) return null;
  return rate;
}

/** Reads the per-week rate from resource metadata. Non-numbers → null. */
export function readWeeklyRate(
  metadata: Record<string, unknown> | null | undefined,
): number | null {
  const rate = metadata?.["weekly_rate"];
  if (typeof rate !== "number" || !Number.isFinite(rate)) return null;
  return rate;
}

/** Reads the per-month rate from resource metadata. Non-numbers → null. */
export function readMonthlyRate(
  metadata: Record<string, unknown> | null | undefined,
): number | null {
  const rate = metadata?.["monthly_rate"];
  if (typeof rate !== "number" || !Number.isFinite(rate)) return null;
  return rate;
}

/** Whether a resource prices itself per unit/day rather than via the service. */
export function hasUnitRate(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return readUnitRate(metadata) !== null;
}

/**
 * Whole rental days charged for an interval. Any started 24-hour block counts
 * as a day, and a same-day booking within the interval always charges one day.
 * Returns 0 only for an invalid (empty or inverted) interval so callers can
 * treat it as "no total yet".
 */
export function rentalDays(startTime: string, endTime: string): number {
  const start = Date.parse(startTime);
  const end = Date.parse(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(1, Math.ceil((end - start) / 86_400_000));
}

export interface RentalBreakdown {
  months: number;
  weeks: number;
  days: number;
  total: number;
}

/**
 * Breaks a day count into months (30d) → weeks (7d) → leftover days, using
 * only the period tiers the resource actually prices. A tier is skipped
 * when unset or when the remainder is smaller than the tier. Returns the
 * portioned counts plus the total at tier prices.
 */
export function breakdownRentalTotal(
  totalDays: number,
  prices: { daily: number; weekly: number | null; monthly: number | null },
): RentalBreakdown {
  let remaining = Math.max(0, Math.floor(totalDays));
  let months = 0;
  let weeks = 0;
  if (prices.monthly !== null && remaining >= 30) {
    months = Math.floor(remaining / 30);
    remaining -= months * 30;
  }
  if (prices.weekly !== null && remaining >= 7) {
    weeks = Math.floor(remaining / 7);
    remaining -= weeks * 7;
  }
  const days = remaining;
  return {
    months,
    weeks,
    days,
    total:
      Math.round(
        (months * (prices.monthly ?? 0) + weeks * (prices.weekly ?? 0) + days * prices.daily) *
          100,
      ) / 100,
  };
}

/**
 * Total price for a resource booking. Falls back to the service price when the
 * resource has no per-day rate, keeping non-rental bookings unchanged.
 */
export function computeResourceTotal(params: {
  metadata: Record<string, unknown> | null | undefined;
  startTime: string;
  endTime: string;
  fallbackPrice: number;
}): number {
  const daily = readUnitRate(params.metadata);
  if (daily === null) return params.fallbackPrice;
  const days = rentalDays(params.startTime, params.endTime);
  if (days <= 0) return params.fallbackPrice;
  return breakdownRentalTotal(days, {
    daily,
    weekly: readWeeklyRate(params.metadata),
    monthly: readMonthlyRate(params.metadata),
  }).total;
}

/** Human-readable period breakdown, e.g. "1 mo + 1 wk + 3 days". Empty when flat. */
export function formatBreakdown(breakdown: RentalBreakdown): string {
  const parts: string[] = [];
  if (breakdown.months > 0) parts.push(`${breakdown.months} mo`);
  if (breakdown.weeks > 0) parts.push(`${breakdown.weeks} wk`);
  if (breakdown.days > 0) {
    parts.push(`${breakdown.days} day${breakdown.days === 1 ? "" : "s"}`);
  }
  return parts.join(" + ");
}

/** Formats a price in Mauritian Rupees, e.g. "Rs 4,200". */
export function formatMauritianRupees(amount: number): string {
  const rounded = Math.round(amount);
  return `Rs ${rounded.toLocaleString("en-MU")}`;
}
