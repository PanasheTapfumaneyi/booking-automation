/**
 * OpenWA Easy API provider — the sole WhatsApp transport for the MVP.
 *
 * Architecture contract:
 *  - OpenWA runs as a SEPARATE process (never inside Next.js).
 *  - JID conversion (E.164 → `<digits>@c.us`) happens HERE and nowhere else.
 *  - The canonical E.164 number is always stored in `notifications.destination`;
 *    JIDs are transient wire values that never leak into logs, DB, or API
 *    responses.
 *  - Credentials (OPENWA_API_KEY) are never logged, returned, or exposed.
 *  - A per-request timeout guarantees that a slow/unreachable OpenWA never
 *    blocks booking operations.
 *
 * Easy API transport:
 *  The v4 CLI exposes a REST API documented at `{baseUrl}/api-docs/`.
 *  The endpoint is auto-generated per instance, but follows a predictable
 *  convention: `POST /api/{sessionId}/send-text` with a JSON body of the
 *  `sendText(...)` arguments. The exact path MUST be verified against the
 *  running instance's /api-docs/ and adjusted by overriding the `sendPath`
 *  env var (`OPENWA_EASY_API_PATH`) if it differs from the default.
 */
import type {
  NotificationMessage,
  NotificationProvider,
  NotificationSendResult,
  ProviderHealth,
} from "@/lib/notifications/types";
import type { NotificationErrorCode } from "@/lib/notifications/types";
import {
  openwaBaseUrl,
  openwaApiKey,
  openwaSessionId,
  openwaTimeoutMs,
} from "../config";

/** E.164 → WhatsApp JID. ONLY used inside this provider boundary. */
export function toJid(phoneE164: string): string {
  return `${phoneE164.slice(1)}@c.us`;
}

/** Encoded send path (may be overridden via `OPENWA_EASY_API_PATH`). */
function sendPath(): string {
  const raw = (process.env.OPENWA_EASY_API_PATH ?? "").trim();
  if (raw.length > 0) {
    return raw.startsWith("/") ? raw : `/${raw}`;
  }
  return `/api/${encodeURIComponent(openwaSessionId())}/send-text`;
}

interface OpenwaEnvelope {
  success?: boolean;
  response?: unknown;
  message?: string;
}

function classifyStatus(status: number): NotificationErrorCode {
  if (status === 401 || status === 403) return "OPENWA_AUTH_FAILED";
  if (status === 409) return "OPENWA_SESSION_NOT_READY";
  return "OPENWA_SEND_FAILED";
}

function mapError(err: unknown): NotificationSendResult {
  if (err instanceof Error) {
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      return { success: false, retryable: true, errorCode: "OPENWA_UNAVAILABLE" };
    }
    if (err.message.includes("fetch failed") || err.message.includes("ECONNREFUSED")) {
      return { success: false, retryable: true, errorCode: "OPENWA_UNAVAILABLE" };
    }
  }
  return { success: false, retryable: false, errorCode: "OPENWA_SEND_FAILED" };
}

/**
 * Thin adapter that posts a single text message to the OpenWA Easy API.
 *
 * Configured entirely via env — never accepts the config object directly,
 * keeping credentials outside call sites.
 */
export class OpenwaProvider implements NotificationProvider {
  readonly name = "openwa" as const;

  async send(input: NotificationMessage): Promise<NotificationSendResult> {
    const apiKey = openwaApiKey();
    if (!apiKey) {
      return { success: false, retryable: false, errorCode: "OPENWA_AUTH_FAILED" };
    }

    const url = `${openwaBaseUrl()}${sendPath()}`;
    const jid = toJid(input.destination);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
        },
        body: JSON.stringify({ to: jid, content: input.body }),
        signal: AbortSignal.timeout(openwaTimeoutMs()),
      });
    } catch (err) {
      return mapError(err);
    }

    let body: OpenwaEnvelope;
    try {
      body = (await res.json()) as OpenwaEnvelope;
    } catch {
      if (!res.ok) {
        return { success: false, retryable: res.status >= 500, errorCode: classifyStatus(res.status) };
      }
      return { success: false, retryable: false, errorCode: "OPENWA_SEND_FAILED" };
    }

    if (!res.ok) {
      return {
        success: false,
        retryable: res.status >= 500,
        errorCode: classifyStatus(res.status),
      };
    }

    if (body.success === false) {
      const msg = typeof body.message === "string" ? body.message.toLowerCase() : "";
      if (msg.includes("session") && (msg.includes("not ready") || msg.includes("isn't ready"))) {
        return { success: false, retryable: true, errorCode: "OPENWA_SESSION_NOT_READY" };
      }
      return { success: false, retryable: true, errorCode: "OPENWA_SEND_FAILED" };
    }

    const providerMessageId =
      typeof body.response === "string"
        ? body.response
        : typeof body.response === "object" && body.response !== null
          ? ((body.response as Record<string, unknown>).id as string | undefined) ??
            ((body.response as Record<string, unknown>).message as string | undefined)
          : undefined;

    return { success: true, providerMessageId };
  }

  async health(): Promise<ProviderHealth> {
    const configured = openwaApiKey() !== null;
    if (!configured) {
      return { configured: false, reachable: null, sessionReady: null };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3_000);
      const res = await fetch(`${openwaBaseUrl()}/api-docs`, { signal: controller.signal });
      clearTimeout(timer);
      return { configured: true, reachable: res.ok, sessionReady: null };
    } catch {
      return { configured: true, reachable: false, sessionReady: null };
    }
  }
}