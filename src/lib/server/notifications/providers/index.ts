/**
 * Resolves the active notification provider from runtime configuration.
 *
 * There is exactly one global provider per process; the booking-service is
 * responsible for the choice (never the notification service itself — keeping
 * booking logic independent from provider naming).
 */
import type { NotificationProvider } from "@/lib/notifications/types";
import { notificationProvider } from "../config";
import { MockProvider } from "./mock";
import { OpenwaProvider } from "./openwa";

let cached: NotificationProvider | null = null;

export function resolveNotificationProvider(): NotificationProvider {
  if (cached) return cached;
  switch (notificationProvider()) {
    case "mock":
      cached = new MockProvider();
      break;
    case "openwa":
      cached = new OpenwaProvider();
      break;
    default:
      // 'none' is the safe default: caller layers must gate on `notificationProvider()`
      // before touching this. A MockProvider here only serves env-absent tests.
      cached = new MockProvider();
      break;
  }
  return cached;
}

/**
 * Constructs the provider recorded on a notification row by its stored name,
 * ignoring the current env (retries must use the provider that originally
 * wrote the row).
 */
export function resolveProviderByName(name: string): NotificationProvider {
  return name === "mock" ? new MockProvider() : new OpenwaProvider();
}

/** Only for test isolation — clears the singleton between tests. */
export function resetNotificationProviderForTests(): void {
  cached = null;
}