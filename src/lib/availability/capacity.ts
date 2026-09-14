/**
 * Capacity availability strategy (foundation).
 *
 * For a session: remaining = capacity - SUM(quantity of ACTIVE bookings).
 * A request is allowed only when requestedQuantity <= remaining.
 * Cancelled bookings never consume capacity.
 */
export function hasRemainingCapacity(
  capacity: number,
  bookedQuantity: number,
  requestedQuantity: number,
): boolean {
  return requestedQuantity <= capacity - bookedQuantity;
}

export function remainingCapacity(capacity: number, bookedQuantity: number): number {
  const remaining = capacity - bookedQuantity;
  return remaining > 0 ? remaining : 0;
}

/**
 * Clamps a desired guest count into [1, remaining]. The server re-checks the
 * live remaining authoritative quantity (atomic RPC); this pure clamp only
 * keeps the UI from offering obviously impossible quantities.
 */
export function clampQuantity(requested: number, remaining: number): number {
  if (!Number.isFinite(requested)) return 1;
  const floor = Math.max(1, Math.floor(requested));
  if (floor < 1) return 1;
  if (remaining >= 1 && floor > remaining) return remaining;
  return floor;
}