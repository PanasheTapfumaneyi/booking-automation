/**
 * Phase 5 reminder runner tests.
 *
 * The Supabase surface is faked (bookings, notifications, businesses,
 * business_notification_settings, calendar_connections). The transport is a
 * recording fake provider. A fixed clock keeps window tests deterministic.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  runDueReminders,
  reminderEventId,
  isReminderDue,
  REMINDER_WINDOW_MS,
} from "./reminders";
import { claimNotificationRow } from "./records";
import type {
  NotificationProvider,
  NotificationSendResult,
} from "@/lib/notifications/types";

type Row = Record<string, unknown>;

const HOUR = 3_600_000;
const BASE = Date.parse("2026-09-07T12:00:00.000Z");

// ---------------------------------------------------------------------------
// Fake Supabase surface (order/lte/limit/insert + unique-violation support)
// ---------------------------------------------------------------------------

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private patch: Row | null = null;
  private insertRow: Row | null = null;
  private ordering: Array<{ column: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
  private flushed: Row[] | null = null;

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

  neq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push((row) => (row[column] as string) < (value as string));
    return this;
  }

  lte(column: string, value: unknown): this {
    this.filters.push((row) => (row[column] as string) <= (value as string));
    return this;
  }

  gt(column: string, value: unknown): this {
    this.filters.push((row) => (row[column] as string) > (value as string));
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    this.ordering.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(n: number): this {
    this.limitCount = n;
    return this;
  }

  update(patch: Row): this {
    this.patch = patch;
    return this;
  }

  insert(row: Row): this {
    this.insertRow = { ...row };
    return this;
  }

  private rows(): Row[] {
    if (!this.tables[this.tableName]) this.tables[this.tableName] = [];
    return this.tables[this.tableName];
  }

  private matching(): Row[] {
    let out = this.rows().filter((row) => this.filters.every((p) => p(row)));
    for (const { column, ascending } of this.ordering) {
      out = [...out].sort((a, b) => {
        const av = a[column] as string;
        const bv = b[column] as string;
        return ascending ? (av < bv ? -1 : av > bv ? 1 : 0) : av > bv ? -1 : av < bv ? 1 : 0;
      });
    }
    if (this.limitCount !== null) out = out.slice(0, this.limitCount);
    return out;
  }

  private flush(): void {
    if (this.insertRow) return; // inserts resolve in single()/execute()
    if (!this.patch) {
      this.flushed = null;
      return;
    }
    const patch = this.patch;
    this.patch = null;
    const matched = this.matching();
    for (const row of matched) Object.assign(row, patch);
    this.flushed = matched;
  }

  private result(): Row[] {
    return this.flushed ?? this.matching();
  }

  private duplicateInsert(): boolean {
    if (!this.insertRow) return false;
    const row = this.insertRow;
    return this.rows().some(
      (r) =>
        r.event_id === row.event_id &&
        r.recipient_type === row.recipient_type &&
        r.channel === row.channel,
    );
  }

  async maybeSingle(): Promise<{ data: unknown; error: { code: string } | null }> {
    if (this.insertRow) {
      if (this.duplicateInsert()) return { data: null, error: { code: "23505" } };
      const record = { ...this.insertRow, id: this.insertRow.id ?? `gen-${this.rows().length}` };
      this.rows().push(record);
      this.insertRow = null;
      return { data: { id: record.id }, error: null };
    }
    this.flush();
    return { data: this.result()[0] ?? null, error: null };
  }

  async single(): Promise<{ data: unknown; error: { code: string } | null }> {
    return this.maybeSingle();
  }

  then<TResult = { data: unknown; error: null }>(
    onfulfilled?: (value: { data: unknown; error: null }) => TResult,
  ) {
    this.flush();
    return Promise.resolve({ data: this.result(), error: null }).then(onfulfilled as never);
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

// ---------------------------------------------------------------------------
// Recording provider + row factories
// ---------------------------------------------------------------------------

interface SentCall {
  destination: string;
  body: string;
}

function fakeProvider(impl?: (destination: string, body: string) => NotificationSendResult): {
  provider: NotificationProvider;
  calls: SentCall[];
} {
  const calls: SentCall[] = [];
  const provider: NotificationProvider = {
    name: "fake",
    async send(input) {
      calls.push({ destination: input.destination, body: input.body });
      return impl?.(input.destination, input.body) ?? { success: true, providerMessageId: "WA-1" };
    },
    async health() {
      return { configured: true, reachable: true, sessionReady: true };
    },
  };
  return { provider, calls };
}

function businessRow(): Row {
  return {
    id: "biz-1",
    name: "Fade District",
    phone: null,
    email: null,
    timezone: "Indian/Mauritius",
    booking_mode: "appointment",
    calendar_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function bookingRow(overrides: Row = {}): Row {
  return {
    id: "b-1",
    business_id: "biz-1",
    service_id: "svc-1",
    customer_id: "cust-1",
    resource_id: null,
    session_id: null,
    quantity: 1,
    start_time: new Date(BASE + 23 * HOUR + 50 * 60_000).toISOString(),
    end_time: new Date(BASE + 24 * HOUR + 35 * 60_000).toISOString(),
    status: "confirmed",
    google_event_id: null,
    manage_token: "tok-1",
    previous_start_time: null,
    created_at: "2026-09-06T00:00:00.000Z",
    updated_at: "2026-09-06T00:00:00.000Z",
    customer: { id: "cust-1", name: "Jean-Marc", phone: "+23057123456" },
    service: { name: "Haircut" },
    ...overrides,
  };
}

function notificationRow(overrides: Row = {}): Row {
  return {
    id: "n-1",
    event_id: "evt-1",
    business_id: "biz-1",
    booking_id: "b-1",
    customer_id: "cust-1",
    event_type: "booking.reminder.24h",
    recipient_type: "customer",
    channel: "whatsapp",
    destination: "+23057123456",
    status: "pending",
    provider: "fake",
    provider_message_id: null,
    attempt_count: 0,
    error_code: null,
    error_message: null,
    metadata: {},
    sent_at: null,
    created_at: new Date(BASE).toISOString(),
    updated_at: new Date(BASE).toISOString(),
    ...overrides,
  };
}

function seedDb(db: FakeDb, bookings: Row[] = [bookingRow()]): void {
  db.tables.businesses = [businessRow()];
  db.tables.bookings = bookings;
  db.tables.notifications = [];
  db.tables.calendar_connections = [];
}

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Window logic
// ---------------------------------------------------------------------------

describe("isReminderDue", () => {
  const at = (ms: number) => new Date(BASE + ms).toISOString();

  it("fires inside the 24h window and not outside it", () => {
    expect(isReminderDue("booking.reminder.24h", at(24 * HOUR), BASE)).toBe(true);
    expect(isReminderDue("booking.reminder.24h", at(24 * HOUR - REMINDER_WINDOW_MS + 1000), BASE)).toBe(true);
    expect(isReminderDue("booking.reminder.24h", at(25 * HOUR), BASE)).toBe(false); // too early
    expect(isReminderDue("booking.reminder.24h", at(24 * HOUR - REMINDER_WINDOW_MS), BASE)).toBe(false); // boundary
    expect(isReminderDue("booking.reminder.24h", at(23 * HOUR), BASE)).toBe(false); // too late
  });

  it("fires inside the 2h window and not outside it", () => {
    expect(isReminderDue("booking.reminder.2h", at(2 * HOUR), BASE)).toBe(true);
    expect(isReminderDue("booking.reminder.2h", at(2 * HOUR - 60_000), BASE)).toBe(true);
    expect(isReminderDue("booking.reminder.2h", at(3 * HOUR), BASE)).toBe(false);
    expect(isReminderDue("booking.reminder.2h", at(90 * 60_000), BASE)).toBe(false);
  });

  it("rejects unparseable timestamps", () => {
    expect(isReminderDue("booking.reminder.24h", "not-a-date", BASE)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Runner behavior
// ---------------------------------------------------------------------------

describe("runDueReminders", () => {
  it("sends the 24h reminder when eligible and persists the message id", async () => {
    const db = createFakeDb();
    seedDb(db);
    const { provider, calls } = fakeProvider();

    const summary = await runDueReminders({ db: asDb(db), now: BASE, provider });

    expect(summary).toEqual({ processed: 1, sent: 1, skipped: 0, failed: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0].destination).toBe("+23057123456");
    expect(calls[0].body).toContain("/manage/tok-1");
    const row = db.tables.notifications[0];
    expect(row.event_id).toBe(reminderEventId("b-1", "booking.reminder.24h"));
    expect(row.event_type).toBe("booking.reminder.24h");
    expect(row.recipient_type).toBe("customer");
    expect(row.status).toBe("sent");
    expect(row.provider_message_id).toBe("WA-1");
    expect(row.destination).toBe("+23057123456");
    // Customer only — no business row is ever created for reminders.
    expect(db.tables.notifications).toHaveLength(1);
  });

  it("sends the 2h reminder when eligible", async () => {
    const db = createFakeDb();
    seedDb(db, [
      bookingRow({
        start_time: new Date(BASE + 2 * HOUR - 5 * 60_000).toISOString(),
        end_time: new Date(BASE + 2 * HOUR + 40 * 60_000).toISOString(),
      }),
    ]);
    const { provider, calls } = fakeProvider();

    const summary = await runDueReminders({ db: asDb(db), now: BASE, provider });

    expect(summary).toEqual({ processed: 1, sent: 1, skipped: 0, failed: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toContain("about 2 hours");
    expect(db.tables.notifications[0].event_type).toBe("booking.reminder.2h");
  });

  it("does not send too early or past the window", async () => {
    const db = createFakeDb();
    seedDb(db, [
      bookingRow({ id: "b-early", start_time: new Date(BASE + 25 * HOUR).toISOString() }),
      bookingRow({ id: "b-late", start_time: new Date(BASE + 23 * HOUR).toISOString() }),
    ]);
    const { provider, calls } = fakeProvider();

    // b-early is beyond the scan horizon; b-late is fetched but out of window.
    const summary = await runDueReminders({ db: asDb(db), now: BASE, provider });

    expect(summary).toEqual({ processed: 0, sent: 0, skipped: 0, failed: 0 });
    expect(calls).toHaveLength(0);
    expect(db.tables.notifications).toHaveLength(0);
  });

  it("never reminds cancelled bookings", async () => {
    const db = createFakeDb();
    seedDb(db, [bookingRow({ status: "cancelled" })]);
    const { provider, calls } = fakeProvider();

    const summary = await runDueReminders({ db: asDb(db), now: BASE, provider });

    expect(summary.processed).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("repeated runs do not duplicate (idempotent)", async () => {
    const db = createFakeDb();
    seedDb(db);
    const { provider, calls } = fakeProvider();

    const first = await runDueReminders({ db: asDb(db), now: BASE, provider });
    const second = await runDueReminders({ db: asDb(db), now: BASE, provider });

    expect(first).toEqual({ processed: 1, sent: 1, skipped: 0, failed: 0 });
    expect(second).toEqual({ processed: 1, sent: 0, skipped: 1, failed: 0 });
    expect(calls).toHaveLength(1);
    expect(db.tables.notifications).toHaveLength(1);
  });

  it("sends 2h later after 24h was already sent", async () => {
    const db = createFakeDb();
    const start = BASE + 23 * HOUR + 50 * 60_000;
    seedDb(db, [bookingRow({ start_time: new Date(start).toISOString() })]);
    const { provider, calls } = fakeProvider();

    await runDueReminders({ db: asDb(db), now: BASE, provider });
    expect(db.tables.notifications).toHaveLength(1);

    const later = start - (2 * HOUR - 5 * 60_000);
    const summary = await runDueReminders({ db: asDb(db), now: later, provider });

    expect(summary).toEqual({ processed: 1, sent: 1, skipped: 0, failed: 0 });
    expect(calls).toHaveLength(2);
    expect(calls[1].body).toContain("about 2 hours");
    expect(db.tables.notifications).toHaveLength(2);
  });

  it("reschedule before sending moves the unsent reminder to the new time", async () => {
    const db = createFakeDb();
    // Far future: nothing eligible yet.
    seedDb(db, [bookingRow({ start_time: new Date(BASE + 48 * HOUR).toISOString() })]);
    const { provider, calls } = fakeProvider();

    const idle = await runDueReminders({ db: asDb(db), now: BASE, provider });
    expect(idle.processed).toBe(0);
    expect(db.tables.notifications).toHaveLength(0);

    // Booking moves to tomorrow — same row identity, new schedule.
    db.tables.bookings[0].start_time = new Date(BASE + 23 * HOUR + 50 * 60_000).toISOString();
    const summary = await runDueReminders({ db: asDb(db), now: BASE, provider });

    expect(summary).toEqual({ processed: 1, sent: 1, skipped: 0, failed: 0 });
    expect(calls).toHaveLength(1);
    expect(db.tables.notifications).toHaveLength(1);
  });

  it("reschedule after the 24h send does not resend 24h", async () => {
    const db = createFakeDb();
    seedDb(db);
    const { provider, calls } = fakeProvider();

    await runDueReminders({ db: asDb(db), now: BASE, provider });
    expect(calls).toHaveLength(1);

    // Move the booking a week out; the sent 24h row is found by stable id.
    db.tables.bookings[0].start_time = new Date(BASE + 7 * 24 * HOUR).toISOString();
    const summary = await runDueReminders({ db: asDb(db), now: BASE, provider });

    expect(summary.processed).toBe(0);
    expect(calls).toHaveLength(1);
    expect(db.tables.notifications).toHaveLength(1);
  });

  it("cancellation after the 24h send prevents the 2h reminder", async () => {
    const db = createFakeDb();
    const start = BASE + 23 * HOUR + 50 * 60_000;
    seedDb(db, [bookingRow({ start_time: new Date(start).toISOString() })]);
    const { provider, calls } = fakeProvider();

    await runDueReminders({ db: asDb(db), now: BASE, provider });
    expect(calls).toHaveLength(1);

    db.tables.bookings[0].status = "cancelled";
    const later = start - (2 * HOUR - 5 * 60_000);
    const summary = await runDueReminders({ db: asDb(db), now: later, provider });

    expect(summary.processed).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it("provider failure records failed, continues with others, and never touches bookings", async () => {
    const db = createFakeDb();
    const bookingA = bookingRow({ id: "b-a", manage_token: "tok-a" });
    const bookingB = bookingRow({ id: "b-b", manage_token: "tok-b" });
    seedDb(db, [bookingA, bookingB]);
    const { provider, calls } = fakeProvider((destination) =>
      destination === "+23057123456"
        ? { success: false, retryable: true, errorCode: "BAILEYS_SEND_FAILED" }
        : { success: true, providerMessageId: "WA-9" },
    );
    // Second booking uses a different customer number so only it succeeds.
    db.tables.bookings[1].customer = { id: "cust-2", name: "Ravi", phone: "+23057222222" };

    const summary = await runDueReminders({ db: asDb(db), now: BASE, provider });

    expect(summary).toEqual({ processed: 2, sent: 1, skipped: 0, failed: 1 });
    expect(calls).toHaveLength(2);
    const failed = db.tables.notifications.find((r) => r.booking_id === "b-a");
    expect(failed?.status).toBe("failed");
    expect(failed?.error_code).toBe("BAILEYS_SEND_FAILED");
    // Bookings are never modified by the reminder run.
    expect(db.tables.bookings[0].status).toBe("confirmed");
    expect(db.tables.bookings[0].start_time).toBe(bookingA.start_time);
  });

  it("a failed reminder is retried against the same row while still in window", async () => {
    const db = createFakeDb();
    seedDb(db);
    let fail = true;
    const { provider, calls } = fakeProvider(() =>
      fail
        ? { success: false, retryable: true, errorCode: "BAILEYS_UNAVAILABLE" }
        : { success: true, providerMessageId: "WA-2" },
    );

    const first = await runDueReminders({ db: asDb(db), now: BASE, provider });
    expect(first).toEqual({ processed: 1, sent: 0, skipped: 0, failed: 1 });

    fail = false;
    const second = await runDueReminders({ db: asDb(db), now: BASE, provider });
    expect(second).toEqual({ processed: 1, sent: 1, skipped: 0, failed: 0 });
    expect(calls).toHaveLength(2);
    expect(db.tables.notifications).toHaveLength(1);
    expect(db.tables.notifications[0].status).toBe("sent");
    expect(db.tables.notifications[0].attempt_count).toBe(2);
  });

  it("skips when customer notifications are disabled and creates nothing", async () => {
    const db = createFakeDb();
    seedDb(db);
    db.tables.business_notification_settings = [
      {
        business_id: "biz-1",
        customer_notifications_enabled: false,
        business_notifications_enabled: true,
        whatsapp_enabled: true,
        business_notification_phone: null,
      },
    ];
    const { provider, calls } = fakeProvider();

    const summary = await runDueReminders({ db: asDb(db), now: BASE, provider });

    expect(summary).toEqual({ processed: 1, sent: 0, skipped: 1, failed: 0 });
    expect(calls).toHaveLength(0);
    expect(db.tables.notifications).toHaveLength(0);
  });

  it("records INVALID_PHONE without throwing for an unusable number", async () => {
    const db = createFakeDb();
    seedDb(db, [
      bookingRow({ customer: { id: "cust-1", name: "Jean-Marc", phone: "12345" } }),
    ]);
    const { provider, calls } = fakeProvider();

    const summary = await runDueReminders({ db: asDb(db), now: BASE, provider });

    expect(summary).toEqual({ processed: 1, sent: 0, skipped: 0, failed: 1 });
    expect(calls).toHaveLength(0);
    expect(db.tables.notifications[0].status).toBe("failed");
    expect(db.tables.notifications[0].error_code).toBe("INVALID_PHONE");
  });

  it("overlapping runs send only once (loser skips on the lost claim)", async () => {
    // Frozen clock: the winner's claim timestamp equals `now`, so the loser
    // deterministically sees a fresh `processing` row regardless of wall time.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(BASE);
      const db = createFakeDb();
      seedDb(db);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const { provider, calls } = fakeProvider();
      provider.send = async (input) => {
        calls.push({ destination: input.destination, body: input.body });
        await gate;
        return { success: true, providerMessageId: "WA-1" };
      };

      const runA = runDueReminders({ db: asDb(db), now: BASE, provider });
      await vi.advanceTimersByTimeAsync(50); // A claims and enters send.
      const runB = runDueReminders({ db: asDb(db), now: BASE, provider });
      await vi.advanceTimersByTimeAsync(50); // B scans, sees processing, skips.
      release();
      await vi.advanceTimersByTimeAsync(50);
      const [summaryA, summaryB] = await Promise.all([runA, runB]);

      expect(calls).toHaveLength(1);
      expect(summaryA.sent + summaryB.sent).toBe(1);
      expect(summaryA.sent + summaryB.sent + summaryA.skipped + summaryB.skipped).toBe(2);
      expect(db.tables.notifications).toHaveLength(1);
      expect(db.tables.notifications[0].status).toBe("sent");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reclaims a stale processing row left by a crashed run", async () => {
    const db = createFakeDb();
    seedDb(db);
    db.tables.notifications = [
      notificationRow({
        id: "n-stale",
        event_id: reminderEventId("b-1", "booking.reminder.24h"),
        status: "processing",
        attempt_count: 1,
        updated_at: new Date(BASE - 60 * 60_000).toISOString(),
      }),
    ];
    const { provider, calls } = fakeProvider();

    const summary = await runDueReminders({ db: asDb(db), now: BASE, provider });

    expect(summary).toEqual({ processed: 1, sent: 1, skipped: 0, failed: 0 });
    expect(calls).toHaveLength(1);
    expect(db.tables.notifications).toHaveLength(1);
    expect(db.tables.notifications[0].status).toBe("sent");
  });

  it("does not touch a fresh processing row (another run is sending)", async () => {
    const db = createFakeDb();
    seedDb(db);
    db.tables.notifications = [
      notificationRow({
        id: "n-live",
        event_id: reminderEventId("b-1", "booking.reminder.24h"),
        status: "processing",
        attempt_count: 1,
        updated_at: new Date(BASE).toISOString(),
      }),
    ];
    const { provider, calls } = fakeProvider();

    const summary = await runDueReminders({ db: asDb(db), now: BASE, provider });

    expect(summary).toEqual({ processed: 1, sent: 0, skipped: 1, failed: 0 });
    expect(calls).toHaveLength(0);
  });

  it("reminder body uses the business timezone", async () => {
    const db = createFakeDb();
    seedDb(db);
    const { provider, calls } = fakeProvider();
    await runDueReminders({ db: asDb(db), now: BASE, provider });
    // Start 11:50 UTC renders as 15:50 wall-clock in Indian/Mauritius (+4).
    expect(calls[0].body).toContain("Fade District");
    expect(calls[0].body).toContain("Haircut");
    expect(calls[0].body).toContain("15:50");
    expect(calls[0].body).not.toContain("11:50");
  });
});

// ---------------------------------------------------------------------------
// Atomic claim unit tests
// ---------------------------------------------------------------------------

describe("claimNotificationRow", () => {
  it("exactly one of two racers wins the claim", async () => {
    const db = createFakeDb();
    db.tables.notifications = [notificationRow({ id: "n-race", status: "failed", attempt_count: 2 })];
    const client = asDb(db);

    const first = await claimNotificationRow("n-race", { attemptCount: 2, statuses: ["pending", "failed"] }, client);
    const second = await claimNotificationRow("n-race", { attemptCount: 2, statuses: ["pending", "failed"] }, client);

    expect(first).toEqual({ claimed: true, attemptCount: 3 });
    expect(second).toEqual({ claimed: false, attemptCount: 2 });
  });

  it("refuses to claim a sent row", async () => {
    const db = createFakeDb();
    db.tables.notifications = [notificationRow({ id: "n-sent", status: "sent", attempt_count: 1 })];

    const result = await claimNotificationRow(
      "n-sent",
      { attemptCount: 1, statuses: ["pending", "failed"] },
      asDb(db),
    );
    expect(result.claimed).toBe(false);
  });
});
