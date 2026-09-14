/**
 * Business booking operations (Phase 6B).
 *
 * The trusted server-side interface between the business dashboard and the
 * existing booking engine. Rules:
 *  - Every function takes an already-authorized business (routes enforce
 *    membership first via requireBusinessOwner; business_id is never trusted
 *    from the client beyond the membership-checked path id).
 *  - Reads use explicit safe SELECTs — manage_token is never selected for
 *    admin responses (it is fetched separately, server-side only, when the
 *    core token-keyed functions need it).
 *  - Create/reschedule/cancel delegate to the EXISTING booking-service core
 *    (createBooking / rescheduleBooking / cancelBooking), so Calendar sync,
 *    notifications, reminders eligibility, constraints, and compensation
 *    behavior are identical to the customer flows. No parallel engine.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/server";
import { ApiError } from "@/lib/server/errors";
import {
  fetchService,
  fetchBookingSession,
  normalizePhone,
  type BusinessRow,
} from "@/lib/server/database";
import {
  createBooking,
  rescheduleBooking,
  cancelBooking,
  type CreateBookingInput,
} from "@/lib/server/booking-service";
import type { NotificationDispatchResult } from "@/lib/server/notifications/service";
import { toDateKey, getLocalDayInfo, addDaysKey } from "@/lib/availability/time";
import { computeResourceTotal } from "@/lib/resource-pricing";
import type { Booking } from "@/types/booking";

type DbLike = Pick<SupabaseClient, "from">;

function serviceDb(db?: DbLike): SupabaseClient {
  return (db ?? getSupabase()) as SupabaseClient;
}

/** Explicit admin columns — manage_token is deliberately absent. */
export const BOOKING_ADMIN_SELECT = [
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
  "previous_start_time",
  "calendar_sync_status",
  "calendar_sync_error",
  "calendar_synced_at",
  "created_at",
  "updated_at",
  "service:services(id, name, duration_minutes, price)",
  "customer:customers(id, name, phone, email)",
  "resource:resources(id, name, metadata)",
  "session:booking_sessions(id, start_time, end_time, capacity)",
].join(", ");

/**
 * Sanitized booking for business UI/API. manage_token and google_event_id
 * are stripped (internal identifiers with no operational use for owners);
 * mode/calendar display fields are added.
 */
export interface BusinessBooking extends Omit<Booking, "manageToken" | "googleEventId"> {
  resourceName: string | null;
  sessionStartTime: string | null;
  sessionEndTime: string | null;
  sessionCapacity: number | null;
  calendarSyncStatus: string;
  calendarSyncError: string | null;
  calendarSyncedAt: string | null;
}

interface AdminRow {
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
  previous_start_time: string | null;
  calendar_sync_status: string;
  calendar_sync_error: string | null;
  calendar_synced_at: string | null;
  created_at: string;
  updated_at: string;
  service?: { id: string; name: string; duration_minutes: number; price: number | string } | null;
  customer?: { id: string; name: string; phone: string; email: string | null } | null;
  resource?: { id: string; name: string; metadata: Record<string, unknown> | null } | null;
  session?: { id: string; start_time: string; end_time: string | null; capacity: number } | null;
}

