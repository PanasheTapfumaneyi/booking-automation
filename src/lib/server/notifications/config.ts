/**
 * Runtime configuration for the notification layer.
 *
 * Conventional env names (see .env.example). Everything that must not reach
 * the browser lives here and is read server-side only. `none` is the safe
 * default: notifications are off until deliberately enabled.
 */
import { isValidE164 } from "@/lib/notifications/phone";

export type ConfiguredProvider = "none" | "mock" | "openwa";

export function notificationProvider(): ConfiguredProvider {
  const raw = (process.env.NOTIFICATION_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "mock") return "mock";
  if (raw === "openwa") return "openwa";
  if (raw !== "") {
    console.warn(
      `[notifications] ignoring unknown NOTIFICATION_PROVIDER=${JSON.stringify(raw)}; using none`,
    );
  }
  return "none";
}

export function openwaBaseUrl(): string {
  return (process.env.OPENWA_BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");
}

export function openwaApiKey(): string | null {
  const raw = (process.env.OPENWA_API_KEY ?? "").trim();
  return raw.length > 0 ? raw : null;
}

export function openwaSessionId(): string {
  const raw = (process.env.OPENWA_SESSION_ID ?? "").trim();
  return raw.length > 0 ? raw : "default";
}

export function openwaTimeoutMs(): number {
  const raw = Number(process.env.OPENWA_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 10_000;
}

/**
 * Public base URL used to build /manage/[token] links inside customer
 * messages. Must be the host customers actually reach.
 */
export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * Convenience for validating a configured business destination without
 * importing normalize-side effects.
 */
export function isE164Candidate(destination: string): boolean {
  return isValidE164(destination);
}