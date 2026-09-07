/**
 * Business management service (Phase 6A).
 *
 * Pure business logic for onboarding + settings. Every function takes an
 * explicit db handle and performs NO auth checks — routes enforce ownership
 * first via requireBusinessOwner, and RLS mirrors the rule in the database.
 * Uses the service-role client passed in (server-only).
 */
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/server/errors";
import type { BookingMode } from "@/types/booking";
import {
  parseBusinessHours,
  InvalidHoursError,
  type BusinessHours,
} from "@/lib/availability/hours";
import { isNotifiablePhone } from "@/lib/notifications/phone";
import { upsertBusinessNotificationSettings } from "@/lib/server/notifications/records";

type DbLike = Pick<SupabaseClient, "from" | "rpc">;

const BUSINESS_NAME_MAX = 80;
const SLUG_MAX = 60;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** URL-safe slug base derived from a business name. */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "business";
}

function randomSuffix(): string {
  return randomBytes(2).toString("hex");
}

/** Returns a slug that does not collide (suffix retries, then throws). */
export async function ensureUniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const clean = base.length > 0 ? base.slice(0, SLUG_MAX) : "business";
  if (!(await exists(clean))) return clean;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${clean.slice(0, SLUG_MAX - 5)}-${randomSuffix()}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new ApiError(
    500,
    "INTERNAL",
    "We couldn't pick a booking link for this business. Please try again.",
  );
}

export function validateSlug(slug: string): string {
  const clean = slug.trim().toLowerCase().slice(0, SLUG_MAX);
  if (!SLUG_RE.test(clean)) {
    throw new ApiError(
      400,
      "VALIDATION",
      "The booking link may only contain lowercase letters, numbers and hyphens.",
    );
  }
  return clean;
}

/** Throws 400 VALIDATION on bad timezone ids. */
export function validateTimezone(timezone: string): string {
  const tz = timezone.trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
  } catch {
    throw new ApiError(400, "VALIDATION", "That timezone isn't recognized.");
  }
  return tz;
}

export function validateBookingMode(mode: string): BookingMode {
  if (mode === "appointment" || mode === "resource" || mode === "capacity") {
    return mode;
  }
  throw new ApiError(400, "VALIDATION", "Please choose a booking type.");
}

export interface BusinessProfileInput {
  name: string;
  phone?: string | null;
  timezone?: string;
}

/** Shared profile validation for onboarding + settings edits. */
export function validateBusinessProfile(input: BusinessProfileInput): {
  name: string;
  phone: string | null;
  timezone: string;
} {
  const name = (input.name ?? "").trim();
  if (name.length < 2 || name.length > BUSINESS_NAME_MAX) {
    throw new ApiError(
      400,
      "VALIDATION",
      "Please give your business a name (2–80 characters).",
    );
  }
  const phone = (input.phone ?? "").trim();
  if (phone.length > 30) {
    throw new ApiError(400, "VALIDATION", "That phone number looks too long.");
  }
  return {
    name,
    phone: phone.length > 0 ? phone : null,
    timezone: validateTimezone(input.timezone ?? "Indian/Mauritius"),
  };
}

export function parseHoursOrThrow(input: unknown): BusinessHours | null {
  try {
    return parseBusinessHours(input);
  } catch (err) {
    if (err instanceof InvalidHoursError) {
      throw new ApiError(400, "VALIDATION", err.message);
    }
    throw err;
  }
}

/**
 * Owner WhatsApp destination: null/empty clears it, anything else must be
 * dialable. Throws 400 VALIDATION otherwise.
 */
