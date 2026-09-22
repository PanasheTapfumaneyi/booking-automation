/**
 * Pure helpers for the rental availability search and vehicle deep links.
 *
 * Abstracted out of the client component so the enablement rules and the
 * `?vehicle=<id>` preselect behaviour can be regression-tested without a
 * component harness.
 */

export interface RentalFormValues {
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
}

/** Human-readable reasons the "Check availability" search should stay disabled. */
export function rentalEnablementReasons(values: RentalFormValues): string[] {
  const reasons: string[] = [];
  if (!values.pickupDate) reasons.push("Pick-up date is required.");
  if (!values.pickupTime) reasons.push("Pick-up time is required.");
  if (!values.returnDate) reasons.push("Return date is required.");
  if (!values.returnTime) reasons.push("Return time is required.");
  if (values.pickupDate && values.returnDate) {
    if (values.returnDate < values.pickupDate) {
      reasons.push("Return date can't be before pick-up date.");
    } else if (
      values.returnDate === values.pickupDate &&
      values.pickupTime &&
      values.returnTime &&
      values.returnTime <= values.pickupTime
    ) {
      reasons.push("Return time must be after pick-up time.");
    }
  }
  return reasons;
}

export interface RentalSearchResultVehicle {
  id: string;
  name: string;
  description?: string | null;
  resourceType: string;
  active: boolean;
  imageUrl?: string | null;
  metadata?: Record<string, unknown>;
  available?: boolean;
}

export interface RentalPreselectCandidate {
  id: string;
  name: string;
  description: string;
  resourceType: string;
  imageUrl: string | null;
  metadata: Record<string, unknown>;
}

/**
 * The vehicle to pre-select from a `?vehicle=<id>` deep link — the first
 * matching vehicle that is free for the searched interval, or null when the
 * deep-linked vehicle is unavailable (fall back to the manual fleet grid).
 */
export function pickPreselectedVehicle(
  vehicles: RentalSearchResultVehicle[],
  preselectedId?: string,
): RentalPreselectCandidate | null {
  if (!preselectedId) return null;
  const match = vehicles.find(
    (vehicle) => vehicle.id === preselectedId && vehicle.available !== false,
  );
  if (!match) return null;
  return {
    id: match.id,
    name: match.name,
    description: match.description ?? "",
    resourceType: match.resourceType,
    imageUrl: match.imageUrl ?? null,
    metadata: match.metadata ?? {},
  };
}