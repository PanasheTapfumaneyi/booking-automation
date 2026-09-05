export type NotificationType =
  | "booking_confirmation"
  | "booking_created_business"
  | "booking_rescheduled"
  | "booking_cancelled"
  | "appointment_reminder";

export type NotificationData = Record<string, string | number | boolean | null>;

export interface NotificationRequest {
  recipient: string;
  type: NotificationType;
  data: NotificationData;
}

export interface NotificationProvider {
  readonly name: string;
  send(request: NotificationRequest): Promise<void>;
}

/**
 * Provider registry. Notification channels (WhatsApp, SMS, email) register
 * themselves here so the rest of the app never touches a provider directly.
 */
const providers: NotificationProvider[] = [];

export function registerNotificationProvider(provider: NotificationProvider): void {
  providers.push(provider);
}

/**
 * Sends a notification through every registered provider.
 *
 * Swap-ready: connect the WhatsApp Business provider later without touching
 * call sites. Failures are swallowed and logged so a broken channel never
 * blocks a booking.
 */
export async function sendNotification(request: NotificationRequest): Promise<void> {
  if (providers.length === 0) {
    console.log(`[notification:${request.type}] to ${request.recipient}`, request.data);
    return;
  }
  await Promise.all(
    providers.map((provider) =>
      provider.send(request).catch((error) => {
        console.error(`[notification:${provider.name}] failed`, error);
      }),
    ),
  );
}