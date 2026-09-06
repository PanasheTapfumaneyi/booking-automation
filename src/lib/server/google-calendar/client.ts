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
 *
 * The generated googleapis methods are classes (not standalone functions):
 * invoking one detached from its resource object fails with "Cannot read
 * properties of undefined (reading 'context')". Every call therefore goes
 * through a closure that invokes the method as a member of its resource so
 * `this` stays bound, while the surface exposed to consumers remains the
 * stable, typed CalendarApi.
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
    calendarList: { get: (params: unknown, options?: unknown) => Promise<unknown> };
  };

  const request = async <T>(run: () => Promise<unknown>): Promise<T> => {
    return (await run()) as T;
  };
  const methodOptions = (options?: { timeout?: number }) => ({
    timeout: options?.timeout,
  });

  return {
    events: {
      insert: (input, options) =>
        request<{ data: { id?: string } }>(() =>
          svc.events.insert(input, methodOptions(options)),
        ),
      patch: (input, options) =>
        request<{ data: unknown }>(() =>
          svc.events.patch(input, methodOptions(options)),
        ),
      delete: (input, options) =>
        request<{ data: unknown }>(() =>
          svc.events.delete(input, methodOptions(options)),
        ),
      get: (input, options) =>
        request<{
          data: {
            start?: { dateTime?: string; timeZone?: string };
            end?: { dateTime?: string; timeZone?: string };
          };
        }>(() => svc.events.get(input, methodOptions(options))),
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
        }>(() => svc.freebusy.query(input, methodOptions(options))),
    },
    calendarList: {
      get: (input, options) =>
        request<{ data: { id?: string } }>(() =>
          svc.calendarList.get(input, methodOptions(options)),
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