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