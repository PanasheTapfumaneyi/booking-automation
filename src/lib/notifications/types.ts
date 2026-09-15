/**
 * Shared notification domain types (pure, no imports).
 *
 * The booking service speaks in events; the notification service persists one
 * delivery record per (event, recipient, channel) and hands canonical
 * E.164 destinations to a transport-agnostic provider. Providers are swappable
 * (OpenWA today, Meta Cloud API later) without booking logic knowing anything
 * about them. Transports are additive: OpenWA stays available for rollback
 * while Baileys is the current pilot transport.
 */
import { randomUUID } from "node:crypto";

export type NotificationChannel = "whatsapp";

export type NotificationRecipientType = "customer" | "business";

export type NotificationStatus =
  | "pending" // created, not yet attempted
  | "processing" // attempt in flight
  | "sent" // provider accepted the message
  | "failed" // provider rejected / unreachable (booking outcome unaffected)
  | "skipped"; // recipient intentionally not notified (disabled / no destination)

/** Timed reminder events — exactly ONE per booking: 1 hour before start. */
export type BookingReminderType = "booking.reminder.1h";

/** Event-driven booking events (Phase 4 confirmations). */
export type BookingEventType =
  | "booking.created"
  | "booking.rescheduled"
  | "booking.cancelled";

export type BookingNotificationEventType = BookingEventType | BookingReminderType;

export type NotificationErrorCode =
  | "OPENWA_UNAVAILABLE"
  | "OPENWA_AUTH_FAILED"
  | "OPENWA_SESSION_NOT_READY"
  | "OPENWA_SEND_FAILED"
  | "BAILEYS_UNAVAILABLE"
  | "BAILEYS_AUTH_FAILED"
  | "BAILEYS_SESSION_NOT_READY"
  | "BAILEYS_SEND_FAILED"
  | "INVALID_PHONE";

/** Normalized outcome of a single provider send attempt. */
export interface NotificationSendResult {
  success: boolean;
  /** Provider-side message id when known. */
  providerMessageId?: string;
  /** True when a later retry may succeed (transient failure). */
  retryable?: boolean;
  errorCode?: NotificationErrorCode;
}

/** What a provider receives. `destination` is always canonical E.164. */
export interface NotificationMessage {
  destination: string;
  body: string;
  eventId: string;
  bookingId: string;
  businessId: string;
  recipientType: NotificationRecipientType;
}

/** A provider health snapshot (safe to expose — never contains credentials). */
export interface ProviderHealth {
  configured: boolean;
  reachable: boolean | null;
  sessionReady: boolean | null;
}

/**
 * Transport-agnostic messaging boundary. Implementations must never leak
 * secrets into return values or throw — every failure becomes a normalized
 * `NotificationSendResult`.
 */
export interface NotificationProvider {
  readonly name: string;
  send(input: NotificationMessage): Promise<NotificationSendResult>;
  health(): Promise<ProviderHealth>;
}

/** A notification record as read from the `notifications` table. */
export interface NotificationRecord {
  id: string;
  event_id: string;
  business_id: string;
  booking_id: string;
  customer_id: string | null;
  event_type: BookingNotificationEventType;
  recipient_type: NotificationRecipientType;
  channel: NotificationChannel;
  destination: string;
  status: NotificationStatus;
  provider: string;
  provider_message_id: string | null;
  attempt_count: number;
  error_code: NotificationErrorCode | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Persisted per-business notification preferences. */
export interface BusinessNotificationSettings {
  business_id: string;
  customer_notifications_enabled: boolean;
  business_notifications_enabled: boolean;
  whatsapp_enabled: boolean;
  business_notification_phone: string | null;
  created_at: string;
  updated_at: string;
}

/** ID of the event that triggered a delivery (unique per operation). */
export function generateEventId(): string {
  return randomUUID();
}