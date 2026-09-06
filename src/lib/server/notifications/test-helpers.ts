/**
 * In-memory stand-in for the Supabase client surface the notification service
 * uses. Extends the Phase 3 memory-db pattern with upsert support and the
 * notifications/business_notification_settings tables.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface MemoryDb {
  tables: Record<string, unknown[]>;
  from: (table: string) => MemoryQuery;
}

export class MemoryQuery {
  private filters: Array<(row: Record<string, unknown>) => boolean> = [];
  private mode: "select" | "update" | "insert" | "upsert" = "select";
  private patch: Record<string, unknown> | null = null;
  private insertRows: Record<string, unknown> | null = null;
  private insertedId: string | null = null;

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

  update(p: Record<string, unknown>): this {
    this.mode = "update";
    this.patch = p;
    return this;
  }

  insert(rows: Record<string, unknown>): this {
    this.mode = "insert";
    this.insertRows = rows;
    const record = { ...rows };
    if (!record.id) record.id = `gen-${this.tables[this.table].length}`;
    this.insertedId = String(record.id);
    (this.tables[this.table] as unknown[]).push(record);
    return this;
  }

  upsert(rows: Record<string, unknown>): this {
    this.mode = "upsert";
    this.insertRows = rows;
    const matching = this.matching();
    if (matching.length > 0) {
      Object.assign(matching[0], rows);
      this.insertedId = String(matching[0].id ?? rows.id);
    } else {
      const record = { ...rows };
      if (!record.id) record.id = `gen-${this.tables[this.table].length}`;
      this.insertedId = String(record.id);
      (this.tables[this.table] as unknown[]).push(record);
    }
    return this;
  }

  private matching(): Record<string, unknown>[] {
    return (this.tables[this.table] ?? []).filter((row) =>
      this.filters.every((pred) => pred(row as Record<string, unknown>)),
    ) as Record<string, unknown>[];
  }

  async maybeSingle(): Promise<{ data: unknown; error: null }> {
    // If this is an insert/upsert returning a generated id, honour it first.
    if (this.insertedId != null && this.mode !== "select") {
      return { data: { id: this.insertedId }, error: null };
    }
    return { data: this.matching()[0] ?? null, error: null };
  }

  async single(): Promise<{ data: unknown; error: null }> {
    // insert().select("id").single() is the canonical Supabase id-return
    // pattern. The select() call changes mode to "select" but insertedId
    // remains set — honour it so records.ts gets the id it expects.
    if (this.insertedId != null) {
      return { data: { id: this.insertedId }, error: null };
    }
    return { data: this.matching()[0] ?? null, error: null };
  }

  then<TResult = { data: unknown; error: null }>(
    onfulfilled?: (value: { data: unknown; error: null }) => TResult,
  ) {
    return this.execute().then(onfulfilled as never);
  }

  execute(): Promise<{ data: unknown; error: null }> {
    if (this.mode === "update") {
      this.tables[this.table] = (this.tables[this.table] as Array<Record<string, unknown>>).map(
        (record) =>
          this.filters.every((pred) => pred(record))
            ? { ...record, ...this.patch }
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

export function createNotificationMemoryDb(): MemoryDb {
  const store = {
    tables: {
      notifications: [],
      business_notification_settings: [],
      bookings: [],
    } as Record<string, unknown[]>,
    from(table: string) {
      if (!store.tables[table]) store.tables[table] = [];
      return new MemoryQuery(store.tables, table);
    },
  };
  return store;
}

export function asSupabase(db: MemoryDb): unknown {
  return db as unknown as SupabaseClient;
}