/**
 * Baileys service provider — the current WhatsApp transport for the pilot.
 * (OpenWA stays available for rollback; see `./openwa.ts`.)
 *
 * Architecture contract (same as OpenWA's, different transport):
 *  - The Baileys service runs as a SEPARATE process (never inside Next.js).
 *  - Destination conversion (E.164 → service `<digits>`) happens HERE and
 *    nowhere else. The canonical E.164 number is always stored in
 *    `notifications.destination`; service wire values never leak into logs,
 *    DB, or API responses.
 *  - Credentials (BAILEYS_API_KEY) are never logged, returned, or exposed.
 *  - Auth uses `Authorization: Bearer <key>` (documented in
 *    `baileys-service/README.md`). This differs from OpenWA's `apikey`
 *    header — each adapter owns its transport's auth scheme.
 *  - A per-request timeout guarantees that a slow/unreachable service never
 *    blocks booking operations.
 *
 * Service transport:
 *  `POST {baseUrl}/send` with `{ "to": "<digits>", "text": "..." }`.
 *  Success: `{ "success": true, "messageId": "..." }`.
 *  Failure: non-2xx with `{ "success": false, "error": "<CODE>" }`
 *  (`NOT_CONNECTED` means the WhatsApp session is down).
 */
import type {
  NotificationMessage,
  NotificationProvider,
  NotificationSendResult,
  ProviderHealth,
} from "@/lib/notifications/types";
import {
  baileysBaseUrl,
  baileysApiKey,
  baileysTimeoutMs,
} from "../config";

/** E.164 → Baileys service destination (`+23057123456` → `23057123456`). */
export function toServiceNumber(phoneE164: string): string {
  return phoneE164.replace(/\D/g, "");
}

interface BaileysSendEnvelope {
  success?: boolean;
  messageId?: unknown;
  error?: unknown;
}

interface BaileysStatusEnvelope {
  service?: unknown;
  connected?: unknown;
  state?: unknown;
}

function classifyStatus(status: number, errorCode: string): NotificationSendResult {
  if (status === 401 || status === 403) {
    return { success: false, retryable: false, errorCode: "BAILEYS_AUTH_FAILED" };
  }
  if (status === 503 || errorCode === "NOT_CONNECTED") {
    return { success: false, retryable: true, errorCode: "BAILEYS_SESSION_NOT_READY" };
  }
  return {
    success: false,
    retryable: status >= 500,
    errorCode: "BAILEYS_SEND_FAILED",
  };
}

function mapError(err: unknown): NotificationSendResult {
  if (err instanceof Error) {
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      return { success: false, retryable: true, errorCode: "BAILEYS_UNAVAILABLE" };
    }
    if (err.message.includes("fetch failed") || err.message.includes("ECONNREFUSED")) {
      return { success: false, retryable: true, errorCode: "BAILEYS_UNAVAILABLE" };
    }
  }
  return { success: false, retryable: false, errorCode: "BAILEYS_SEND_FAILED" };
}

/**
 * Thin adapter that posts a single text message to the Baileys service.
 *
 * Configured entirely via env — never accepts the config object directly,
 * keeping credentials outside call sites. Never throws: every failure is a
 * normalized `NotificationSendResult` so booking transactions can't roll back.
 */
export class BaileysProvider implements NotificationProvider {
  readonly name = "baileys" as const;

  async send(input: NotificationMessage): Promise<NotificationSendResult> {
    const apiKey = baileysApiKey();
    if (!apiKey) {
      return { success: false, retryable: false, errorCode: "BAILEYS_AUTH_FAILED" };
    }

    const url = `${baileysBaseUrl()}/send`;
    const to = toServiceNumber(input.destination);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ to, text: input.body }),
        signal: AbortSignal.timeout(baileysTimeoutMs()),
      });
    } catch (err) {
      return mapError(err);
    }

    let body: BaileysSendEnvelope;
    try {
      body = (await res.json()) as BaileysSendEnvelope;
    } catch {
      if (!res.ok) {
        return classifyStatus(res.status, "");
      }
      return { success: false, retryable: false, errorCode: "BAILEYS_SEND_FAILED" };
    }

    if (!res.ok || body.success !== true) {
      const code = typeof body.error === "string" ? body.error : "";
      return classifyStatus(res.status, code);
    }

    return {
      success: true,
      providerMessageId: typeof body.messageId === "string" ? body.messageId : undefined,
    };
  }

  async health(): Promise<ProviderHealth> {
    const configured = baileysApiKey() !== null;
    if (!configured) {
      return { configured: false, reachable: null, sessionReady: null };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3_000);
      const res = await fetch(`${baileysBaseUrl()}/status`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        return { configured: true, reachable: false, sessionReady: null };
      }
      const body = (await res.json()) as BaileysStatusEnvelope;
      return {
        configured: true,
        reachable: true,
        sessionReady: body.connected === true,
      };
    } catch {
      return { configured: true, reachable: false, sessionReady: null };
    }
  }
}
