/**
 * HTTP-level tests for the Baileys service — no real WhatsApp involved.
 * The gateway is faked; tests cover auth, validation, disconnected
 * rejection, failure mapping, and response-shape safety.
 */
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, normalizeServiceDestination, type SendGateway } from "./server.js";
import { loadConfig } from "./config.js";

let servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
  servers = [];
  vi.restoreAllMocks();
});

function fakeGateway(overrides: Partial<SendGateway> = {}): SendGateway {
  return {
    getStatus: () => ({ connected: true, state: "connected" as const }),
    sendText: async () => "WA-MSG-1",
    ...overrides,
  };
}

async function startApp(gateway: SendGateway, apiKey = "test-key"): Promise<string> {
  const app: Express = createApp({ apiKey, gateway });
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

describe("normalizeServiceDestination", () => {
  it("accepts digit strings and strips formatting", () => {
    expect(normalizeServiceDestination("23057123456")).toBe("23057123456");
    expect(normalizeServiceDestination("+23057123456")).toBe("23057123456");
    expect(normalizeServiceDestination("230 5712 3456")).toBe("23057123456");
  });

  it("rejects short, long, zero-led, and non-string values", () => {
    expect(normalizeServiceDestination("12345")).toBeNull();
    expect(normalizeServiceDestination("023057123456")).toBeNull();
    expect(normalizeServiceDestination("1".repeat(16))).toBeNull();
    expect(normalizeServiceDestination("")).toBeNull();
    expect(normalizeServiceDestination(undefined)).toBeNull();
    expect(normalizeServiceDestination(23057123456)).toBeNull();
  });
});

describe("GET /health", () => {
  it("reports liveness without auth", async () => {
    const base = await startApp(fakeGateway());
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("GET /status", () => {
  it("returns a safe snapshot with exactly the public keys", async () => {
    const base = await startApp(fakeGateway({ getStatus: () => ({ connected: false, state: "qr_required" }) }));
    const res = await fetch(`${base}/status`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ service: "baileys", connected: false, state: "qr_required" });
    // Exactly the public keys — no room for creds, keys, tokens, or QR data.
    expect(Object.keys(body).sort()).toEqual(["connected", "service", "state"]);
  });
});

describe("POST /send", () => {
  it("rejects missing and wrong credentials", async () => {
    const base = await startApp(fakeGateway());
    const noAuth = await fetch(`${base}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: "23057123456", text: "hi" }),
    });
    expect(noAuth.status).toBe(401);

    const wrong = await fetch(`${base}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer wrong" },
      body: JSON.stringify({ to: "23057123456", text: "hi" }),
    });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ success: false, error: "UNAUTHORIZED" });
  });

  it("validates to and text", async () => {
    const base = await startApp(fakeGateway());
    const auth = { "Content-Type": "application/json", Authorization: "Bearer test-key" };
    for (const body of [
      { text: "hi" },
      { to: "23057123456" },
      { to: "12345", text: "hi" },
      { to: "23057123456", text: "   " },
    ]) {
      const res = await fetch(`${base}/send`, { method: "POST", headers: auth, body: JSON.stringify(body) });
      expect(res.status).toBe(400);
    }
  });

  it("rejects sends while disconnected without touching the gateway", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const sendText = vi.fn(async (_to: string, _text: string) => "WA-MSG-1");
    const gateway = fakeGateway({
      getStatus: () => ({ connected: false, state: "disconnected" }),
      sendText,
    });
    const base = await startApp(gateway);
    const res = await fetch(`${base}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer test-key" },
      body: JSON.stringify({ to: "23057123456", text: "hi" }),
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ success: false, error: "NOT_CONNECTED", state: "disconnected" });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("returns the provider message id on success", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const sendText = vi.fn(async (_to: string, _text: string) => "WA-MSG-1");
    const gateway = fakeGateway({ sendText });
    const base = await startApp(gateway);
    const res = await fetch(`${base}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer test-key" },
      body: JSON.stringify({ to: "+23057123456", text: "hello" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, messageId: "WA-MSG-1" });
    expect(sendText).toHaveBeenCalledWith("23057123456", "hello");
  });

  it("maps gateway failures to a safe 502 without internals", async () => {
    const gateway = fakeGateway({ sendText: vi.fn(async () => { throw new Error("boom-secret-detail"); }) });
    const base = await startApp(gateway);
    const res = await fetch(`${base}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer test-key" },
      body: JSON.stringify({ to: "23057123456", text: "hi" }),
    });
    expect(res.status).toBe(502);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ success: false, error: "SEND_FAILED" });
    expect(JSON.stringify(body)).not.toContain("boom-secret-detail");
  });

  it("rejects malformed JSON with a consistent shape", async () => {
    const base = await startApp(fakeGateway());
    const res = await fetch(`${base}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer test-key" },
      body: "{not-json",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: "INVALID_JSON" });
  });
});

describe("loadConfig", () => {
  it("requires an API key and defaults the port", () => {
    expect(() => loadConfig({})).toThrow(/BAILEYS_API_KEY/);
    const cfg = loadConfig({ BAILEYS_API_KEY: "k" });
    expect(cfg.port).toBe(8081);
    expect(cfg.authDir).toBe("./auth");
    expect(cfg.apiKey).toBe("k");
  });

  it("parses a valid port and falls back otherwise", () => {
    expect(loadConfig({ BAILEYS_API_KEY: "k", PORT: "8099" }).port).toBe(8099);
    expect(loadConfig({ BAILEYS_API_KEY: "k", PORT: "nope" }).port).toBe(8081);
  });
});
