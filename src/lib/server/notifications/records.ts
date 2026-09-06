/**
 * Persistence for notification records and per-business settings.
 *
 * All mutations go through the server-only Supabase client (service role),
 * bypassing RLS. The same `DbLike` seam used by the Phase 3 layer lets tests
 * run against an in-memory stand-in.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/server";
import type {
  BookingNotificationEventType,
  BusinessNotificationSettings,
  NotificationErrorCode,
  NotificationRecord,
  NotificationRecipientType,
  NotificationStatus,
} from "@/lib/notifications/types";

export type DbLike = Pick<SupabaseClient, "from">;

function resolveDb(db?: DbLike): DbLike {
  return db ?? getSupabase();
}

function mapRecord(row: unknown): NotificationRecord {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    event_id: r.event_id as string,
    business_id: r.business_id as string,
    booking_id: r.booking_id as string,
    customer_id: (r.customer_id as string | null) ?? null,
    event_type: r.event_type as BookingNotificationEventType,
    recipient_type: r.recipient_type as NotificationRecipientType,
    channel: "whatsapp",
    destination: r.destination as string,
    status: r.status as NotificationStatus,
    provider: r.provider as string,
    provider_message_id: (r.provider_message_id as string | null) ?? null,
    attempt_count: Number(r.attempt_count ?? 0),
    error_code: (r.error_code as NotificationErrorCode | null) ?? null,
    error_message: (r.error_message as string | null) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    sent_at: (r.sent_at as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

export async function fetchNotificationRecord(
  key: { eventId: string; recipientType: NotificationRecipientType; channel: string },
  db?: DbLike,
): Promise<NotificationRecord | null> {
  const client = resolveDb(db);
  const { data, error } = await client
    .from("notifications")
    .select("*")
    .eq("event_id", key.eventId)
    .eq("recipient_type", key.recipientType)
    .eq("channel", key.channel)
    .maybeSingle();
  if (error || !data) return null;
  return mapRecord(data);
}

export async function fetchNotificationRecordById(
  id: string,
  db?: DbLike,
): Promise<NotificationRecord | null> {
  const client = resolveDb(db);
  const { data, error } = await client
    .from("notifications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapRecord(data);
}

export interface CreateNotificationRecordInput {
  eventId: string;
  bookingId: string;
  businessId: string;
  customerId?: string | null;
  eventType: BookingNotificationEventType;
  recipientType: NotificationRecipientType;
  channel: "whatsapp";
  destination: string;
  status: NotificationStatus;
  provider: string;
  metadata?: Record<string, unknown>;
}

/**
 * Inserts a delivery record. Respects the (event_id, recipient_type, channel)
 * idempotency guard: a concurrent duplicate insert returns `created: false`
 * instead of erroring.
 */
export async function createNotificationRecord(
  input: CreateNotificationRecordInput,
  db?: DbLike,
): Promise<{ created: boolean; id?: string }> {
  const client = resolveDb(db);
  const { data, error } = await client.from("notifications").insert({
    event_id: input.eventId,
    booking_id: input.bookingId,
    business_id: input.businessId,
    customer_id: input.customerId ?? null,
    event_type: input.eventType,
    recipient_type: input.recipientType,
    channel: input.channel,
    destination: input.destination,
    status: input.status,
    provider: input.provider,
    attempt_count: input.status === "processing" ? 1 : 0,
    metadata: input.metadata ?? {},
  }).select("id").single();
  if (error) {
    if (error.code === "23505") return { created: false };
    throw error;
  }
  return { created: true, id: (data as { id?: string })?.id };
}

export interface NotificationStatusPatch {
  status: NotificationStatus;
  providerMessageId?: string | null;
  errorCode?: NotificationErrorCode | null;
  errorMessage?: string | null;
  sentAt?: string | null;
}

export async function updateNotificationRecord(
  id: string,
  patch: NotificationStatusPatch,
  db?: DbLike,
): Promise<void> {
  const client = resolveDb(db);
  const fields: Record<string, unknown> = {
    status: patch.status,
    updated_at: new Date().toISOString(),
  };
  if (patch.providerMessageId !== undefined) {
    fields.provider_message_id = patch.providerMessageId;
  }
  if (patch.errorCode !== undefined) {
    fields.error_code = patch.errorCode;
    fields.error_message = patch.errorMessage ?? null;
  }
  if (patch.sentAt !== undefined) fields.sent_at = patch.sentAt;
  const { error } = await client.from("notifications").update(fields).eq("id", id);
  if (error) {
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Per-business settings
// ---------------------------------------------------------------------------

/** Defaults used when no settings row exists (feature enabled, no owner phone). */
export const DEFAULT_NOTIFICATION_SETTINGS: Omit<BusinessNotificationSettings, "created_at" | "updated_at"> = {
  business_id: "",
  customer_notifications_enabled: true,
  business_notifications_enabled: true,
  whatsapp_enabled: true,
  business_notification_phone: null,
};

function mapSettings(row: unknown): BusinessNotificationSettings {
  const r = row as Record<string, unknown>;
  return {
    business_id: r.business_id as string,
    customer_notifications_enabled: r.customer_notifications_enabled as boolean,
    business_notifications_enabled: r.business_notifications_enabled as boolean,
    whatsapp_enabled: r.whatsapp_enabled as boolean,
    business_notification_phone: (r.business_notification_phone as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

/**
 * Loads the settings for a business. Missing rows resolve to defaults — a
 * business that has never been configured still receives notifications once a
 * provider is enabled.
 */
export async function fetchBusinessNotificationSettings(
  businessId: string,
  db?: DbLike,
): Promise<BusinessNotificationSettings> {
  const client = resolveDb(db);
  const { data, error } = await client
    .from("business_notification_settings")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error || !data) {
    return { ...DEFAULT_NOTIFICATION_SETTINGS, business_id: businessId, created_at: "", updated_at: "" };
  }
  return mapSettings(data);
}

export interface UpdateNotificationSettingsInput {
  customerNotificationsEnabled?: boolean;
  businessNotificationsEnabled?: boolean;
  whatsappEnabled?: boolean;
  businessNotificationPhone?: string | null;
}

/**
 * Server-only helper used by the owner to configure the business WhatsApp
 * destination. No public/unauth route exposes this.
 */
export async function upsertBusinessNotificationSettings(
  businessId: string,
  input: UpdateNotificationSettingsInput,
  db?: DbLike,
): Promise<void> {
  const client = resolveDb(db);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.customerNotificationsEnabled !== undefined) {
    patch.customer_notifications_enabled = input.customerNotificationsEnabled;
  }
  if (input.businessNotificationsEnabled !== undefined) {
    patch.business_notifications_enabled = input.businessNotificationsEnabled;
  }
  if (input.whatsappEnabled !== undefined) {
    patch.whatsapp_enabled = input.whatsappEnabled;
  }
  if (input.businessNotificationPhone !== undefined) {
    patch.business_notification_phone = input.businessNotificationPhone;
  }
  const { error } = await client
    .from("business_notification_settings")
    .upsert({ business_id: businessId, ...patch });
  if (error) throw error;
}