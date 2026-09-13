/**
 * Resource booking strategy (server-side foundation).
 *
 * Availability asks "is resource X free from start to end?". Active bookings
 * on the same resource with overlapping ranges block it. Cancelled bookings
 * never block. Back-to-back reservations are permitted.
 *
 * No rental UI yet — this module is the reusable availability + booking core
 * that the future rental module will consume.
 */
import { getSupabase } from "@/lib/supabase/server";
import { ApiError } from "@/lib/server/errors";
import {
  DEFAULT_TIMEZONE,
  getLocalDayInfo,
  addDaysKey,
} from "@/lib/availability";
import {
  type BusinessRow,
  type ServiceRow,
  type ResourceRow,
  fetchBlocks,
  fetchResource,
  fetchResourceBlocks,
} from "@/lib/server/database";
import { hasUnitRate, computeResourceTotal } from "@/lib/resource-pricing";

export interface ResourceSummary {
  id: string;
  name: string;
  resourceType: string;
  active: boolean;
  /** Public photo shown on the item/vehicle card (null when unset). */
  imageUrl?: string | null;
  /** Generic per-resource metadata (vehicle specs, per-day rate, …). */
  metadata?: Record<string, unknown>;
  /**
   * Interval search only: whether the item has no blocking booking across the
   * requested range. Omitted on the plain (non-interval) resource payload.
   */
  available?: boolean;
}

export interface ResourceAvailabilityResult {
  kind: "resource";
  business: { id: string; name: string; timezone: string };
  service: { id: string; name: string; durationMinutes: number; price: number };
  date: string;
  timezone: string;
  resources: ResourceSummary[];
}

const RESOURCE_UNAVAILABLE_MESSAGE =
  "That item was just reserved by someone else. Please choose another time.";

/** Throws 409 when any ACTIVE booking overlaps the requested resource range. */
export async function assertResourceFree(params: {
  businessId: string;
  resourceId: string;
  startIso: string;
  endIso: string;
  excludeBookingId?: string;
}): Promise<void> {
  const blocks = await fetchBlocks({
    businessId: params.businessId,
    resourceId: params.resourceId,
    startIso: params.startIso,
    endIso: params.endIso,
    excludeBookingId: params.excludeBookingId,
  });
  if (blocks.length > 0) {
    throw new ApiError(409, "SLOT_UNAVAILABLE", RESOURCE_UNAVAILABLE_MESSAGE);
  }
}

/** Ensures the resource exists, belongs to the business, and is active. */
export async function validateResourceBooking(params: {
  businessId: string;
  resourceId: string;
}): Promise<ResourceRow> {
  const resource = await fetchResource(params.resourceId);
  if (!resource || resource.business_id !== params.businessId || !resource.active) {
    throw new ApiError(
      400,
      "RESOURCE_NOT_FOUND",
      "That item isn't available right now.",
    );
  }
  return resource;
}

export async function resourceAvailability(params: {
  business: BusinessRow;
  service: ServiceRow;
  date: string;
}): Promise<ResourceAvailabilityResult> {
  const { business, service, date } = params;
  const timezone = business.timezone || DEFAULT_TIMEZONE;

  const { data, error } = await getSupabase()
    .from("resources")
    .select("id, business_id, name, resource_type, active")
    .eq("business_id", business.id)
    .eq("active", true);

  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't check availability.");
  }

  void getLocalDayInfo(date, timezone);
  void addDaysKey(date, 1);

  return {
    kind: "resource",
    business: { id: business.id, name: business.name, timezone },
    service: {
      id: service.id,
      name: service.name,
      durationMinutes: service.duration_minutes,
      price: Number(service.price),
    },
    date,
    timezone,
    resources: (data ?? []).map((resource) => ({
      id: resource.id as string,
      name: resource.name as string,
      resourceType: resource.resource_type as string,
      active: resource.active as boolean,
    })),
  };
}