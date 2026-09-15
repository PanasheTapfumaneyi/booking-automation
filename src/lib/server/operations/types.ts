/**
 * Operations monitoring types for Kivo.
 *
 * Privacy-conscious: no passwords, tokens, OAuth credentials, or
 * unnecessary customer PII are stored in events.
 */

// ---------------------------------------------------------------------------
// Event categories
// ---------------------------------------------------------------------------

export type EventCategory =
  | "funnel"
  | "failure"
  | "notification"
  | "calendar"
  | "reminder"
  | "system";

export type FailureSeverity = "expected" | "technical";

// ---------------------------------------------------------------------------
// Funnel events
// ---------------------------------------------------------------------------

export type FunnelEventName =
  | "business_page_viewed"
  | "booking_started"
  | "offering_selected"
  | "date_selected"
  | "time_selected"
  | "customer_details_started"
  | "booking_submit_attempted"
  | "booking_created"
  | "booking_failed"
  | "manage_booking_opened"
  | "reschedule_attempted"
  | "reschedule_completed"
  | "reschedule_failed"
  | "cancellation_attempted"
  | "cancellation_completed"
  | "cancellation_failed";

// ---------------------------------------------------------------------------
// Failure error codes (safe, stable, never raw exceptions)
// ---------------------------------------------------------------------------

/** Expected business/validation conditions — not platform outages. */
export type ExpectedErrorCode =
  | "BOOKING_CONFLICT"
  | "SLOT_UNAVAILABLE"
  | "RESOURCE_UNAVAILABLE"
  | "SESSION_FULL"
  | "INVALID_INPUT"
  | "PAST_TIME"
  | "BOOKING_CLOSED"
  | "SERVICE_NOT_FOUND"
  | "CANCELLED_ALREADY";

/** Unexpected/technical failures — indicate real problems. */
export type TechnicalErrorCode =
  | "DATABASE_ERROR"
  | "INTERNAL_ERROR"
  | "UNKNOWN_FAILURE"
  | "PROVIDER_FAILURE"
  | "CALENDAR_SYNC_FAILED"
  | "NOTIFICATION_FAILED";

export type ErrorCode = ExpectedErrorCode | TechnicalErrorCode;

// ---------------------------------------------------------------------------
// Event creation
// ---------------------------------------------------------------------------

export interface CreateEventInput {
  eventName: FunnelEventName | string;
  category: EventCategory;
  businessId?: string;
  bookingId?: string;
  attemptId: string;
  severity?: FailureSeverity;
  errorCode?: ErrorCode;
  provider?: string;
  metadata?: Record<string, unknown>;
}

export interface OperationsEvent {
  id: string;
  event_name: string;
  category: EventCategory;
  business_id: string | null;
  booking_id: string | null;
  attempt_id: string;
  severity: FailureSeverity | null;
  error_code: string | null;
  provider: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Dashboard queries
// ---------------------------------------------------------------------------

export interface OperationsSummary {
  period: string;
  bookingAttempts: number;
  submitAttempts: number;
  bookingsCreated: number;
  bookingsFailed: number;
  expectedConflicts: number;
  technicalFailures: number;
  submitSuccessRate: number;
  notificationsSent: number;
  notificationsFailed: number;
  calendarSyncsSuccessful: number;
  calendarSyncsFailed: number;
  remindersDue: number;
  remindersSent: number;
  remindersFailed: number;
}

export interface BusinessHealth {
  businessId: string;
  businessName: string;
  bookingAttempts: number;
  submitAttempts: number;
  completed: number;
  technicalFailures: number;
  notificationFailures: number;
  calendarFailures: number;
}

export interface FunnelStep {
  step: string;
  count: number;
  percentage: number;
}

export interface RecentFailure {
  id: string;
  timestamp: string;
  businessId: string | null;
  businessName: string | null;
  eventName: string;
  errorCode: string | null;
  category: EventCategory;
  severity: FailureSeverity | null;
  provider: string | null;
  metadata: Record<string, unknown>;
}
