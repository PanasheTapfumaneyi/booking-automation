import { getSupabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/server/errors";
import type { Booking, BookingMode } from "@/types/booking";
import type { BusinessHours } from "@/lib/availability/hours";

// ---------------------------------------------------------------------------
// Row shapes (PostgREST) — avoid implicit `any`.
// ---------------------------------------------------------------------------

export interface BusinessRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  timezone: string;
  booking_mode: BookingMode;
  calendar_id: string | null;
  slug: string | null;
  /** Per-business weekly hours (JSONB); null/absent days use platform defaults. */
  availability: BusinessHours | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceRow {
  id: string;
  business_id: string;
  name: string;
  duration_minutes: number;
  price: string | number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerRow {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email: string | null;
}

export interface ResourceRow {
  id: string;
  business_id: string;
  name: string;
  resource_type: string;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BookingSessionRow {
  id: string;
  business_id: string;
  service_id: string;
  start_time: string;
  end_time: string | null;
  capacity: number;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BookingRow {
  id: string;
  business_id: string;
  service_id: string;
  customer_id: string;
  resource_id: string | null;
  session_id: string | null;
  quantity: number;
  start_time: string;
  end_time: string;
  status: Booking["status"];
  google_event_id: string | null;
  manage_token: string;
  previous_start_time: string | null;
  created_at: string;
  updated_at: string;
  service?: Pick<ServiceRow, "name" | "duration_minutes" | "price"> | null;
  customer?: Pick<CustomerRow, "name" | "phone" | "email"> | null;
}

// ---------------------------------------------------------------------------
// Availability semantics
//
// Only statuses listed here represent live reservations that block availability
// or consume capacity. `cancelled` (and `completed`/`no_show`) never block.
// This is the single source of truth; keep in sync with the SQL partial
// predicates in migrations 0002 ("bookings_no_overlap"/"bookings_resource_no_overlap"
// and the capacity sums inside `create_booking`).
// ---------------------------------------------------------------------------
export const BLOCKING_BOOKING_STATUSES = ["confirmed", "rescheduled"] as const;

// ---------------------------------------------------------------------------
// Shared SELECTs and lookups
// ---------------------------------------------------------------------------

export const BOOKING_SELECT = [
  "id",
  "business_id",
  "service_id",
  "customer_id",
  "resource_id",
  "session_id",
  "quantity",
  "start_time",
  "end_time",
  "status",
  "google_event_id",
  "manage_token",
  "previous_start_time",
  "created_at",
  "updated_at",
  "service:services(id, name, duration_minutes, price)",
  "customer:customers(id, name, phone, email)",
].join(", ");

export const BLOCKING_STATUS_LIST = BLOCKING_BOOKING_STATUSES.join(",");

export async function fetchBusiness(
  businessId: string,
  db?: SupabaseClient,
): Promise<BusinessRow> {
  const { data, error } = await (db ?? getSupabase())
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !data) {
    throw new ApiError(500, "INTERNAL", "We couldn't load the business.");
  }
  return data as unknown as BusinessRow;
}

export async function fetchService(serviceId: string): Promise<ServiceRow | null> {
  const { data, error } = await getSupabase()
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .maybeSingle();

  if (error) return null;
  return data as unknown as ServiceRow;
}

export async function fetchResource(resourceId: string): Promise<ResourceRow | null> {
  const { data, error } = await getSupabase()
    .from("resources")
    .select("*")
    .eq("id", resourceId)
    .maybeSingle();

  if (error) return null;
  return data as unknown as ResourceRow;
}

export async function fetchBookingSession(
  sessionId: string,
): Promise<BookingSessionRow | null> {
  const { data, error } = await getSupabase()
    .from("booking_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) return null;
  return data as unknown as BookingSessionRow;
}

/** Public lookup by booking slug — returns null (never throws) when unknown. */
export async function fetchBusinessBySlug(
  slug: string,
  db?: SupabaseClient,
): Promise<BusinessRow | null> {
  const { data, error } = await (db ?? getSupabase())
    .from("businesses")
    .select("*")
    .eq("slug", slug.trim().toLowerCase())
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as BusinessRow;
}

/** Lookup by booking id (availability exclusion, admin reads). */
export async function fetchBookingById(
  id: string,
  db?: SupabaseClient,
): Promise<{ row: BookingRow } | null> {
  const { data, error } = await (db ?? getSupabase())
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return { row: data as unknown as BookingRow };
}

export async function fetchBookingByToken(
  token: string,
  db?: SupabaseClient,
): Promise<{ row: BookingRow } | null> {
  // Exact match on the unique manage_token — never a list, prefix, or
  // fallback. Any error (or zero rows) is "not found", never another row.
  const { data, error } = await (db ?? getSupabase())
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("manage_token", token)
    .maybeSingle();

  if (error) return null;
  if (!data) return null;
  return { row: data as unknown as BookingRow };
}

/**
 * Active bookings overlapping [startIso, endIso].
 * Optionally scoped to a single resource and/or excluding one booking (used
 * while rescheduling the booking itself).
 */
export async function fetchBlocks(params: {
  businessId: string;
  startIso: string;
  endIso: string;
  resourceId?: string;
  excludeBookingId?: string;
}): Promise<{ startTime: string; endTime: string; quantity?: number }[]> {
  let query = getSupabase()
    .from("bookings")
    .select("id, start_time, end_time, quantity, status, resource_id, session_id")
    .eq("business_id", params.businessId)
    .in("status", BLOCKING_BOOKING_STATUSES)
    .lt("start_time", params.endIso)
    .gt("end_time", params.startIso);

  if (params.resourceId) {
    query = query.eq("resource_id", params.resourceId);
  }
  if (params.excludeBookingId) {
    query = query.neq("id", params.excludeBookingId);
  }

  const { data, error } = await query;
  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't check availability.");
  }
  return (data ?? []).map((block) => ({
    startTime: block.start_time as string,
    endTime: block.end_time as string,
    quantity: block.quantity as number,
  }));
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function findOrCreateCustomer(
  businessId: string,
  details: { name: string; phone: string; email: string | null },
): Promise<string> {
  const db = getSupabase();
  const digits = normalizePhone(details.phone);

  const { data: existing, error: findError } = await db
    .from("customers")
    .select("id, phone")
    .eq("business_id", businessId)
    .limit(50);

  if (findError) {
    throw new ApiError(500, "INTERNAL", "We couldn't save your booking.");
  }

  const match = (existing ?? []).find(
    (customer: { id: string; phone: string }) =>
      normalizePhone(customer.phone) === digits,
  );
  if (match) return match.id;

  const { data: created, error: insertError } = await db
    .from("customers")
    .insert({
      business_id: businessId,
      name: details.name,
      phone: details.phone,
      email: details.email,
    })
    .select("id")
    .single();

  if (insertError || !created) {
    throw new ApiError(500, "INTERNAL", "We couldn't save your booking.");
  }
  return created.id as string;
}

// ---------------------------------------------------------------------------
// Google Calendar sync helpers (Phase 3)
// ---------------------------------------------------------------------------

export type CalendarSyncStatus =
  | "not_connected"
  | "pending"
  | "synced"
  | "failed";

/**
 * Persists the outcome of a Google Calendar sync on a booking row.
 * All fields are optional; only provided fields are written.
 */
export async function updateBookingCalendarSync(
  bookingId: string,
  fields: {
    status: CalendarSyncStatus;
    eventId?: string | null;
    error?: string | null;
    syncedAt?: string | null;
  },
  db?: Pick<SupabaseClient, "from">,
): Promise<void> {
  const client = (db ?? getSupabase()) as SupabaseClient;
  const patch: Record<string, unknown> = {
    calendar_sync_status: fields.status,
    updated_at: new Date().toISOString(),
  };
  if (fields.eventId !== undefined) patch.google_event_id = fields.eventId;
  if (fields.error !== undefined) patch.calendar_sync_error = fields.error;
  if (fields.syncedAt !== undefined) patch.calendar_synced_at = fields.syncedAt;

  const { error } = await client.from("bookings").update(patch).eq("id", bookingId);
  if (error) {
    // Sync bookkeeping must not swallow the booking itself; log only.
    console.error("[calendar-sync] could not persist sync state:", error);
  }
}

/** Compensating action: cancels a booking that could not be synced. */
export async function cancelBookingById(
  bookingId: string,
  db?: Pick<SupabaseClient, "from">,
): Promise<void> {
  const client = (db ?? getSupabase()) as SupabaseClient;
  const { error } = await client
    .from("bookings")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", bookingId);
  if (error) {
    console.error("[calendar-sync] compensation cancel failed:", error);
  }
}

/**
 * Reverses an update_booking_time call (used to undo a reschedule when the
 * Google event cannot move). Returns false if the revert conflicts (e.g. the
 * original slot was taken meanwhile).
 */
export async function revertBookingTime(
  bookingId: string,
  previousStartIso: string,
  previousEndIso: string,
  db?: Pick<SupabaseClient, "from">,
): Promise<boolean> {
  const client = (db ?? getSupabase()) as SupabaseClient;
  const { data, error } = await client.rpc("update_booking_time", {
    p_booking_id: bookingId,
    p_start_time: previousStartIso,
    p_end_time: previousEndIso,
  });
  if (error) return false;
  return Boolean((data as { ok?: boolean } | null)?.ok);
}