import type { CalendarApi } from "./types";

/**
 * In-memory stand-in for the Supabase client surface the server layer uses.
 * Enough of the fluent query builder is implemented to exercise repository and
 * sync logic without a database.
 */
export interface MemoryDb {
  tables: Record<string, unknown[]>;
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
  from: (table: string) => MemoryQuery;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: null }>;
}

export class MemoryQuery {
  private filters: Array<(row: Record<string, unknown>) => boolean> = [];
  private mode: "select" | "update" | "insert" | "read" = "read";

  constructor(
    private tables: Record<string, unknown[]>,
    private table: string,
  ) {}

  select(): this {
    this.mode = "select";
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  update(patch: Record<string, unknown>): this {
    this.mode = "update";
    this.updatePatch = patch;
    return this;
  }

  insert(rows: Record<string, unknown>): this {
    this.mode = "insert";
    this.insertRows = rows;
    const record: Record<string, unknown> = { ...rows };
    if (!record.id) record.id = `generated-${this.tables[this.table].length}`;
    this.insertedId = String(record.id);
    (this.tables[this.table] as unknown[]).push(record);
    return this;
  }

  private updatePatch: Record<string, unknown> | null = null;
  private insertRows: Record<string, unknown> | null = null;
  private insertedId: string | null = null;

  private matching(): Record<string, unknown>[] {
    return (this.tables[this.table] ?? []).filter((row) =>
      this.filters.every((pred) => pred(row as Record<string, unknown>)),
    ) as Record<string, unknown>[];
  }

  async maybeSingle(): Promise<{ data: unknown; error: null }> {
    return { data: this.matching()[0] ?? null, error: null };
  }

  async single(): Promise<{ data: unknown; error: null }> {
    if (this.insertedId != null) return { data: { id: this.insertedId }, error: null };
    return { data: this.matching()[0] ?? null, error: null };
  }

  then<TResult1 = { data: unknown; error: null }>(
    onfulfilled?: (value: { data: unknown; error: null }) => TResult1,
  ) {
    return this.execute().then(onfulfilled as never);
  }

  execute(): Promise<{ data: unknown; error: null }> {
    if (this.mode === "update") {
      this.tables[this.table] = (this.tables[this.table] as Array<Record<string, unknown>>).map(
        (record) =>
          this.filters.every((pred) => pred(record))
            ? { ...record, ...this.updatePatch }
            : record,
      );
      return Promise.resolve({ data: null, error: null });
    }
    return Promise.resolve({
      data: this.insertRows ? [{ id: this.insertedId }] : this.matching(),
      error: null,
    });
  }
}

export function createMemoryDb(): MemoryDb {
  const store = {
    tables: { calendar_connections: [], bookings: [] } as Record<string, unknown[]>,
    rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
    from(table: string) {
      if (!store.tables[table]) store.tables[table] = [];
      return new MemoryQuery(store.tables, table);
    },
    rpc(fn: string, args: Record<string, unknown>) {
      store.rpcCalls.push({ fn, args });
      return Promise.resolve({ data: { ok: true }, error: null });
    },
  };
  return store;
}

/** A connection row as stored (encrypted) in the fake calendar_connections table. */
export function connectionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "conn-1",
    business_id: "biz-1",
    provider: "google",
    google_account_email: "fade@example.com",
    calendar_id: "primary",
    refresh_token: "plain:rt-refresh",
    access_token: "plain:rt-access",
    access_token_expires_at: null,
    scope: "events calendars.readonly",
    active: true,
    connected_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export interface FakeCalendarApiConfig {
  busy?: Array<{ start: string; end: string }>;
  ownEvent?: { start?: string; end?: string } | null;
  insertThrows?: unknown;
  patchThrows?: unknown;
  deleteThrows?: unknown;
  getThrows?: unknown;
  freebusyThrows?: unknown;
}

/** A recording fake of the CalendarApi slice the app uses. */
export function createFakeCalendarApi(config: FakeCalendarApiConfig = {}) {
  const calls: {
    insert: unknown[];
    patch: unknown[];
    delete: unknown[];
    get: unknown[];
    freebusy: unknown[];
  } = { insert: [], patch: [], delete: [], get: [], freebusy: [] };

  const api: CalendarApi = {
    events: {
      insert: async (input) => {
        calls.insert.push(input);
        if (config.insertThrows) throw config.insertThrows;
        return { data: { id: `event-${calls.insert.length}` } };
      },
      patch: async (input) => {
        calls.patch.push(input);
        if (config.patchThrows) throw config.patchThrows;
        return { data: {} };
      },
      delete: async (input) => {
        calls.delete.push(input);
        if (config.deleteThrows) throw config.deleteThrows;
        return { data: {} };
      },
      get: async (input) => {
        calls.get.push(input);
        if (config.getThrows) throw config.getThrows;
        return {
          data: {
            start: config.ownEvent?.start ? { dateTime: config.ownEvent.start } : undefined,
            end: config.ownEvent?.end ? { dateTime: config.ownEvent.end } : undefined,
          },
        };
      },
    },
    freebusy: {
      query: async (input) => {
        calls.freebusy.push(input);
        if (config.freebusyThrows) throw config.freebusyThrows;
        const calendarId = input.requestBody.items[0].id;
        return {
          data: {
            calendars: { [calendarId]: { busy: config.busy ?? [] } },
          },
        };
      },
    },
    about: {
      get: async () => ({ data: { primaryCalendarId: "primary" } }),
    },
  };

  return { api, calls };
}