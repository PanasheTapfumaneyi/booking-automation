import { describe, it, expect, afterEach, vi } from "vitest";
import { toServiceNumber, BaileysProvider } from "./baileys";
import { resolveNotificationProvider, resolveProviderByName, resetNotificationProviderForTests } from "./index";
import type { NotificationMessage } from "@/lib/notifications/types";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetNotificationProviderForTests();
});

const BASE_MSG: NotificationMessage = {
  destination: "+23057123456",
  body: "Hello",
  eventId: "evt-1",
  bookingId: "b1",
  businessId: "biz-1",
  recipientType: "customer",
};

describe("provider resolver", () => {
  it("selects baileys by env and keeps openwa/mock available by name", () => {
    vi.stubEnv("NOTIFICATION_PROVIDER", "baileys");
    expect(resolveNotificationProvider().name).toBe("baileys");
    expect(resolveProviderByName("baileys").name).toBe("baileys");
    expect(resolveProviderByName("openwa").name).toBe("openwa");
    expect(resolveProviderByName("mock").name).toBe("mock");
  });
});

describe("toServiceNumber", () => {
  it("strips the leading '+' to the service numeric form", () => {
    expect(toServiceNumber("+23057123456")).toBe("23057123456");
    expect(toServiceNumber("+12025550123")).toBe("12025550123");
  });
});

describe("BaileysProvider", () => {
  it("returns BAILEYS_AUTH_FAILED when BAILEYS_API_KEY is missing", async () => {
    vi.stubEnv("BAILEYS_API_KEY", "");
    const provider = new BaileysProvider();
    const result = await provider.send(BASE_MSG);
    expect(result).toEqual({ success: false, retryable: false, errorCode: "BAILEYS_AUTH_FAILED" });
  });

  it("posts the correct URL, Bearer header and body to /send", async () => {
    vi.stubEnv("BAILEYS_API_KEY", "test-key");
    vi.stubEnv("BAILEYS_BASE_URL", "http://localhost:8081");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, messageId: "WA-MSG-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new BaileysProvider();
    const result = await provider.send(BASE_MSG);

    expect(result).toEqual({ success: true, providerMessageId: "WA-MSG-1" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8081/send");
    expect(opts.method).toBe("POST");
    expect(opts.headers).toMatchObject({ Authorization: "Bearer test-key" });
    expect(JSON.parse(opts.body as string)).toEqual({
      to: "23057123456",
      text: "Hello",
    });
  });

  it("maps a timeout to BAILEYS_UNAVAILABLE (retryable)", async () => {
    vi.stubEnv("BAILEYS_API_KEY", "test-key");
    vi.stubEnv("BAILEYS_TIMEOUT_MS", "5000");

    const err = new Error("aborted");
    err.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(err));

    const result = await new BaileysProvider().send(BASE_MSG);
    expect(result).toEqual({ success: false, retryable: true, errorCode: "BAILEYS_UNAVAILABLE" });
  });

  it("maps HTTP 401 to BAILEYS_AUTH_FAILED (non-retryable)", async () => {
    vi.stubEnv("BAILEYS_API_KEY", "bad");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) }));

    const result = await new BaileysProvider().send(BASE_MSG);
    expect(result).toEqual({ success: false, retryable: false, errorCode: "BAILEYS_AUTH_FAILED" });
  });

  it("maps HTTP 503 NOT_CONNECTED to BAILEYS_SESSION_NOT_READY (retryable)", async () => {
    vi.stubEnv("BAILEYS_API_KEY", "key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ success: false, error: "NOT_CONNECTED", state: "disconnected" }),
      }),
    );

    const result = await new BaileysProvider().send(BASE_MSG);
    expect(result).toEqual({ success: false, retryable: true, errorCode: "BAILEYS_SESSION_NOT_READY" });
  });

  it("maps HTTP 5xx to BAILEYS_SEND_FAILED (retryable)", async () => {
    vi.stubEnv("BAILEYS_API_KEY", "key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502, json: () => Promise.resolve({}) }));

    const result = await new BaileysProvider().send(BASE_MSG);
    expect(result).toEqual({ success: false, retryable: true, errorCode: "BAILEYS_SEND_FAILED" });
  });

  it("maps a success:false body to BAILEYS_SEND_FAILED", async () => {
    vi.stubEnv("BAILEYS_API_KEY", "key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: false, error: "SEND_FAILED" }),
      }),
    );

    const result = await new BaileysProvider().send(BASE_MSG);
    expect(result).toEqual({ success: false, retryable: false, errorCode: "BAILEYS_SEND_FAILED" });
  });

  it("maps a malformed service response to BAILEYS_SEND_FAILED", async () => {
    vi.stubEnv("BAILEYS_API_KEY", "key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error("not json")),
      }),
    );

    const result = await new BaileysProvider().send(BASE_MSG);
    expect(result).toEqual({ success: false, retryable: false, errorCode: "BAILEYS_SEND_FAILED" });
  });

  it("health reports connected session when the service is up", async () => {
    vi.stubEnv("BAILEYS_API_KEY", "key");
    vi.stubEnv("BAILEYS_BASE_URL", "http://localhost:8081");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ service: "baileys", connected: true, state: "connected" }),
      }),
    );

    const result = await new BaileysProvider().health();
    expect(result).toEqual({ configured: true, reachable: true, sessionReady: true });
  });

  it("health distinguishes reachable-but-disconnected from unreachable", async () => {
    vi.stubEnv("BAILEYS_API_KEY", "key");
    vi.stubEnv("BAILEYS_BASE_URL", "http://localhost:8081");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ service: "baileys", connected: false, state: "qr_required" }),
      }),
    );

    const down = await new BaileysProvider().health();
    expect(down).toEqual({ configured: true, reachable: true, sessionReady: false });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const unreachable = await new BaileysProvider().health();
    expect(unreachable).toEqual({ configured: true, reachable: false, sessionReady: null });
  });

  it("health reports not configured when API key is absent", async () => {
    vi.stubEnv("BAILEYS_API_KEY", "");
    const result = await new BaileysProvider().health();
    expect(result).toEqual({ configured: false, reachable: null, sessionReady: null });
  });
});
