/**
 * Onboarding setup-request lifecycle (managed vs self-configuration).
 *
 * Kivo is a managed service with an optional self-configuration path.
 * After signup + business basics the owner chooses "Set it up for me"
 * (managed) or "I'll configure it now" (self). That choice and the
 * follow-up lifecycle live in `setup_requests` (migration 0018) — one row
 * per business, upserted so refresh/retry can never duplicate a lead.
 *
 * Businesses WITHOUT a row are existing/production tenants and are
 * treated as `live` by absence. Nothing here may reclassify them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/server";
import { ApiError } from "@/lib/server/errors";
import {
  SETUP_PREFERENCES,
  SETUP_STATUSES,
  type SetupPreference,
  type SetupStatus,
} from "@/lib/setup-status";
import { generateAttemptId, recordEvent } from "@/lib/server/operations/events";
import { notificationProvider } from "@/lib/server/notifications/config";
import { resolveNotificationProvider } from "@/lib/server/notifications/providers";
import { toE164 } from "@/lib/notifications/phone";
import { CONTACT_WHATSAPP } from "@/lib/marketing-config";

type DbLike = Pick<SupabaseClient, "from">;

function serviceDb(db?: DbLike): SupabaseClient {
  return (db ?? getSupabase()) as SupabaseClient;
}

export { SETUP_PREFERENCES, SETUP_STATUSES };
export type { SetupPreference, SetupStatus };

export interface SetupRequestRow {
  business_id: string;
  user_id: string;
  business_type: string | null;
  contact_phone: string | null;
  preference: SetupPreference | null;
  status: SetupStatus;
  created_at: string;
  updated_at: string;
}

export interface SetupRequestWithBusiness extends SetupRequestRow {
  business_name: string;
  business_slug: string | null;
  booking_mode: string;
  business_is_active: boolean;
}

function mapSetupRow(row: Record<string, unknown>): SetupRequestRow {
  const preference =
    row.preference === "managed" || row.preference === "self"
      ? (row.preference as SetupPreference)
      : null;
  return {
    business_id: String(row.business_id),
    user_id: String(row.user_id),
    business_type:
      typeof row.business_type === "string" ? row.business_type : null,
    contact_phone:
      typeof row.contact_phone === "string" ? row.contact_phone : null,
    preference,
    status: SETUP_STATUSES.includes(row.status as SetupStatus)
      ? (row.status as SetupStatus)
      : "new",
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** The setup lead for one business, or null (existing/live business). */
export async function getSetupRequest(
  businessId: string,
  db?: DbLike,
): Promise<SetupRequestRow | null> {
  const { data, error } = await serviceDb(db)
    .from("setup_requests")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error || !data) return null;
  return mapSetupRow(data as Record<string, unknown>);
}

/**
 * Creates (or refreshes the timestamp of) the lead row for a business.
 * Safe to call on every basics submit — the PRIMARY KEY makes it
 * idempotent and it never overwrites an owner's recorded choice.
 */
export async function ensureSetupRequest(
  businessId: string,
  userId: string,
  db?: DbLike,
): Promise<SetupRequestRow> {
  const existing = await getSetupRequest(businessId, db);
  if (existing) return existing;
  const { data, error } = await serviceDb(db)
    .from("setup_requests")
    .upsert(
      { business_id: businessId, user_id: userId, status: "new" },
      { onConflict: "business_id" },
    )
    .select("*")
    .maybeSingle();
  if (error || !data) {
    throw new ApiError(
      500,
      "INTERNAL",
      "We couldn't start your setup. Please try again.",
    );
  }
  return mapSetupRow(data as Record<string, unknown>);
}

export interface SetupRequestPatch {
  businessType?: string | null;
  contactPhone?: string | null;
  preference?: SetupPreference | null;
  status?: SetupStatus;
}

