import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/server";
import { encryptSecret, readSecret } from "./crypto";

/**
 * Server-side view of a calendar connection. Decrypted secrets are only ever
 * held in memory inside server code; nothing here is exposed to routes/clients.
 */
export interface ServerCalendarConnection {
  id: string;
  businessId: string;
  provider: string;
  googleAccountEmail: string | null;
  calendarId: string;
  refreshToken: string | null;
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  scope: string | null;
  active: boolean;
  connectedAt: string;
  updatedAt: string;
}

interface ConnectionRow {
  id: string;
  business_id: string;
  provider: string;
  google_account_email: string | null;
  calendar_id: string;
  refresh_token: string | null;
  access_token: string | null;
  access_token_expires_at: string | null;
  scope: string | null;
  active: boolean;
  connected_at: string;
  updated_at: string;
}

function rowToConnection(row: unknown): ServerCalendarConnection {
  const r = row as ConnectionRow;
  return {
    id: r.id,
    businessId: r.business_id,
    provider: r.provider,
    googleAccountEmail: r.google_account_email,
    calendarId: r.calendar_id,
    refreshToken: r.refresh_token ? readSecret(r.refresh_token) : null,
    accessToken: r.access_token ? readSecret(r.access_token) : null,
    accessTokenExpiresAt: r.access_token_expires_at,
    scope: r.scope,
    active: r.active,
    connectedAt: r.connected_at,
    updatedAt: r.updated_at,
  };
}

export type DbLike = Pick<SupabaseClient, "from">;

function resolveDb(db?: SupabaseClient): SupabaseClient {
  return db ?? getSupabase();
}

/** Loads the active Google connection for a business, decrypting secrets. */
export async function getActiveConnection(
  businessId: string,
  db?: SupabaseClient,
): Promise<ServerCalendarConnection | null> {
  const client = resolveDb(db);
  const { data, error } = await client
    .from("calendar_connections")
    .select("*")
    .eq("business_id", businessId)
    .eq("active", true)
    .maybeSingle();
  if (error || !data) return null;
  return rowToConnection(data);
}

export interface UpsertConnectionInput {
  businessId: string;
  accountEmail?: string | null;
  calendarId: string;
  scope?: string | null;
  refreshToken?: string | null;
  accessToken?: string | null;
  accessTokenExpiresAt?: string | null;
}

/**
 * Stores (or updates) the active connection for a business.
 *
 * When reconnecting, Google only issues a refresh token on first consent.
 * If the exchange did not produce a new refresh token, the previously stored
 * one is preserved instead of being overwritten with null.
 */
export async function upsertConnection(
  input: UpsertConnectionInput,
  db?: SupabaseClient,
): Promise<{ id: string; refreshTokenPreserved: boolean }> {
  const client = resolveDb(db);
  const existing = await getActiveConnection(input.businessId, client);

  const refreshToken = input.refreshToken ?? existing?.refreshToken ?? null;
  const accessToken = input.accessToken ?? existing?.accessToken ?? null;

  if (existing) {
    const { error } = await client
      .from("calendar_connections")
      .update({
        google_account_email: input.accountEmail ?? existing.googleAccountEmail,
        calendar_id: input.calendarId,
        scope: input.scope ?? existing.scope,
        refresh_token: refreshToken ? encryptSecret(refreshToken) : null,
        access_token: accessToken ? encryptSecret(accessToken) : null,
        access_token_expires_at:
          input.accessTokenExpiresAt ?? existing.accessTokenExpiresAt,
        updated_at: new Date().toISOString(),
        active: true,
      })
      .eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, refreshTokenPreserved: Boolean(existing.refreshToken) };
  }

  const { data, error } = await client
    .from("calendar_connections")
    .insert({
      business_id: input.businessId,
      provider: "google",
      google_account_email: input.accountEmail ?? null,
      calendar_id: input.calendarId,
      scope: input.scope ?? null,
      refresh_token: refreshToken ? encryptSecret(refreshToken) : null,
      access_token: accessToken ? encryptSecret(accessToken) : null,
      access_token_expires_at: input.accessTokenExpiresAt ?? null,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      active: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  return {
    id: (data as { id: string }).id,
    refreshTokenPreserved: false,
  };
}

/** Marks the active connection inactive (disconnect). Keeps history. */
export async function deactivateConnection(
  businessId: string,
  db?: SupabaseClient,
): Promise<boolean> {
  const client = resolveDb(db);
  const { error } = await client
    .from("calendar_connections")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .eq("active", true);
  if (error) throw error;
  return true;
}

export interface PersistTokensInput {
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: string | null;
}

/**
 * Persists replacement tokens issued during automatic refresh.
 * Google sometimes rotates refresh tokens; the newest one is kept.
 */
export async function persistRefreshedTokens(
  connectionId: string,
  tokens: PersistTokensInput,
  db?: SupabaseClient,
): Promise<void> {
  const client = resolveDb(db);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (tokens.accessToken) {
    patch.access_token = encryptSecret(tokens.accessToken);
  }
  if (tokens.refreshToken) {
    patch.refresh_token = encryptSecret(tokens.refreshToken);
  }
  if (tokens.expiresAt) {
    patch.access_token_expires_at = tokens.expiresAt;
  }
  if (Object.keys(patch).length === 1) return;
  const { error } = await client
    .from("calendar_connections")
    .update(patch)
    .eq("id", connectionId);
  if (error) {
    console.error(
      "[google-calendar] failed to persist refreshed tokens:",
      error,
    );
  }
}