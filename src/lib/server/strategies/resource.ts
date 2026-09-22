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
  /** Optional customer-facing description shown on the item card. */
  description?: string | null;
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
    .select("id, business_id, name, description, resource_type, active, image_url, metadata")
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
    resources: (data ?? []).map((resource) => toResourceSummary(resource)),
  };
}

/**
 * Interval availability — "which items are free from start to end?".
 *
 * The engine's multi-day core. Every active resource is returned together with
 * an `available` flag, image and metadata so the rental UI can render the fleet
 * grid in a single request. Different items can overlap freely (the DB guards
 * per resource); a cancelled booking never marks an item unavailable.
 */
export async function resourceIntervalAvailability(params: {
  business: BusinessRow;
  service: ServiceRow;
  startIso: string;
  endIso: string;
  excludeBookingId?: string;
}): Promise<ResourceAvailabilityResult & { startIso: string; endIso: string }> {
  const { business, service } = params;
  const timezone = business.timezone || DEFAULT_TIMEZONE;

  const [{ data, error }, blocks] = await Promise.all([
    getSupabase()
      .from("resources")
      .select("id, business_id, name, description, resource_type, active, image_url, metadata")
      .eq("business_id", business.id)
      .eq("active", true),
    fetchResourceBlocks({
      businessId: business.id,
      startIso: params.startIso,
      endIso: params.endIso,
      excludeBookingId: params.excludeBookingId,
    }),
  ]);

  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't check availability.");
  }

  const blocked = new Set(blocks.map((b) => b.resourceId));

  return {
    kind: "resource",
    business: { id: business.id, name: business.name, timezone },
    service: {
      id: service.id,
      name: service.name,
      durationMinutes: service.duration_minutes,
      price: Number(service.price),
    },
    date: params.startIso.slice(0, 10),
    startIso: params.startIso,
    endIso: params.endIso,
    timezone,
    resources: (data ?? []).map((resource) => ({
      ...toResourceSummary(resource),
      available: !blocked.has(resource.id as string),
    })),
  };
}

function toResourceSummary(resource: {
  id: unknown;
  name: unknown;
  description?: unknown;
  resource_type: unknown;
  active: unknown;
  image_url: unknown;
  metadata: unknown;
}): ResourceSummary {
  const metadata = (resource.metadata ?? {}) as Record<string, unknown>;
  return {
    id: resource.id as string,
    name: resource.name as string,
    description: (resource.description as string | null) ?? null,
    resourceType: resource.resource_type as string,
    active: resource.active as boolean,
    imageUrl: (resource.image_url as string | null) ?? null,
    metadata,
  };
}

/**
 * Whether a business should present its resource flow as a rental (fleet grid
 * + interval search) rather than the plain "pick an item" flow. Driven by the
 * generic unit-rate metadata, never by slug or demo flag, so any business with
 * day-priced resources gets the rental experience.
 */
export function isUnitRatedCollection(resources: ResourceRow[]): boolean {
  return resources.length > 0 && resources.every((r) => hasUnitRate(r.metadata));
}

/** Convenience total for a resource booking (used by calendar/notification). */
export function resourceBookingTotal(input: {
  metadata: Record<string, unknown> | null | undefined;
  startIso: string;
  endIso: string;
  servicePrice: number;
}): number {
  return computeResourceTotal({
    metadata: input.metadata,
    startTime: input.startIso,
    endTime: input.endIso,
    fallbackPrice: input.servicePrice,
  });
}