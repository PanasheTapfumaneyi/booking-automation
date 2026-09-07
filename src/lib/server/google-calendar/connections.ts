import { ApiError } from "@/lib/server/errors";
import { fetchBusiness } from "@/lib/server/database";
import { googleApiTimeoutMs, allowedBusinessIds } from "./types";
import {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  revokeRefreshToken,
  verifyOAuthState,
} from "./oauth";
import { createCalendarApiClient } from "./client";
import { businessHasMembers, getMyBusinessIds } from "@/lib/server/auth";
import {
  deactivateConnection,
  getActiveConnection,
  upsertConnection,
} from "./repository";
import { classifyCalendarError } from "./errors";
import type { CalendarApi } from "./types";

function assertBusinessAllowed(businessId: string, memberBusinessIds: string[] = []): void {
  const allowed = allowedBusinessIds();
  if (!allowed.includes(businessId) && !memberBusinessIds.includes(businessId)) {
    throw new ApiError(
      403,
      "VALIDATION",
      "This business is not enabled for Google Calendar self-service yet.",
    );
  }
}

// ---------------------------------------------------------------------------
// Connect
// ---------------------------------------------------------------------------

export interface ConnectRequest {
  businessId: string;
  /** Businesses of the current session user (from getMyBusinessIds). */
  memberBusinessIds?: string[];
}

/** Validates the business and returns the Google authorization URL (GET). */
export async function startConnect(
  request: ConnectRequest,
): Promise<string> {
  const businessExists = await fetchBusiness(request.businessId).catch(
    () => null,
  );
  if (!businessExists) {
    throw new ApiError(404, "BOOKING_NOT_FOUND", "Business not found.");
  }
  assertBusinessAllowed(request.businessId, request.memberBusinessIds ?? []);
  return buildAuthorizationUrl(request.businessId);
}

// ---------------------------------------------------------------------------
// Callback
// ---------------------------------------------------------------------------

export type ConnectOutcome =
  | { status: "success"; businessId: string; accountEmail: string | null }
  | { status: "denied" };

export interface CompleteConnectionArgs {
  code: string | null;
  state: string | null;
}

/**
 * Finishes the OAuth callback: validates state (CSRF), exchanges the code,
 * preserves any previously stored refresh token when Google omits a replacement,
 * identifies the account + primary calendar, and stores the connection.
 */
export async function completeConnection(
  args: CompleteConnectionArgs,
): Promise<ConnectOutcome> {
  const businessId = verifyOAuthState(args.state);
  if (!businessId) {
    throw new ApiError(
      400,
      "VALIDATION",
      "This connection link is invalid or has expired. Please start over.",
    );
  }
  // The OAuth state token (signed, expiring, created only via an authorized
  // startConnect) authorizes this business; member-owned businesses are
  // admitted even when no session cookie accompanies the Google redirect.
  const owned = await businessHasMembers(businessId).catch(() => false);
  assertBusinessAllowed(businessId, owned ? [businessId] : []);
  await fetchBusiness(businessId);

  if (!args.code) {
    return { status: "denied" };
  }

  const exchanged = await exchangeAuthorizationCode(args.code);

  const existing = await getActiveConnection(businessId);
  const refreshToken = existing?.refreshToken ?? exchanged.refreshToken;
  if (!refreshToken) {
    throw new ApiError(
      400,
      "VALIDATION",
      "Google did not issue a refresh token for this connection. Please try again.",
    );
  }

  let calendarId = "primary";
  try {
    const api = createCalendarApiClient({
      id: existing?.id ?? "",
      businessId,
      provider: "google",
      googleAccountEmail: exchanged.accountEmail ?? existing?.googleAccountEmail ?? null,
      calendarId: "primary",
      refreshToken,
      accessToken: exchanged.accessToken,
      accessTokenExpiresAt: exchanged.expiresAt,
      scope: exchanged.scope,
      active: true,
      connectedAt: "",
      updatedAt: "",
    }).api as CalendarApi;
    const { data } = await api.calendarList.get(
      { calendarId: "primary" },
      { timeout: googleApiTimeoutMs() },
    );
    calendarId = data?.id ?? "primary";
  } catch (err) {
    console.warn(
      "[google-calendar] primary calendar lookup failed, defaulting to primary:",
      err,
    );
  }

  await upsertConnection({
    businessId,
    accountEmail: exchanged.accountEmail,
    calendarId,
    scope: exchanged.scope,
    refreshToken,
    accessToken: exchanged.accessToken,
    accessTokenExpiresAt: exchanged.expiresAt,
  });

  return {
    status: "success",
    businessId,
    accountEmail: exchanged.accountEmail ?? existing?.googleAccountEmail ?? null,
  };
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export interface ConnectionStatus {
  connected: boolean;
  calendarId: string | null;
  accountEmail: string | null;
  requiresReconnect: boolean;
  checked: boolean;
}

/**
 * Safe status read — never returns tokens or secrets. When a fresh access
 * token cannot be obtained from the stored refresh token the connection is
 * reported as requiring a reconnect.
 */
export async function getConnectionStatus(
  businessId: string,
): Promise<ConnectionStatus> {
  await fetchBusiness(businessId);
  const connection = await getActiveConnection(businessId);
  if (!connection?.refreshToken) {
    return {
      connected: false,
      calendarId: null,
      accountEmail: null,
      requiresReconnect: false,
      checked: true,
    };
  }

  try {
    const api = createCalendarApiClient(connection, undefined).api as CalendarApi;
    await api.calendarList.get(
      { calendarId: "primary" },
      { timeout: Math.min(googleApiTimeoutMs(), 5000) },
    );
    return {
      connected: true,
      calendarId: connection.calendarId,
      accountEmail: connection.googleAccountEmail,
      requiresReconnect: false,
      checked: true,
    };
  } catch (err) {
    console.error("[google-calendar] status check failed:", err);
    if (classifyCalendarError(err) === "CALENDAR_AUTH_REQUIRED") {
      return {
        connected: true,
        calendarId: connection.calendarId,
        accountEmail: connection.googleAccountEmail,
        requiresReconnect: true,
        checked: true,
      };
    }
    return {
      connected: true,
      calendarId: connection.calendarId,
      accountEmail: connection.googleAccountEmail,
      requiresReconnect: false,
      checked: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Disconnect
// ---------------------------------------------------------------------------

export interface DisconnectResult {
  ok: boolean;
  revoked: boolean;
}

/**
 * Deactivates the connection and best-effort revokes the Google refresh token.
 * Historical bookings are never touched; future availability stops querying
 * the calendar and the platform keeps booking through Supabase alone.
 */
/**
 * Route-level gate for calendar self-service. The allowlisted demo flow
 * stays open (backward compatible); every other business requires a
 * membership of the current session user. Throws 403 otherwise.
 */
export async function assertCalendarRouteAccess(businessId: string): Promise<string[]> {
  if (allowedBusinessIds().includes(businessId)) return [];
  const memberIds = await getMyBusinessIds().catch(() => [] as string[]);
  if (!memberIds.includes(businessId)) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "You don't have access to this business.",
    );
  }
  return memberIds;
}

export async function disconnectBusiness(
  businessId: string,
  memberBusinessIds: string[] = [],
): Promise<DisconnectResult> {
  await fetchBusiness(businessId);
  assertBusinessAllowed(businessId, memberBusinessIds);

  const connection = await getActiveConnection(businessId);
  if (!connection?.refreshToken) {
    await deactivateConnection(businessId);
    return { ok: true, revoked: false };
  }

  await revokeRefreshToken(connection.refreshToken);
  await deactivateConnection(businessId);
  return { ok: true, revoked: true };
}