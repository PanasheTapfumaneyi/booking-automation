import { describe, it, expect, afterEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptSecret } from "./crypto";
import {
  getActiveConnection,
  upsertConnection,
  deactivateConnection,
  persistRefreshedTokens,
} from "./repository";
import { createMemoryDb, connectionRow, type MemoryDb } from "./test-helpers";

afterEach(() => vi.unstubAllEnvs());

const asDb = (db: MemoryDb) => db as unknown as SupabaseClient;

describe("calendar_connections repository", () => {
  it("stores a connection and never exposes the plaintext token as-is", async () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "repo-test-key-value!");
    const db = createMemoryDb();
    await upsertConnection(
      {
        businessId: "biz-1",
        accountEmail: "owner@example.com",
        calendarId: "primary",
        scope: "events calendars.readonly",
        refreshToken: "tok-refresh",
        accessToken: "tok-access",
      },
      asDb(db),
    );

    const stored = db.tables.calendar_connections[0] as Record<string, unknown>;
    expect(stored.business_id).toBe("biz-1");
    // encrypted at rest — the raw secret does not appear anywhere
    expect(JSON.stringify(stored)).not.toContain("tok-refresh");

    const connection = await getActiveConnection("biz-1", asDb(db));
    expect(connection?.refreshToken).toBe("tok-refresh");
    expect(connection?.accessToken).toBe("tok-access");
    expect(connection?.calendarId).toBe("primary");
    expect(connection?.googleAccountEmail).toBe("owner@example.com");
  });

  it("preserves the existing refresh token when a reconnect supplies no replacement", async () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "repo-test-key-value!");
    const db = createMemoryDb();
    db.tables.calendar_connections.push(
      connectionRow({
        id: "conn-1",
        business_id: "biz-1",
        refresh_token: encryptSecret("original-refresh"),
        active: true,
      }),
    );

    const outcome = await upsertConnection(
      {
        businessId: "biz-1",
        accountEmail: "new@example.com",
        calendarId: "primary",
        refreshToken: null, // Google rarely re-issues one on reconnect
        accessToken: "fresh-access",
      },
      asDb(db),
    );
    expect(outcome.refreshTokenPreserved).toBe(true);
    const connection = await getActiveConnection("biz-1", asDb(db));
    expect(connection?.refreshToken).toBe("original-refresh");
    expect(connection?.googleAccountEmail).toBe("new@example.com");
  });

  it("overwrites the refresh token when Google issues a replacement", async () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "repo-test-key-value!");
    const db = createMemoryDb();
    db.tables.calendar_connections.push(
      connectionRow({
        business_id: "biz-1",
        refresh_token: encryptSecret("old-refresh"),
        active: true,
      }),
    );
    await upsertConnection(
      {
        businessId: "biz-1",
        calendarId: "primary",
        refreshToken: "rotated-refresh",
      },
      asDb(db),
    );
    const connection = await getActiveConnection("biz-1", asDb(db));
    expect(connection?.refreshToken).toBe("rotated-refresh");
  });

  it("deactivates the active connection (keeps history)", async () => {
    const db = createMemoryDb();
    db.tables.calendar_connections.push(connectionRow({ active: true }));
    await deactivateConnection("biz-1", asDb(db));
    const active = await getActiveConnection("biz-1", asDb(db));
    expect(active).toBeNull();
    const stored = db.tables.calendar_connections[0] as Record<string, unknown>;
    expect(stored.active).toBe(false);
  });

  it("persists replacement tokens from automatic refresh", async () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "repo-test-key-value!");
    const db = createMemoryDb();
    db.tables.calendar_connections.push(connectionRow({ id: "conn-1" }));
    await persistRefreshedTokens(
      "conn-1",
      { accessToken: "new-access", expiresAt: "2030-01-01T00:00:00.000Z" },
      asDb(db),
    );
    const [row] = db.tables.calendar_connections as Array<Record<string, unknown>>;
    expect(row.access_token).not.toContain("new-access");
    expect(row.access_token_expires_at).toBe("2030-01-01T00:00:00.000Z");
  });
});