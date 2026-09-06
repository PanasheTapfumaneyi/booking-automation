/**
 * Minimal HTTP surface for the Baileys service.
 *
 *  - GET  /health — liveness only, no auth: `{ "ok": true }`.
 *  - GET  /status — safe connection snapshot, no auth:
 *    `{ "service": "baileys", "connected": bool, "state": "<name>" }`.
 *    Never includes credentials, QR data, keys, or phonebook data.
 *  - POST /send  — authenticated with `Authorization: Bearer <BAILEYS_API_KEY>`:
 *    `{ "to": "<digits>", "text": "..." }` → `{ "success": true, "messageId" }`.
 *
 * The gateway is injected so tests exercise auth/validation/shape without a
 * real WhatsApp connection. Raw internal errors are never forwarded.
 */
import express, { type Express, type Request, type Response } from "express";
import type { ConnectionSnapshot } from "./whatsapp.js";

export interface SendGateway {
  getStatus(): ConnectionSnapshot;
  sendText(toDigits: string, text: string): Promise<string>;
}

export interface AppDeps {
  apiKey: string;
  gateway: SendGateway;
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
    const header = req.get("authorization") ?? "";
    const presented = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    if (!presented || presented !== deps.apiKey) {
      unauthorized(res);
      return;
    }

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
