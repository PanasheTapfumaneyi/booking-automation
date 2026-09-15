/**
 * Lightweight first-party funnel event tracker. Privacy-conscious:
 * - No customer PII is sent.
 * - Only booking-flow progression events are tracked.
 * - Events are fire-and-forget (never block navigation).
 */

let _attemptId: string | null = null;

/** Get or create the anonymous attempt ID for this booking session. */
export function getAttemptId(): string {
  if (!_attemptId) {
    _attemptId = `attempt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return _attemptId;
}

/** Reset the attempt ID (e.g., when starting a new booking). */
export function resetAttemptId(): void {
  _attemptId = null;
}

interface TrackEventInput {
  eventName: string;
  businessId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Track a funnel event. Fire-and-forget: failures are silently ignored.
 * Never sends customer PII.
 */
export function trackFunnelEvent(input: TrackEventInput): void {
  try {
    const body = JSON.stringify({
      eventName: input.eventName,
      businessId: input.businessId,
      attemptId: getAttemptId(),
      metadata: input.metadata,
    });

    // Use sendBeacon for reliable delivery during page unload.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/events",
        new Blob([body], { type: "application/json" }),
      );
    } else {
      // Fallback: fetch (fire-and-forget).
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        // Silently ignore failures.
      });
    }
  } catch {
    // Silently ignore failures.
  }
}
