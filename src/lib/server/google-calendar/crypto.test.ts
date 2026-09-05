import { describe, it, expect, afterEach, vi } from "vitest";
import { encryptSecret, readSecret } from "./crypto";

afterEach(() => vi.unstubAllEnvs());

describe("token crypto", () => {
  it("round-trips a token with encryption enabled", () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "test-encryption-key-value!");
    const stored = encryptSecret("super-secret-refresh-token");
    // must never be stored as plaintext
    expect(stored).not.toContain("super-secret-refresh-token");
    expect(stored.startsWith("enc:v1:")).toBe(true);
    expect(readSecret(stored)).toBe("super-secret-refresh-token");
  });

  it("falls back to a documented plain marker when no key is configured", () => {
    vi.unstubAllEnvs();
    const stored = encryptSecret("token-without-key");
    expect(stored.startsWith("plain:")).toBe(true);
    expect(readSecret(stored)).toBe("token-without-key");
  });

  it("cannot decrypt with a wrong key", () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "one-key-value-here");
    const stored = encryptSecret("secret-a");
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "a-different-key-value");
    expect(() => readSecret(stored)).toThrow();
  });

  it("rejects an unknown storage format", () => {
    expect(() => readSecret("garbage")).toThrow();
  });
});