export function parseNotificationPhone(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "string") {
    throw new ApiError(400, "VALIDATION", "Invalid phone number.");
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (!isNotifiablePhone(trimmed)) {
    throw new ApiError(400, "VALIDATION", "That phone number can't receive WhatsApp messages.");
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Onboarding: business + owner membership + default settings (with cleanup)
// ---------------------------------------------------------------------------

export interface CreateBusinessInput extends BusinessProfileInput {
  booking_mode: string;
}

export interface CreatedBusiness {
  id: string;
  slug: string;
}

/**
 * Creates a business, its owner membership, and default notification
 * settings. If a later step fails, the business row is removed again so a
 * half-onboarded business never lingers (cascades wipe the membership).
 */
export async function createBusinessWithOwner(
  userId: string,
  input: CreateBusinessInput,
  db: DbLike,
): Promise<CreatedBusiness> {
  const profile = validateBusinessProfile(input);
  const bookingMode = validateBookingMode(input.booking_mode);
  const client = db as SupabaseClient;

  const exists = async (slug: string): Promise<boolean> => {
    const { data } = await client
      .from("businesses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    return Boolean(data);
  };
  const slug = await ensureUniqueSlug(slugify(profile.name), exists);

  const { data: created, error: createError } = await client
    .from("businesses")
    .insert({
      name: profile.name,
      phone: profile.phone,
      timezone: profile.timezone,
      booking_mode: bookingMode,
      slug,
    })
    .select("id, slug")
    .single();
  if (createError || !created) {
    throw new ApiError(500, "INTERNAL", "We couldn't create your business. Please try again.");
  }
  const businessId = (created as { id: string }).id;

  try {
    const { error: memberError } = await client.from("business_members").insert({
      business_id: businessId,
      user_id: userId,
      role: "owner",
    });
    if (memberError) throw memberError;
    await upsertBusinessNotificationSettings(businessId, {}, db);
  } catch (err) {
    await client.from("businesses").delete().eq("id", businessId);
    throw err instanceof ApiError
      ? err
      : new ApiError(500, "INTERNAL", "We couldn't finish setting up your business. Please try again.");
  }

  return {
    id: businessId,
    slug: (created as { slug: string }).slug ?? slug,
  };
}

// ---------------------------------------------------------------------------
// Settings reads/writes (routes check ownership first)
// ---------------------------------------------------------------------------

export interface BusinessSettingsBundle {
  business: {
    id: string;
    name: string;
    phone: string | null;
    timezone: string;
    booking_mode: BookingMode;
    slug: string | null;
    availability: BusinessHours | null;
  };
}

/** Safe business columns for owner UI — no secrets exist on this table. */
export async function getBusinessSettings(
  businessId: string,
  db: DbLike,
): Promise<BusinessSettingsBundle> {
  const client = db as SupabaseClient;
  const { data, error } = await client
    .from("businesses")
    .select("id, name, phone, timezone, booking_mode, slug, availability")
    .eq("id", businessId)
    .maybeSingle();
  if (error || !data) {
    throw new ApiError(404, "BOOKING_NOT_FOUND", "Business not found.");
  }
  const row = data as Record<string, unknown>;
  let availability: BusinessHours | null = null;
  try {
    availability = parseBusinessHours(row.availability ?? null);
  } catch {
    availability = null;
  }
  return {
    business: {
      id: row.id as string,
      name: row.name as string,
      phone: (row.phone as string | null) ?? null,
      timezone: row.timezone as string,
      booking_mode: row.booking_mode as BookingMode,
      slug: (row.slug as string | null) ?? null,
      availability,
    },
  };
}

export interface UpdateBusinessProfileInput extends BusinessProfileInput {
  availability?: unknown;
}

/**
 * Edits profile + hours. booking_mode is deliberately NOT editable here —
 * switching modes after bookings exist would break engine assumptions.
 */
export async function updateBusinessProfile(
  businessId: string,
  input: UpdateBusinessProfileInput,
  db: DbLike,
): Promise<void> {
  const profile = validateBusinessProfile(input);
  const availability =
    input.availability === undefined ? undefined : parseHoursOrThrow(input.availability);
  const client = db as SupabaseClient;
  const patch: Record<string, unknown> = {
    name: profile.name,
    phone: profile.phone,
    timezone: profile.timezone,
    updated_at: new Date().toISOString(),
  };
  if (availability !== undefined) patch.availability = availability;
  const { error } = await client.from("businesses").update(patch).eq("id", businessId);
  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't save your changes. Please try again.");
  }
}

// ---------------------------------------------------------------------------
// Offering reads (safe columns only — no customer or booking data)
// ---------------------------------------------------------------------------

export interface ServiceSummary {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  active: boolean;
}

export async function listServices(businessId: string, db: DbLike): Promise<ServiceSummary[]> {
  const client = db as SupabaseClient;
  const { data, error } = await client
    .from("services")
    .select("id, name, duration_minutes, price, active")
    .eq("business_id", businessId);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    duration_minutes: s.duration_minutes as number,
    price: Number(s.price ?? 0),
    active: Boolean(s.active),
  }));
}