function toBusinessBooking(row: AdminRow): BusinessBooking {
  return {
    id: row.id,
    businessId: row.business_id,
    serviceId: row.service_id,
    customerId: row.customer_id,
    resourceId: row.resource_id,
    sessionId: row.session_id,
    quantity: row.quantity,
    serviceName: row.service?.name ?? "",
    // Unit-rate rentals price by days × rate; anything else keeps the price.
    servicePrice: computeResourceTotal({
      metadata: row.resource?.metadata ?? null,
      startTime: row.start_time,
      endTime: row.end_time,
      fallbackPrice: Number(row.service?.price ?? 0),
    }),
    serviceDurationMinutes: row.service?.duration_minutes ?? 0,
    customerName: row.customer?.name ?? "",
    customerPhone: row.customer?.phone ?? "",
    customerEmail: row.customer?.email ?? null,
    resourceName: row.resource?.name ?? null,
    sessionStartTime: row.session?.start_time ?? null,
    sessionEndTime: row.session?.end_time ?? null,
    sessionCapacity: row.session?.capacity ?? null,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    calendarSyncStatus: row.calendar_sync_status,
    calendarSyncError: row.calendar_sync_error,
    calendarSyncedAt: row.calendar_synced_at,
    previousStartTime: row.previous_start_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Strips internal identifiers from a full Booking (core functions return it). */
export function sanitizeBooking(booking: Booking): BusinessBooking {
  const { manageToken: _token, googleEventId: _event, ...rest } = booking;
  void _token;
  void _event;
  return {
    ...rest,
    resourceName: null,
    sessionStartTime: null,
    sessionEndTime: null,
    sessionCapacity: null,
    calendarSyncStatus: "not_connected",
    calendarSyncError: null,
    calendarSyncedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Timezone-aware day bounds (business timezone, never browser UTC)
// ---------------------------------------------------------------------------

export interface DayBounds {
  todayKey: string;
  dayStartUtc: string;
  dayEndUtc: string;
}

/** UTC instants bounding "today" in the business timezone. */
export function getBusinessDayBounds(timezone: string, now: Date = new Date()): DayBounds {
  const todayKey = toDateKey(now, timezone);
  const dayStartUtc = getLocalDayInfo(todayKey, timezone).dayStartUtc;
  const dayEndUtc = getLocalDayInfo(addDaysKey(todayKey, 1), timezone).dayStartUtc;
  return { todayKey, dayStartUtc, dayEndUtc };
}

// ---------------------------------------------------------------------------
// Listing / detail (safe reads)
// ---------------------------------------------------------------------------

export interface BookingListFilters {
  statuses?: Booking["status"][];
  fromIso?: string;
  toIso?: string;
  serviceId?: string;
  resourceId?: string;
  sessionId?: string;
  customerIds?: string[];
  limit?: number;
  offset?: number;
  order?: "asc" | "desc";
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** Chronological booking list scoped to one business. Paginated. */
export async function listBusinessBookings(
  businessId: string,
  filters: BookingListFilters = {},
  db?: DbLike,
): Promise<BusinessBooking[]> {
  const client = serviceDb(db);
  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
  const offset = Math.max(filters.offset ?? 0, 0);
  let query = client
    .from("bookings")
    .select(BOOKING_ADMIN_SELECT)
    .eq("business_id", businessId)
    .order("start_time", { ascending: (filters.order ?? "asc") === "asc" })
    .range(offset, offset + limit - 1);
  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in("status", filters.statuses);
  }
  if (filters.fromIso) {
    query = query.gte("start_time", filters.fromIso);
  }
  if (filters.toIso) {
    query = query.lt("start_time", filters.toIso);
  }
  if (filters.serviceId) {
    query = query.eq("service_id", filters.serviceId);
  }
  if (filters.resourceId) {
    query = query.eq("resource_id", filters.resourceId);
  }
  if (filters.sessionId) {
    query = query.eq("session_id", filters.sessionId);
  }
  if (filters.customerIds && filters.customerIds.length > 0) {
    query = query.in("customer_id", filters.customerIds);
  }
  const { data, error } = await query;
  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't load bookings. Please try again.");
  }
  return ((data ?? []) as unknown as AdminRow[]).map(toBusinessBooking);
}

/**
 * One booking of one business. Returns null when the id is unknown OR
 * belongs to another business (callers map both to a safe 404).
 */
export async function fetchBusinessBookingById(
  businessId: string,
  bookingId: string,
  db?: DbLike,
): Promise<BusinessBooking | null> {
  const client = serviceDb(db);
  const { data, error } = await client
    .from("bookings")
    .select(BOOKING_ADMIN_SELECT)
    .eq("id", bookingId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error || !data) return null;
  return toBusinessBooking(data as unknown as AdminRow);
}

/** Server-only token lookup for delegating to the token-keyed core. */
async function fetchBookingToken(
  businessId: string,
  bookingId: string,
  db?: DbLike,
): Promise<string | null> {
  const client = serviceDb(db);
  const { data, error } = await client
    .from("bookings")
    .select("manage_token")
    .eq("id", bookingId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { manage_token: string }).manage_token ?? null;
}

async function tokenOr404(businessId: string, bookingId: string, db?: DbLike): Promise<string> {
  const token = await fetchBookingToken(businessId, bookingId, db);
  if (!token) {
    // Unknown id or another business's booking — identical safe response.
    throw new ApiError(404, "BOOKING_NOT_FOUND", "We couldn't find this booking.");
  }
  return token;
}

// ---------------------------------------------------------------------------
// Counts for the operational overview
// ---------------------------------------------------------------------------

export interface BookingCounts {
  today: number;
  upcoming: number;
  failedNotifications: number;
  calendarIssues: number;
}

/** Small bounded count queries — no row data leaves the database. */
export async function fetchBusinessBookingCounts(
  business: Pick<BusinessRow, "id" | "timezone">,
  now: Date = new Date(),
  db?: DbLike,
): Promise<BookingCounts> {
  const client = serviceDb(db);
  const { dayStartUtc, dayEndUtc } = getBusinessDayBounds(business.timezone, now);
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

  const [today, upcoming, failed, syncIssues] = await Promise.all([
    client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .in("status", ["confirmed", "rescheduled"])
      .gte("start_time", dayStartUtc)
      .lt("start_time", dayEndUtc),
    client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .in("status", ["confirmed", "rescheduled"])
      .gte("start_time", dayEndUtc),
    client
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("status", "failed")
      .gte("created_at", weekAgo),
    client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("calendar_sync_status", "failed"),
  ]);
  return {
    today: today.count ?? 0,
    upcoming: upcoming.count ?? 0,
    failedNotifications: failed.count ?? 0,
    calendarIssues: syncIssues.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Customer search (business-scoped, capped — not a CRM)
// ---------------------------------------------------------------------------

export interface CustomerSummary {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

/** Find customers by name or phone fragment within one business. */
export async function searchBusinessCustomers(
  businessId: string,
  query: string,
  db?: DbLike,
  limit = 20,
): Promise<CustomerSummary[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const client = serviceDb(db);
  const digits = normalizePhone(q);
  // Commas would corrupt the PostgREST or() list — strip them (and wildcards).
  const pattern = `%${q.replace(/[%_,]/g, "")}%`;
  const orParts = [`name.ilike.${pattern}`, `phone.ilike.${pattern}`];
  if (digits.length >= 2 && digits !== q.replace(/\D/g, "")) {
    orParts.push(`phone.ilike.%${digits}%`);
  }
  const { data, error } = await client
    .from("customers")
    .select("id, name, phone, email")
    .eq("business_id", businessId)
    .or(orParts.join(","))
    .limit(Math.min(Math.max(limit, 1), 50));
  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't search customers. Please try again.");
  }
  return ((data ?? []) as unknown as CustomerSummary[]).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Notification + calendar visibility (safe subsets)
// ---------------------------------------------------------------------------

export interface NotificationSummary {
  event_type: string;
  recipient_type: string;
  status: string;
  error_code: string | null;
  sent_at: string | null;
  created_at: string;
}

/** Delivery timeline for one booking — statuses only, no destinations. */
export async function fetchBookingNotificationSummary(
  bookingId: string,
  db?: DbLike,
): Promise<NotificationSummary[]> {
  const client = serviceDb(db);
  const { data, error } = await client
    .from("notifications")
    .select("event_type, recipient_type, status, error_code, sent_at, created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });
  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't load notification status.");
  }
  return ((data ?? []) as unknown as NotificationSummary[]).map((n) => ({
    event_type: n.event_type,
    recipient_type: n.recipient_type,
    status: n.status,
    error_code: n.error_code,
    sent_at: n.sent_at,
    created_at: n.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Mutations — ownership verified by callers, then the shared core runs
// ---------------------------------------------------------------------------

async function assertServiceBelongs(businessId: string, serviceId: string): Promise<void> {
  const service = await fetchService(serviceId);
  if (!service || service.business_id !== businessId) {
    throw new ApiError(404, "SERVICE_NOT_FOUND", "That service isn't available right now.");
  }
}

export interface BusinessCreateBookingInput extends CreateBookingInput {
  /** Existing customer to reuse (must belong to the business). */
  customerId?: string;
}

async function resolveBusinessCustomer(
  businessId: string,
  input: BusinessCreateBookingInput,
  db?: DbLike,
): Promise<{ name: string; phone: string; email?: string }> {
  const client = serviceDb(db);
  if (input.customerId) {
    const { data, error } = await client
      .from("customers")
      .select("id, name, phone, email")
      .eq("id", input.customerId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (error || !data) {
      throw new ApiError(404, "BOOKING_NOT_FOUND", "That customer wasn't found.");
    }
    const customer = data as { name: string; phone: string; email: string | null };
    return { name: customer.name, phone: customer.phone, email: customer.email ?? undefined };
  }
  return { name: input.name, phone: input.phone, email: input.email };
}

export interface CreateBusinessBookingResult {
  booking: BusinessBooking;
  /** Non-throwing dispatch summary from the shared booking core. */
  notifications: NotificationDispatchResult;
}

/**
 * Business-side create: verifies every referenced row belongs to the
 * business, then runs the shared createBooking core (constraints, Calendar
 * sync, notifications, reminders eligibility all identical).
 */
export async function createBusinessBooking(
  business: BusinessRow,
  input: BusinessCreateBookingInput,
  db?: DbLike,
): Promise<CreateBusinessBookingResult> {
  await assertServiceBelongs(business.id, input.serviceId);
  if (input.resourceId) {
    const client = serviceDb(db);
    const { data: resource } = await client
      .from("resources")
      .select("id")
      .eq("id", input.resourceId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (!resource) {
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "That item isn't available right now.");
    }
  }
  if (input.sessionId) {
    const session = await fetchBookingSession(input.sessionId);
    if (!session || session.business_id !== business.id) {
      throw new ApiError(404, "SESSION_NOT_FOUND", "That departure isn't available right now.");
    }
  }
  const customer = await resolveBusinessCustomer(business.id, input, db);
  const created = await createBooking({
    serviceId: input.serviceId,
    startTime: input.startTime,
    endTime: input.endTime,
    resourceId: input.resourceId,
    sessionId: input.sessionId,
    quantity: input.quantity,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
  });
  // Re-read for authoritative calendar-sync columns; fall back to the
  // sanitized core result if the re-read races the commit.
  const booking =
    (await fetchBusinessBookingById(business.id, created.booking.id, db)) ??
    sanitizeBooking(created.booking);
  return { booking, notifications: created.notifications };
}

/** Business-side reschedule: same core, same token, same side effects. */
export async function rescheduleBusinessBooking(
  businessId: string,
  bookingId: string,
  startTime: string,
  endTime?: string,
  db?: DbLike,
): Promise<BusinessBooking> {
  const token = await tokenOr404(businessId, bookingId, db);
  const moved = await rescheduleBooking(token, startTime, endTime);
  return (await fetchBusinessBookingById(businessId, moved.id, db)) ?? sanitizeBooking(moved);
}

/** Business-side cancel: same core (idempotent, history preserved). */
export async function cancelBusinessBooking(
  businessId: string,
  bookingId: string,
  db?: DbLike,
): Promise<BusinessBooking> {
  const token = await tokenOr404(businessId, bookingId, db);
  const cancelled = await cancelBooking(token);
  return (
    (await fetchBusinessBookingById(businessId, cancelled.id, db)) ?? sanitizeBooking(cancelled)
  );
}
