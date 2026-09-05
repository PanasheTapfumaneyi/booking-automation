import { google } from "googleapis";
import type { Credentials, OAuth2Client } from "google-auth-library";
import { requireOAuthConfig } from "./oauth";
import type { CalendarApi } from "./types";
import type { ServerCalendarConnection } from "./repository";

export interface ConnectedCalendarApi {
  api: CalendarApi;
  auth: OAuth2Client;
}

export interface TokenRefreshNotification {
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: string | null;
}

/** Called when the OAuth client obtains/renews tokens (persist them). */
export type OnTokens = (tokens: TokenRefreshNotification) => void;

function toCredentials(connection: ServerCalendarConnection): Credentials {
  const credentials: Credentials = {};
  if (connection.refreshToken) credentials.refresh_token = connection.refreshToken;
  if (connection.accessToken) credentials.access_token = connection.accessToken;
  if (connection.accessTokenExpiresAt) {
    const parsed = Date.parse(connection.accessTokenExpiresAt);
    if (Number.isFinite(parsed)) credentials.expiry_date = parsed;
  }
  return credentials;
}

/**
 * Wraps the googleapis calendar service into the injectable CalendarApi.
 * The googleapis methods are heavily overloaded; they are rebound through
 * `unknown` so consumers only ever see the stable CalendarApi surface.
 */
function wrapCalendarService(
  service: unknown,
): CalendarApi {
  const svc = service as {
    events: {
      insert: (params: unknown, options?: unknown) => Promise<unknown>;
      patch: (params: unknown, options?: unknown) => Promise<unknown>;
      delete: (params: unknown, options?: unknown) => Promise<unknown>;
      get: (params: unknown, options?: unknown) => Promise<unknown>;
    };
    freebusy: { query: (params: unknown, options?: unknown) => Promise<unknown> };
    about: { get: (params: unknown, options?: unknown) => Promise<unknown> };
  };

  const request = async <T>(
    fn: (params: unknown, options?: unknown) => Promise<unknown>,
    params: unknown,
    options?: { timeout?: number },
  ): Promise<T> => {
    const response = (await fn(params, { timeout: options?.timeout })) as T;
    return response;
  };

  return {
    events: {
      insert: (input, options) =>
        request<{ data: { id?: string } }>(svc.events.insert, input, options),
      patch: (input, options) =>
        request<{ data: unknown }>(svc.events.patch, input, options),
      delete: (input, options) =>
        request<{ data: unknown }>(svc.events.delete, input, options),
      get: (input, options) =>
        request<{
          data: {
            start?: { dateTime?: string; timeZone?: string };
            end?: { dateTime?: string; timeZone?: string };
          };
        }>(svc.events.get, input, options),
    },
    freebusy: {
      query: (input, options) =>
        request<{
          data: {
            calendars?: Record<
              string,
              { busy?: Array<{ start?: string; end?: string }>; errors?: unknown[] }
            >;
          };
        }>(svc.freebusy.query, input, options),
    },
    about: {
      get: (_input, options) =>
        request<{ data: { primaryCalendarId?: string; user?: { email?: string } } }>(
          svc.about.get,
          {},
          options,
        ),
    },
  };
}

/**
 * Builds an authenticated Calendar API client from a stored connection.
 *
 * The google-auth-library OAuth2 client automatically refreshes the access
 * token from the stored refresh token before each call whenever the current
 * token is missing or expired. Whenever Google issues fresh tokens (including
 * a possible new refresh token), onTokens is invoked so the platform can
 * persist replacements.
 */
export function createCalendarApiClient(
  connection: ServerCalendarConnection,
  onTokens?: OnTokens,
): ConnectedCalendarApi {
  const { clientId, clientSecret, redirectUri } = requireOAuthConfig();
  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  auth.setCredentials(toCredentials(connection));
  if (onTokens) {
    auth.on("tokens", (tokens) => {
      if (!tokens || typeof tokens !== "object") return;
      onTokens({
        accessToken: tokens.access_token ?? undefined,
        refreshToken: (tokens as Credentials & { refresh_token?: unknown })
          .refresh_token as string | undefined,
        expiresAt:
          typeof tokens.expiry_date === "number"
            ? new Date(tokens.expiry_date).toISOString()
            : undefined,
      });
    });
  }
  const service = google.calendar({ version: "v3", auth });
  return { api: wrapCalendarService(service), auth };
}