export interface ResourceSummary {
  id: string;
  name: string;
  resource_type: string;
  active: boolean;
}

export async function listResources(businessId: string, db: DbLike): Promise<ResourceSummary[]> {
  const client = db as SupabaseClient;
  const { data, error } = await client
    .from("resources")
    .select("id, name, resource_type, active")
    .eq("business_id", businessId);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    resource_type: (r.resource_type as string) ?? "generic",
    active: Boolean(r.active),
  }));
}

export interface SessionSummary {
  id: string;
  service_id: string;
  service_name: string | null;
  start_time: string;
  end_time: string | null;
  capacity: number;
  active: boolean;
}

export async function listSessions(businessId: string, db: DbLike): Promise<SessionSummary[]> {
  const client = db as SupabaseClient;
  const { data, error } = await client
    .from("booking_sessions")
    .select("id, service_id, start_time, end_time, capacity, active, service:services(name)")
    .eq("business_id", businessId);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((s) => ({
    id: s.id as string,
    service_id: s.service_id as string,
    service_name: ((s.service ?? {}) as Record<string, unknown>).name as string | null ?? null,
    start_time: s.start_time as string,
    end_time: (s.end_time as string | null) ?? null,
    capacity: s.capacity as number,
    active: Boolean(s.active),
  }));
}

// ---------------------------------------------------------------------------
// Offering: services / resources / sessions (routes check ownership first)
// ---------------------------------------------------------------------------

export interface CreateServiceInput {
  name: string;
  duration_minutes: number;
  price?: number;
}

export async function createService(
  businessId: string,
  input: CreateServiceInput,
  db: DbLike,
): Promise<{ id: string }> {
  const name = (input.name ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    throw new ApiError(400, "VALIDATION", "Please name the service (2–80 characters).");
  }
  const duration = Math.floor(Number(input.duration_minutes));
  if (!Number.isFinite(duration) || duration <= 0 || duration > 24 * 60) {
    throw new ApiError(400, "VALIDATION", "Duration must be between 1 and 1440 minutes.");
  }
  const price = input.price === undefined ? 0 : Number(input.price);
  if (!Number.isFinite(price) || price < 0) {
    throw new ApiError(400, "VALIDATION", "Price can't be negative.");
  }
  const client = db as SupabaseClient;
  const { data, error } = await client
    .from("services")
    .insert({ business_id: businessId, name, duration_minutes: duration, price, active: true })
    .select("id")
    .single();
  if (error || !data) {
    throw new ApiError(500, "INTERNAL", "We couldn't add that service. Please try again.");
  }
  return { id: (data as { id: string }).id };
}

export interface UpdateServiceInput {
  name?: string;
  duration_minutes?: number;
  price?: number;
  active?: boolean;
}

