import { describe, it, expect, afterEach, vi } from "vitest";
import {
  buildAuthorizationUrl,
  createOAuthState,
  verifyOAuthState,
  isOAuthConfigured,
} from "./oauth";
import { GOOGLE_CALENDAR_SCOPES } from "./types";

const REDIRECT =
  "http://localhost:3000/api/integrations/google-calendar/callback";

afterEach(() => vi.unstubAllEnvs());

function configureGoogle() {
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-123");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret-456");
  vi.stubEnv("GOOGLE_REDIRECT_URI", REDIRECT);
}

describe("oauth", () => {
  it("requires config to build authorization URLs", () => {
    expect(isOAuthConfigured()).toBe(false);
    configureGoogle();
    expect(isOAuthConfigured()).toBe(true);
  });

  it("authorization URL includes the required Calendar scopes", () => {
    configureGoogle();
    const url = new URL(buildAuthorizationUrl("biz-1"));
    const scope = url.searchParams.get("scope") ?? "";
    const decoded = decodeURIComponent(scope);
    expect(decoded).toContain(GOOGLE_CALENDAR_SCOPES[0]); // calendar.events
    expect(decoded).toContain(GOOGLE_CALENDAR_SCOPES[1]); // calendars.readonly
  });

  it("authorization URL requests offline access", () => {
    configureGoogle();
    const url = new URL(buildAuthorizationUrl("biz-1"));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("include_granted_scopes")).toBe("true");
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT);
  });

  it("binds a signed state token to the business id", () => {
    configureGoogle();
    const state = new URL(buildAuthorizationUrl("biz-1")).searchParams.get(
      "state",
    );
    expect(state).toBeTruthy();
    expect(verifyOAuthState(state)).toBe("biz-1");
  });

  it("rejects a tampered state token", () => {
    configureGoogle();
    const state = createOAuthState("biz-1");
    const tampered = `${state}xyz`;
    expect(verifyOAuthState(tampered)).toBeNull();
    expect(verifyOAuthState(null)).toBeNull();
    expect(verifyOAuthState("")).toBeNull();
    expect(verifyOAuthState("no-dot-here")).toBeNull();
  });

  it("rejects an expired state token", () => {
    configureGoogle();
    const state = createOAuthState("biz-1");
    expect(verifyOAuthState(state, Date.now() + 1000)).toBe("biz-1");
    expect(verifyOAuthState(state, Date.now() + 11 * 60 * 1000)).toBeNull();
  });
});