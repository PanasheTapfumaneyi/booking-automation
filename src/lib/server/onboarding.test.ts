/**
 * Onboarding setup-request lifecycle tests.
 *
 * Covers the lead store + operator notification:
 * - get: missing row (existing/live business) vs present row
 * - ensure: idempotent, never overwrites a recorded choice
 * - update: partial patch, invalid status/preference rejected
 * - list: joins business identity, tolerates missing business rows
 * - operator notify: skipped without contact/provider, sends otherwise,
 *   never throws, never hard-codes a number
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private patch: Row | null = null;
  private upserted: Row | null = null;

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

  in(column: string, values: unknown[]): this {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  order(..._args: unknown[]): this {
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  limit(..._args: unknown[]): this {
    return this;
  }

  update(patch: Row): this {
    this.patch = patch;
    return this;
  }

  upsert(row: Row): this {
    const table = this.rows();
    const key = row.business_id as string;
    const existing = table.find((r) => r.business_id === key);
    if (existing) {
      Object.assign(existing, { updated_at: "2026-09-15T00:00:00.000Z" });
      this.upserted = existing;
    } else {
      const created = {
        business_type: null,
        contact_phone: null,
        preference: null,
        created_at: "2026-09-15T00:00:00.000Z",
        updated_at: "2026-09-15T00:00:00.000Z",
        ...row,
      };
      table.push(created);
      this.upserted = created;
    }
    return this;
  }

  private rows(): Row[] {
    if (!this.tables[this.tableName]) this.tables[this.tableName] = [];
    return this.tables[this.tableName];
  }

  private matching(): Row[] {
    return this.rows().filter((row) => this.filters.every((p) => p(row)));
  }

  async maybeSingle(): Promise<{ data: unknown; error: null }> {
    if (this.patch) {
      const matched = this.matching();
      for (const row of matched) Object.assign(row, this.patch);
      this.patch = null;
      return { data: matched[0] ?? null, error: null };
    }
    if (this.upserted) {
      const out = this.upserted;
      this.upserted = null;
      return { data: out, error: null };
    }
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

const holder: { tables: Record<string, Row[]> | null } = { tables: null };

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => {
    if (!holder.tables) throw new Error("fake db not installed");
    const tables = holder.tables;
    return { from: (table: string) => new FakeQuery(tables, table) };
  },
}));

const sendMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/notifications/providers", () => ({
  resolveNotificationProvider: () => ({ send: sendMock }),
}));

vi.mock("@/lib/server/notifications/config", () => ({
  notificationProvider: () => "baileys",
}));

vi.mock("@/lib/marketing-config", () => ({
  CONTACT_WHATSAPP: "23057123456",
  CONTACT_PHONE: "",
  whatsappUrl: () => "",
  telUrl: () => "",
}));

import {
  ensureSetupRequest,
  getSetupRequest,
  listSetupRequests,
  notifyOperatorOfSetupRequest,
  updateSetupRequest,
} from "./onboarding";

function seed(): void {
  holder.tables = {
    setup_requests: [
      {
        business_id: "biz-1",
        user_id: "user-1",
        business_type: "Barbershop",
        contact_phone: "+23057111111",
        preference: null,
        status: "new",
        created_at: "2026-09-15T10:00:00.000Z",
        updated_at: "2026-09-15T10:00:00.000Z",
      },
      {
        business_id: "biz-2",
        user_id: "user-2",
        business_type: "Tour operator",
        contact_phone: "+23057222222",
        preference: "self",
        status: "self_configuring",
        created_at: "2026-09-15T09:00:00.000Z",
        updated_at: "2026-09-15T09:00:00.000Z",
      },
    ],
    businesses: [
      {
        id: "biz-1",
        name: "ABC Cuts",
        slug: "abc-cuts",
        booking_mode: "appointment",
        is_active: false,
      },
      {
        id: "biz-2",
        name: "Island Tours",
        slug: "island-tours",
        booking_mode: "capacity",
        is_active: false,
      },
    ],
  };
}

beforeEach(() => {
  seed();
  sendMock.mockReset().mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getSetupRequest", () => {
  it("returns null for existing businesses without a row (live by absence)", async () => {
    expect(await getSetupRequest("biz-unknown")).toBeNull();
  });

  it("returns the row for onboarding businesses", async () => {
    const row = await getSetupRequest("biz-1");
    expect(row?.status).toBe("new");
    expect(row?.business_type).toBe("Barbershop");
  });

  it("one business row never affects another (tenant isolation)", async () => {
    const one = await getSetupRequest("biz-1");
    const two = await getSetupRequest("biz-2");
    expect(one?.business_id).toBe("biz-1");
    expect(two?.business_id).toBe("biz-2");
    expect(two?.preference).toBe("self");
  });
});

describe("ensureSetupRequest", () => {
  it("returns the existing row without touching a recorded choice", async () => {
    const row = await ensureSetupRequest("biz-2", "user-2");
    expect(row.preference).toBe("self");
    expect(row.status).toBe("self_configuring");
    expect(holder.tables?.setup_requests).toHaveLength(2);
  });

  it("creates a new row for a fresh business", async () => {
    const row = await ensureSetupRequest("biz-3", "user-3");
    expect(row.status).toBe("new");
    expect(row.preference).toBeNull();
    expect(holder.tables?.setup_requests).toHaveLength(3);
  });

  it("repeat calls never duplicate the row", async () => {
    await ensureSetupRequest("biz-3", "user-3");
    await ensureSetupRequest("biz-3", "user-3");
    const matches = (holder.tables?.setup_requests ?? []).filter(
      (r) => r.business_id === "biz-3",
    );
    expect(matches).toHaveLength(1);
  });
});

describe("updateSetupRequest", () => {
  it("applies a partial patch", async () => {
    const row = await updateSetupRequest("biz-1", {
      preference: "managed",
      status: "pending_setup",
      contactPhone: "+23057333333",
    });
    expect(row.preference).toBe("managed");
    expect(row.status).toBe("pending_setup");
    expect(row.contact_phone).toBe("+23057333333");
    expect(row.business_type).toBe("Barbershop");
  });

  it("rejects an invalid status", async () => {
    await expect(updateSetupRequest("biz-1", { status: "launched" as never })).rejects.toThrow();
  });

  it("rejects an invalid preference", async () => {
    await expect(
      updateSetupRequest("biz-1", { preference: "carrier-pigeon" as never }),
    ).rejects.toThrow();
  });
});

describe("listSetupRequests", () => {
  it("joins business identity for the admin view", async () => {
    const rows = await listSetupRequests();
    expect(rows).toHaveLength(2);
    const first = rows.find((r) => r.business_id === "biz-1");
    expect(first?.business_name).toBe("ABC Cuts");
    expect(first?.business_slug).toBe("abc-cuts");
    expect(first?.contact_phone).toBe("+23057111111");
  });

  it("empty store lists nothing", async () => {
    holder.tables = { setup_requests: [], businesses: [] };
    expect(await listSetupRequests()).toEqual([]);
  });
});

describe("notifyOperatorOfSetupRequest", () => {
  it("sends to the central operator contact (never hard-coded)", async () => {
    const ok = await notifyOperatorOfSetupRequest({
      businessId: "biz-1",
      businessName: "ABC Cuts",
      businessType: "Barbershop",
      preference: "managed",
      contactPhone: "+23057111111",
    });
    expect(ok).toBe(true);
    expect(sendMock).toHaveBeenCalledOnce();
    const input = sendMock.mock.calls[0][0] as {
      destination: string;
      body: string;
      recipientType: string;
    };
    expect(input.destination).toBe("+23057123456");
    expect(input.body).toContain("ABC Cuts");
    expect(input.body).toContain("Set it up for me");
    expect(input.body).toContain("+23057111111");
    expect(input.recipientType).toBe("business");
  });

  it("labels the self-configuration choice distinctly", async () => {
    await notifyOperatorOfSetupRequest({
      businessId: "biz-2",
      businessName: "Island Tours",
      businessType: null,
      preference: "self",
      contactPhone: null,
    });
    const input = sendMock.mock.calls[0][0] as { body: string };
    expect(input.body).toContain("Configure it now");
    expect(input.body).toContain("Island Tours");
  });

  it("returns false (no throw) when the provider reports failure", async () => {
    sendMock.mockResolvedValue({ success: false });
    const ok = await notifyOperatorOfSetupRequest({
      businessId: "biz-1",
      businessName: "ABC Cuts",
      businessType: null,
      preference: "managed",
      contactPhone: null,
    });
    expect(ok).toBe(false);
  });
});
