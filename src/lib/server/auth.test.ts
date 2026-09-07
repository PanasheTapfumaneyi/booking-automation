/**
 * Business auth + membership enforcement tests (Phase 6A).
 *
 * Identity is faked at the session-client boundary; the membership store is
 * faked at the Supabase boundary. Proves: anonymous → 401, non-member → 403,
 * member → context, owner role gate, and that user A can never reach
 * business B through these helpers.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getRequestUser,
  requireAuthenticatedUser,
  requireBusinessMembership,
  requireBusinessOwner,
  getMyMemberships,
  getMyBusinessIds,
  findMembership,
  businessHasMembers,
} from "./auth";
import { ApiError } from "./errors";

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];

  constructor(
    private tables: Record<string, Row[]>,
    private tableName: string,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  select(..._args: unknown[]): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  limit(_n: number): this {
    return this;
  }

  private matching(): Row[] {
    return (this.tables[this.tableName] ?? []).filter((row) =>
      this.filters.every((pred) => pred(row)),
    );
  }

  async maybeSingle(): Promise<{ data: unknown; error: null }> {
    return { data: this.matching()[0] ?? null, error: null };
  }

  then<TResult = { data: unknown; error: null }>(
    onfulfilled?: (value: { data: unknown; error: null }) => TResult,
  ) {
    return Promise.resolve({ data: this.matching(), error: null }).then(
      onfulfilled as never,
    );
  }
}

interface FakeDb {
  tables: Record<string, Row[]>;
  from: (table: string) => FakeQuery;
}

function createFakeDb(): FakeDb {
  const store: FakeDb = {
    tables: {},
    from(table: string) {
      return new FakeQuery(store.tables, table);
    },
  };
  return store;
}

const asDb = (db: FakeDb) => db as unknown as SupabaseClient;

function sessionClient(user: { id: string; email?: string | null } | null) {
  return {
    auth: {
      getUser: async () => ({ data: { user } }),
    },
  };
}

const BIZ_A = {
  id: "biz-a",
  name: "Alpha",
  phone: null,
  email: null,
  timezone: "Indian/Mauritius",
  booking_mode: "appointment",
  calendar_id: null,
  slug: "alpha",
  availability: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const BIZ_B = { ...BIZ_A, id: "biz-b", name: "Beta", slug: "beta" };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireAuthenticatedUser", () => {
  it("throws 401 for anonymous requests", async () => {
    const err = await requireAuthenticatedUser(sessionClient(null)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect((err as ApiError).code).toBe("UNAUTHENTICATED");
  });

  it("returns the verified session user", async () => {
    const user = await requireAuthenticatedUser(
      sessionClient({ id: "user-1", email: "owner@example.com" }),
    );
    expect(user).toEqual({ id: "user-1", email: "owner@example.com" });
  });

  it("getRequestUser returns null (no throw) when anonymous", async () => {
    await expect(getRequestUser(sessionClient(null))).resolves.toBeNull();
  });
});

describe("membership enforcement", () => {
  function seeded(): FakeDb {
    const db = createFakeDb();
    db.tables.businesses = [BIZ_A, BIZ_B];
    db.tables.business_members = [
      { id: "m-1", business_id: "biz-a", user_id: "user-1", role: "owner" },
      { id: "m-2", business_id: "biz-b", user_id: "user-2", role: "owner" },
      { id: "m-3", business_id: "biz-a", user_id: "user-3", role: "staff" },
    ];
    return db;
  }

  it("member reaches their own business with context", async () => {
    const db = seeded();
    const ctx = await requireBusinessMembership("biz-a", {
      client: sessionClient({ id: "user-1" }),
      db: asDb(db),
    });
    expect(ctx.user.id).toBe("user-1");
    expect(ctx.membership).toEqual({ business_id: "biz-a", role: "owner" });
    expect(ctx.business.id).toBe("biz-a");
  });

  it("user A cannot reach business B (403)", async () => {
    const db = seeded();
    const err = await requireBusinessMembership("biz-b", {
      client: sessionClient({ id: "user-1" }),
      db: asDb(db),
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(403);
    expect((err as ApiError).code).toBe("FORBIDDEN");
  });

  it("anonymous users get 401 before any membership check", async () => {
    const db = seeded();
    const err = await requireBusinessMembership("biz-a", {
      client: sessionClient(null),
      db: asDb(db),
    }).catch((e: unknown) => e);
    expect((err as ApiError).status).toBe(401);
  });

  it("missing business reads as 404 for members", async () => {
    const db = createFakeDb();
    db.tables.businesses = [];
    db.tables.business_members = [
      { id: "m-9", business_id: "biz-gone", user_id: "user-1", role: "owner" },
    ];
    const err = await requireBusinessMembership("biz-gone", {
      client: sessionClient({ id: "user-1" }),
      db: asDb(db),
    }).catch((e: unknown) => e);
    expect((err as ApiError).status).toBe(404);
  });

  it("owner gate passes owners and rejects non-owner roles", async () => {
    const db = seeded();
    await expect(
      requireBusinessOwner("biz-a", { client: sessionClient({ id: "user-1" }), db: asDb(db) }),
    ).resolves.toBeDefined();
    const err = await requireBusinessOwner("biz-a", {
      client: sessionClient({ id: "user-3" }),
      db: asDb(db),
    }).catch((e: unknown) => e);
    expect((err as ApiError).status).toBe(403);
  });

  it("getMyMemberships lists only the caller's rows", async () => {
    const db = seeded();
    expect(await getMyMemberships("user-1", asDb(db))).toEqual([
      { business_id: "biz-a", role: "owner" },
    ]);
    expect(await getMyMemberships("nobody", asDb(db))).toEqual([]);
  });

  it("getMyBusinessIds is empty for anonymous callers", async () => {
    await expect(getMyBusinessIds(sessionClient(null))).resolves.toEqual([]);
  });

  it("findMembership returns null across businesses (no leakage)", async () => {
    const db = seeded();
    expect(await findMembership("user-1", "biz-b", asDb(db))).toBeNull();
    expect(await findMembership("user-1", "biz-a", asDb(db))).toEqual({
      business_id: "biz-a",
      role: "owner",
    });
  });

  it("businessHasMembers reflects the table", async () => {
    const db = seeded();
    expect(await businessHasMembers("biz-a", asDb(db))).toBe(true);
    expect(await businessHasMembers("biz-empty", asDb(db))).toBe(false);
  });
});
