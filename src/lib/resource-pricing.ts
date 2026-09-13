/**
 * Generic unit-rate pricing for resource bookings (rentals).
 *
 * A resource can carry a per-day (unit) rate in its `metadata.rate`. When a
 * booking spans multiple days the total is `days × rate`, computed once by the
 * engine and reused everywhere (API, calendar event, .ics, manage page). When
 * a resource has no rate, the service price is authoritative — so appointment
 * businesses, Island Surf-style resource rentals and capacity are untouched.
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
  const rate = readUnitRate(params.metadata);
  if (rate === null) return params.fallbackPrice;
  const days = rentalDays(params.startTime, params.endTime);
  return days <= 0 ? params.fallbackPrice : Math.round(rate * days * 100) / 100;
}

/** Formats a price in Mauritian Rupees, e.g. "Rs 4,200". */
export function formatMauritianRupees(amount: number): string {
  const rounded = Math.round(amount);
  return `Rs ${rounded.toLocaleString("en-MU")}`;
}