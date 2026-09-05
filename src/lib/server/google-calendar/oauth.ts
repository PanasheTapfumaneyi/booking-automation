import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AppConfigError } from "@/lib/server/errors";
import { GOOGLE_CALENDAR_SCOPES } from "./types";

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Reads Google OAuth config from the environment (server-only). */
export function getOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function isOAuthConfigured(): boolean {
  return getOAuthConfig() !== null;
}

export function requireOAuthConfig(): GoogleOAuthConfig {
  const config = getOAuthConfig();
  if (!config) {
    throw new AppConfigError(
      "Google OAuth is not configured. Add GOOGLE_CLIENT_ID, " +
        "GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI (see .env.example).",
    );
  }
  return config;
}

/** Builds a fresh OAuth2 client away from any cached credentials. */
export function buildOAuthClient(): OAuth2Client {
  const { clientId, clientSecret, redirectUri } = requireOAuthConfig();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ---------------------------------------------------------------------------
// OAuth state (CSRF protection)
// ---------------------------------------------------------------------------

interface OAuthStatePayload {
  b: string; // business_id
  exp: number; // expiry epoch ms
  n: string; // nonce
}

function stateKey(): Buffer {
  // The client secret is already a server-only secret; HMAC with it gives us
  // stateless, tamper-proof state without adding another secret to configure.
  return Buffer.from(requireOAuthConfig().clientSecret, "utf8");
}

export function signState(body: string): string {
  return createHmac("sha256", stateKey()).update(body, "utf8").digest("base64url");
}

/** Creates a short-lived signed state token that encodes the business id. */
export function createOAuthState(
  businessId: string,
  ttlMs = 10 * 60 * 1000,
): string {
  const payload: OAuthStatePayload = {
    b: businessId,
    exp: Date.now() + ttlMs,
    n: randomBytes(12).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signState(body)}`;
}

/**
 * Verifies a state token and returns the encoded business id, or null when the
 * token is missing/malformed/tampered/expired.
 */
export function verifyOAuthState(
  state: string | null,
  now: number = Date.now(),
): string | null {
  if (!state) return null;
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = signState(body);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return null;
  if (!timingSafeEqual(left, right)) return null;
  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    !payload ||
    typeof payload.b !== "string" ||
    typeof payload.exp !== "number" ||
    payload.exp <= now
  ) {
    return null;
  }
  return payload.b;
}

// ---------------------------------------------------------------------------
// Authorization URL
// ---------------------------------------------------------------------------

/**
 * Builds the Google authorization URL for connecting a business calendar.
 * - access_type=offline  → refresh token is issued (platform modifies the
 *   calendar while the owner is not actively logged in)
 * - prompt=consent       → a fresh refresh token is guaranteed on reconnects
 * - include_granted_scopes=true → scopes are additive on re-consent
 */
export function buildAuthorizationUrl(businessId: string): string {
  const { redirectUri } = requireOAuthConfig();
  const client = buildOAuthClient();
  const state = createOAuthState(businessId);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [...GOOGLE_CALENDAR_SCOPES],
    redirect_uri: redirectUri,
    state,
  });
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

export interface ExchangedTokens {
  accessToken: string;
  refreshToken: string | null;
  scope: string | null;
  accountEmail: string | null;
  expiresAt: string | null;
}

/**
 * Exchanges an authorization code for tokens and identifies the connecting
 * Google account (email comes from the public tokeninfo endpoint).
 */
export async function exchangeAuthorizationCode(
  code: string,
): Promise<ExchangedTokens> {
  const { redirectUri } = requireOAuthConfig();
  const client = buildOAuthClient();
  const { tokens } = await client.getToken({
    code,
    redirect_uri: redirectUri,
  });
  if (!tokens.access_token) {
    throw new Error("Authorization code exchange did not yield an access token.");
  }

  let accountEmail: string | null = null;
  try {
    const info = await client.getTokenInfo(tokens.access_token);
    accountEmail = info.email ?? null;
  } catch {
    // Tokeninfo is best-effort; email is stored for display only.
    accountEmail = null;
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    scope: tokens.scope ?? null,
    accountEmail,
    expiresAt: tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null,
  };
}

/** Best-effort token revocation used when disconnecting a business. */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    const client = buildOAuthClient();
    const res = await client.revokeToken(refreshToken);
    if (res.status !== 200) {
      console.warn(
        `[google-calendar] revoke returned non-200 status ${res.status}`,
      );
    }
  } catch (err) {
    // Revocation is best-effort; a failure must not block disconnection.
    console.warn("[google-calendar] token revocation failed:", err);
  }
}