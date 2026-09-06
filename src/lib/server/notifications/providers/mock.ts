/**
 * Deterministic mock provider for unit and integration tests.
 *
 * Zero network I/O; every send returns a deterministic fake provider id.
 */
import type {
  NotificationMessage,
  NotificationProvider,
  NotificationSendResult,
  ProviderHealth,
} from "@/lib/notifications/types";

export class MockProvider implements NotificationProvider {
  readonly name = "mock" as const;
  private counter = 0;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async send(_input: NotificationMessage): Promise<NotificationSendResult> {
    this.counter += 1;
    return {
      success: true,
      providerMessageId: `mock-${this.counter}`,
    };
  }

  async health(): Promise<ProviderHealth> {
    return { configured: true, reachable: true, sessionReady: true };
  }
}