/** Partial update of a lead row (always bumps updated_at). */
export async function updateSetupRequest(
  businessId: string,
  patch: SetupRequestPatch,
  db?: DbLike,
): Promise<SetupRequestRow> {
  if (patch.status !== undefined && !SETUP_STATUSES.includes(patch.status)) {
    throw new ApiError(400, "VALIDATION", "That setup status isn't valid.");
  }
  if (patch.preference !== undefined && patch.preference !== null && !SETUP_PREFERENCES.includes(patch.preference)) {
    throw new ApiError(
      400,
      "VALIDATION",
      "Please choose how you'd like to set up Kivo.",
    );
  }
  const { data, error } = await serviceDb(db)
    .from("setup_requests")
    .update({
      ...(patch.businessType !== undefined ? { business_type: patch.businessType } : {}),
      ...(patch.contactPhone !== undefined ? { contact_phone: patch.contactPhone } : {}),
      ...(patch.preference !== undefined ? { preference: patch.preference } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    throw new ApiError(
      500,
      "INTERNAL",
      "We couldn't save your setup choice. Please try again.",
    );
  }
  return mapSetupRow(data as Record<string, unknown>);
}

/** Global lead list for the platform admin (newest first). */
export async function listSetupRequests(
  db?: DbLike,
): Promise<SetupRequestWithBusiness[]> {
  const client = serviceDb(db);
  const { data, error } = await client
    .from("setup_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !Array.isArray(data)) return [];
  const rows = (data as Array<Record<string, unknown>>).map(mapSetupRow);
  const businessIds = [...new Set(rows.map((row) => row.business_id))];
  if (businessIds.length === 0) return [];
  const { data: businesses, error: businessError } = await client
    .from("businesses")
    .select("id, name, slug, booking_mode, is_active")
    .in("id", businessIds);
  const byId = new Map<string, Record<string, unknown>>();
  if (!businessError && Array.isArray(businesses)) {
    for (const business of businesses as Array<Record<string, unknown>>) {
      byId.set(String(business.id), business);
    }
  }
  return rows.map((row) => {
    const business = byId.get(row.business_id) ?? {};
    return {
      ...row,
      business_name: typeof business.name === "string" ? business.name : "",
      business_slug: typeof business.slug === "string" ? business.slug : null,
      booking_mode: typeof business.booking_mode === "string" ? business.booking_mode : "",
      business_is_active: business.is_active === true,
    };
  });
}

/**
 * Targeted business-field writes for the onboarding lifecycle.
 * updateBusinessProfile rewrites the whole profile, which doesn't fit
 * activation flips or contact confirmation — these set exactly one
 * column. Always called behind ownership/admin authorization in routes.
 */
export async function setBusinessActive(
  businessId: string,
  active: boolean,
  db?: DbLike,
): Promise<void> {
  const { error } = await serviceDb(db)
    .from("businesses")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", businessId);
  if (error) {
    throw new ApiError(
      500,
      "INTERNAL",
      "We couldn't update the business. Please try again.",
    );
  }
}

export async function setBusinessPhone(
  businessId: string,
  phone: string | null,
  db?: DbLike,
): Promise<void> {
  const { error } = await serviceDb(db)
    .from("businesses")
    .update({ phone, updated_at: new Date().toISOString() })
    .eq("id", businessId);
  if (error) {
    throw new ApiError(
      500,
      "INTERNAL",
      "We couldn't save the contact number. Please try again.",
    );
  }
}

/**
 * Best-effort operations telemetry for onboarding steps. Never throws and
 * never carries contact PII — the admin reads contact details from the
 * lead table, not from events.
 */
export function trackSetupEvent(
  eventName: string,
  businessId: string,
  metadata?: Record<string, unknown>,
): void {
  void recordEvent({
    eventName,
    category: "funnel",
    businessId,
    attemptId: generateAttemptId(),
    metadata: metadata ?? {},
  });
}

export interface OperatorSetupAlert {
  businessId: string;
  businessName: string;
  businessType: string | null;
  preference: SetupPreference;
  contactPhone: string | null;
}

/**
 * Notifies the Kivo operator about a new setup request over WhatsApp.
 *
 * Uses the global notification provider and the central operator contact
 * (KIVO_CONTACT_WHATSAPP) — never a business provider setting and never a
 * hard-coded number. Best-effort: returns false (no throw) when the
 * operator contact or provider is unconfigured, in which case the admin
 * leads page remains the reliable visibility path.
 */
export async function notifyOperatorOfSetupRequest(
  alert: OperatorSetupAlert,
): Promise<boolean> {
  try {
    if (!CONTACT_WHATSAPP) return false;
    if (notificationProvider() === "none") return false;
    const destination = toE164(CONTACT_WHATSAPP);
    const preferenceLabel =
      alert.preference === "managed" ? "Set it up for me" : "Configure it now";
    const lines = [
      `New Kivo setup request: ${alert.businessName}`,
      alert.businessType ? `Type: ${alert.businessType}` : null,
      `Choice: ${preferenceLabel}`,
      alert.contactPhone ? `Contact: ${alert.contactPhone}` : null,
    ].filter((line): line is string => line !== null);
    const result = await resolveNotificationProvider().send({
      destination,
      body: lines.join("\n"),
      eventId: `setup-request:${alert.businessId}:${alert.preference}`,
      bookingId: "",
      businessId: alert.businessId,
      recipientType: "business",
    });
    return result.success === true;
  } catch {
    return false;
  }
}
