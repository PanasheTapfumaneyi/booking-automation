import { describe, it, expect, afterEach, vi } from "vitest";
import { toJid, OpenwaProvider } from "./openwa";
import type { NotificationMessage } from "@/lib/notifications/types";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const BASE_MSG: NotificationMessage = {
  destination: "+23057123456",
  body: "Hello",
  eventId: "evt-1",
  bookingId: "b1",
  businessId: "biz-1",
  recipientType: "customer",
};

describe("toJid", () => {
  it("strips the leading '+' and appends @c.us", () => {
    expect(toJid("+23057123456")).toBe("23057123456@c.us");
    expect(toJid("+12025550123")).toBe("12025550123@c.us");
  });
});

describe("OpenwaProvider", () => {
  it("returns OPENWA_AUTH_FAILED when OPENWA_API_KEY is missing", async () => {
    vi.stubEnv("OPENWA_API_KEY", "");
    vi.stubEnv("OPENWA_SESSION_ID", "test");
    const provider = new OpenwaProvider();
    const result = await provider.send(BASE_MSG);
    expect(result).toEqual({ success: false, retryable: false, errorCode: "OPENWA_AUTH_FAILED" });
  });

  it("posts the correct URL, headers and body to the Easy API", async () => {
    vi.stubEnv("OPENWA_API_KEY", "test-key");
    vi.stubEnv("OPENWA_BASE_URL", "http://localhost:8080");
    vi.stubEnv("OPENWA_SESSION_ID", "kivo");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, response: "msg-123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenwaProvider();
    const result = await provider.send(BASE_MSG);

    expect(result).toEqual({ success: true, providerMessageId: "msg-123" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/api/kivo/send-text");
    expect(opts.method).toBe("POST");
    expect(opts.headers).toMatchObject({ apikey: "test-key" });
    expect(JSON.parse(opts.body as string)).toEqual({
      to: "23057123456@c.us",
      content: "Hello",
    });
  });

  it("maps a timeout to OPENWA_UNAVAILABLE (retryable)", async () => {
    vi.stubEnv("OPENWA_API_KEY", "test-key");
    vi.stubEnv("OPENWA_SESSION_ID", "kivo");
    vi.stubEnv("OPENWA_TIMEOUT_MS", "5000");

    const err = new Error("aborted");
    err.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(err));

    const result = await new OpenwaProvider().send(BASE_MSG);
    expect(result).toEqual({ success: false, retryable: true, errorCode: "OPENWA_UNAVAILABLE" });
  });

  it("maps HTTP 401 to OPENWA_AUTH_FAILED (non-retryable)", async () => {
    vi.stubEnv("OPENWA_API_KEY", "bad");
    vi.stubEnv("OPENWA_SESSION_ID", "kivo");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) }));

    const result = await new OpenwaProvider().send(BASE_MSG);
    expect(result).toEqual({ success: false, retryable: false, errorCode: "OPENWA_AUTH_FAILED" });
  });

  it("maps HTTP 5xx to OPENWA_SEND_FAILED (retryable)", async () => {
    vi.stubEnv("OPENWA_API_KEY", "key");
    vi.stubEnv("OPENWA_SESSION_ID", "kivo");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502, json: () => Promise.resolve({}) }));

    const result = await new OpenwaProvider().send(BASE_MSG);
    expect(result).toEqual({ success: false, retryable: true, errorCode: "OPENWA_SEND_FAILED" });
  });

  it("interprets success:false with a session-ready message as SESSION_NOT_READY", async () => {
    vi.stubEnv("OPENWA_API_KEY", "key");
    vi.stubEnv("OPENWA_SESSION_ID", "kivo");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: false, message: "Session is not ready yet" }),
      }),
    );

    const result = await new OpenwaProvider().send(BASE_MSG);
    expect(result).toEqual({ success: false, retryable: true, errorCode: "OPENWA_SESSION_NOT_READY" });
  });

  it("health reports configured/reachable against /api-docs", async () => {
    vi.stubEnv("OPENWA_API_KEY", "key");
    vi.stubEnv("OPENWA_BASE_URL", "http://localhost:8080");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    const result = await new OpenwaProvider().health();
    expect(result).toEqual({ configured: true, reachable: true, sessionReady: null });
  });

  it("health reports unreachable when /api-docs fails", async () => {
    vi.stubEnv("OPENWA_API_KEY", "key");
    vi.stubEnv("OPENWA_BASE_URL", "http://localhost:8080");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const result = await new OpenwaProvider().health();
    expect(result).toEqual({ configured: true, reachable: false, sessionReady: null });
  });

  it("health reports not configured when API key is absent", async () => {
    vi.stubEnv("OPENWA_API_KEY", "");
    const result = await new OpenwaProvider().health();
    expect(result).toEqual({ configured: false, reachable: null, sessionReady: null });
  });
});