export async function updateService(
  businessId: string,
  serviceId: string,
  input: UpdateServiceInput,
  db: DbLike,
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 80) {
      throw new ApiError(400, "VALIDATION", "Please name the service (2–80 characters).");
    }
    patch.name = name;
  }
  if (input.duration_minutes !== undefined) {
    const duration = Math.floor(Number(input.duration_minutes));
    if (!Number.isFinite(duration) || duration <= 0 || duration > 24 * 60) {
      throw new ApiError(400, "VALIDATION", "Duration must be between 1 and 1440 minutes.");
    }
    patch.duration_minutes = duration;
  }
  if (input.price !== undefined) {
    const price = Number(input.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new ApiError(400, "VALIDATION", "Price can't be negative.");
    }
    patch.price = price;
  }
  if (input.active !== undefined) patch.active = Boolean(input.active);
  const client = db as SupabaseClient;
  const { data, error } = await client
    .from("services")
    .update(patch)
    .eq("id", serviceId)
    .eq("business_id", businessId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    throw new ApiError(404, "SERVICE_NOT_FOUND", "That service wasn't found.");
  }
}

export async function createResource(
  businessId: string,
  input: { name: string },
  db: DbLike,
): Promise<{ id: string }> {
  const name = (input.name ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    throw new ApiError(400, "VALIDATION", "Please name the resource (2–80 characters).");
  }
  const client = db as SupabaseClient;
  const { data, error } = await client
    .from("resources")
    .insert({ business_id: businessId, name, active: true })
    .select("id")
    .single();
  if (error || !data) {
    throw new ApiError(500, "INTERNAL", "We couldn't add that resource. Please try again.");
  }
  return { id: (data as { id: string }).id };
}

export async function updateResource(
  businessId: string,
  resourceId: string,
  input: { name?: string; active?: boolean },
  db: DbLike,
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 80) {
      throw new ApiError(400, "VALIDATION", "Please name the resource (2–80 characters).");
    }
    patch.name = name;
  }
  if (input.active !== undefined) patch.active = Boolean(input.active);
  const client = db as SupabaseClient;
  const { data, error } = await client
    .from("resources")
    .update(patch)
    .eq("id", resourceId)
    .eq("business_id", businessId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    throw new ApiError(404, "RESOURCE_NOT_FOUND", "That resource wasn't found.");
  }
}

export interface CreateSessionInput {
  service_id: string;
  start_time: string;
  end_time?: string | null;
  capacity: number;
}

export async function createSession(
  businessId: string,
  input: CreateSessionInput,
  db: DbLike,
): Promise<{ id: string }> {
  const client = db as SupabaseClient;
  const { data: service, error: serviceError } = await client
    .from("services")
    .select("id")
    .eq("id", input.service_id)
    .eq("business_id", businessId)
    .maybeSingle();
  if (serviceError || !service) {
    throw new ApiError(400, "VALIDATION", "Please choose one of your services for this session.");
  }
  const start = new Date(input.start_time);
  if (!Number.isFinite(start.getTime())) {
    throw new ApiError(400, "VALIDATION", "Please choose a valid session start time.");
  }
  let end: Date | null = null;
  if (input.end_time) {
    end = new Date(input.end_time);
    if (!Number.isFinite(end.getTime()) || end.getTime() <= start.getTime()) {
      throw new ApiError(400, "VALIDATION", "The session end must be after its start.");
    }
  }
  const capacity = Math.floor(Number(input.capacity));
  if (!Number.isFinite(capacity) || capacity <= 0) {
    throw new ApiError(400, "VALIDATION", "Capacity must be at least 1 guest.");
  }
  const { data, error } = await client
    .from("booking_sessions")
    .insert({
      business_id: businessId,
      service_id: input.service_id,
      start_time: start.toISOString(),
      end_time: end ? end.toISOString() : null,
      capacity,
      active: true,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new ApiError(500, "INTERNAL", "We couldn't add that session. Please try again.");
  }
  return { id: (data as { id: string }).id };
}

export async function setSessionActive(
  businessId: string,
  sessionId: string,
  active: boolean,
  db: DbLike,
): Promise<void> {
  const client = db as SupabaseClient;
  const { data, error } = await client
    .from("booking_sessions")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("business_id", businessId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    throw new ApiError(404, "SESSION_NOT_FOUND", "That session wasn't found.");
  }
}
