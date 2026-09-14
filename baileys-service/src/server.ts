/**
 * Minimal HTTP surface for the Baileys service.
 *
 *  - GET  /health — liveness only, no auth: `{ "ok": true }`.
 *  - GET  /status — safe connection snapshot, no auth:
 *    `{ "service": "baileys", "connected": bool, "state": "<name>" }`.
 *    Never includes credentials, QR data, keys, or phonebook data.
 *  - GET  /qr — TEMPORARY linking helper, authenticated with
 *    `Authorization: Bearer <BAILEYS_API_KEY>`: renders the latest in-memory
 *    linking QR as PNG (`image/png`, `Cache-Control: no-store`). 404 when no
 *    QR is currently available. The raw QR string is never returned in JSON
 *    or logs and is never written to disk.
 *  - POST /send  — authenticated with `Authorization: Bearer <BAILEYS_API_KEY>`:
 *    `{ "to": "<digits>", "text": "..." }` → `{ "success": true, "messageId" }`.
 *
 * The gateway is injected so tests exercise auth/validation/shape without a
 * real WhatsApp connection. Raw internal errors are never forwarded.
 */
import express, { type Express, type Request, type Response } from "express";
import QRCode from "qrcode";
import type { ConnectionSnapshot } from "./whatsapp.js";

export interface SendGateway {
  getStatus(): ConnectionSnapshot;
  sendText(toDigits: string, text: string): Promise<string>;
}

export interface AppDeps {
  apiKey: string;
  gateway: SendGateway;
  /** Latest in-memory linking QR, if any. Never persisted, never logged. */
  getQr?: () => string | null;
}

/** Digits-only international number, 8–15 digits, no leading zero. */
export function normalizeServiceDestination(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (!/^[1-9][0-9]{7,14}$/.test(digits)) return null;
  return digits;
}

function unauthorized(res: Response): void {
  res.status(401).json({ success: false, error: "UNAUTHORIZED" });
}

/** Shared Bearer check — same style for /send and /qr, header only. */
function presentedApiKey(req: Request): string {
  const header = req.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

function requireAuth(req: Request, res: Response, apiKey: string): boolean {
  const presented = presentedApiKey(req);
  if (!presented || presented !== apiKey) {
    unauthorized(res);
    return false;
  }
  return true;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get("/status", (_req: Request, res: Response) => {
    const snapshot = deps.gateway.getStatus();
    res.json({
      service: "baileys",
      connected: snapshot.connected,
      state: snapshot.state,
    });
  });

  app.post("/send", async (req: Request, res: Response) => {
    if (!requireAuth(req, res, deps.apiKey)) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      res.status(400).json({ success: false, error: "TEXT_REQUIRED" });
      return;
    }
    if (text.length > 4000) {
      res.status(400).json({ success: false, error: "TEXT_TOO_LONG" });
      return;
    }
    const to = normalizeServiceDestination(body.to);
    if (!to) {
      res.status(400).json({ success: false, error: "INVALID_DESTINATION" });
      return;
    }

    const snapshot = deps.gateway.getStatus();
    if (!snapshot.connected) {
      res.status(503).json({ success: false, error: "NOT_CONNECTED", state: snapshot.state });
      return;
    }

    try {
      const messageId = await deps.gateway.sendText(to, text);
      res.json({ success: true, messageId });
    } catch {
      res.status(502).json({ success: false, error: "SEND_FAILED" });
    }
  });

  // TEMPORARY linking helper: PNG of the latest in-memory QR. Same Bearer
  // auth as /send; no query-string keys; nothing persisted or logged.
  app.get("/qr", async (_req: Request, res: Response) => {
    if (!requireAuth(_req, res, deps.apiKey)) return;
    const qr = deps.getQr?.() ?? null;
    if (!qr) {
      res.status(404).json({ success: false, error: "QR_NOT_AVAILABLE" });
      return;
    }
    try {
      const png = await QRCode.toBuffer(qr, { type: "png", width: 700, margin: 4 });
      res.set("Content-Type", "image/png");
      res.set("Cache-Control", "no-store");
      res.status(200).send(png);
    } catch {
      res.status(500).json({ success: false, error: "QR_RENDER_FAILED" });
    }
  });

  // Malformed JSON (and only that) lands here — keep the shape consistent.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: () => void) => {
    if (err instanceof SyntaxError) {
      res.status(400).json({ success: false, error: "INVALID_JSON" });
      return;
    }
    res.status(500).json({ success: false, error: "INTERNAL" });
  });

  return app;
}
