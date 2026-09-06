# Phase 5 — Timed reminders: policy + manual validation

Customer-only WhatsApp reminders, scheduler-driven, on top of the Phase 4
notification architecture (nothing in booking create/reschedule/cancel,
confirmations, providers, or transports changed).

## Reminder policy

- Types: `booking.reminder.24h` (lead time 24h) and `booking.reminder.2h`
  (lead time 2h). Extend `REMINDER_OFFSETS_MS` in
  `src/lib/server/notifications/reminders.ts` to add more.
- A reminder fires once its booking is within its lead time but no earlier
  than `lead − 15 min` (`REMINDER_WINDOW_MS`). Designed for a scheduler
  running every 5–15 minutes; tolerant of jitter, never early, never
  exact-second.
- Identity: stable event id `reminder:{bookingId}:{type}` in the existing
  `notifications` table — one row per (booking, reminder type) max.
- Reschedule: unsent reminders follow the new start automatically
  (eligibility always uses the current `start_time`); already-`sent`
  reminders are never re-sent (found by stable id).
- Cancelled bookings are excluded from the scan — no future reminders.
  (The Phase 4 cancellation message is untouched.)
- Failures: a failed provider call writes a `failed` row and the run
  continues. While still inside its window, the next run retries the SAME
  row (`attempt_count` grows, no duplicates). Outside the window it stays
  failed — no retry scheduler yet (Phase 6+).
- Concurrency: claims are atomic compare-and-swap on
  `(status, attempt_count)` (`claimNotificationRow`). Overlapping runs race
  the claim; exactly one wins. Fresh `processing` rows are left alone;
  `processing` older than 15 minutes is reclaimed (crashed-run recovery).

## Endpoint

`POST /api/internal/reminders/run`

```bash
curl -X POST http://localhost:3000/api/internal/reminders/run \
  -H "Authorization: Bearer $REMINDER_CRON_SECRET"
```

- `401` wrong/missing secret · `503` secret unconfigured or notifications
  disabled (`NOTIFICATION_PROVIDER=none`)
- `200` operational counts only (no phones, tokens, or bodies):
  `{ "processed": 10, "sent": 6, "skipped": 3, "failed": 1 }`

Safe to call repeatedly and concurrently.

## Manual validation (local)

Prerequisites: migrations `0004`–`0006` applied, `NOTIFICATION_PROVIDER=baileys`,
`BAILEYS_*` configured, baileys-service running + linked, `REMINDER_CRON_SECRET`
set in `.env.local`, Next.js restarted.

1. **Test booking for the 2h window.** During business hours, book the
   nearest available slot on the site (~1h45m–2h out), or insert one
   directly so `start_time` is ~110 minutes in the future:
   ```sql
   insert into public.bookings
     (business_id, service_id, customer_id, start_time, end_time, status, manage_token)
   values (
     '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000101',
     '00000000-0000-4000-8000-000000000201',
     now() + interval '110 minutes',
     now() + interval '155 minutes',
     'confirmed',
     'manual-reminder-test-1'
   );
   ```
2. **Run the endpoint** (curl above). Expect `sent: 1`.
3. **Verify WhatsApp**: the customer number gets the "in about 2 hours"
   reminder with the manage link.
4. **Verify the DB row**: `notifications` has one
   `booking.reminder.2h` row for the booking: `status = sent`,
   `provider = baileys`, `provider_message_id` set, `destination` E.164.
5. **Run the endpoint again**: expect `sent: 0, skipped: 1` — no duplicate.
6. **24h case**: repeat with `start_time ≈ now() + interval '23 hours 50 minutes'`;
   expect the "tomorrow" wording and a `booking.reminder.24h` row.
7. **Cancelled booking**: cancel a booking due a reminder (site manage link
   or SQL `status = 'cancelled'`), run the endpoint — `processed: 0`.
8. **Provider down**: stop baileys-service, run the endpoint for an eligible
   booking — `failed: 1`, row `failed` with a `BAILEYS_*` code, booking row
   untouched. Restart the service afterwards.
9. **Reschedule**: move an un-reminded booking via its manage link so the new
   start enters a window; run — one send, still one row. Move an already
   `sent`-reminder booking; run — no resend.
10. **24h → 2h progression**: after a `sent` 24h row, advance the booking
    (or wait) into the 2h window; run — exactly one new `2h` row.

## Later scheduling options (not built yet)

- **Vercel Cron**: `vercel.json` `{ "crons": [{ "path": "/api/internal/reminders/run", "schedule": "*/10 * * * *" }] }`
  with `REMINDER_CRON_SECRET` as a project env var (cron sends no auth
  header by default — keep the Bearer check; use an edge-safe fetch from
  the cron job or switch to a query-param secret then).
- **GitHub Actions**: `schedule: - cron: "*/10 * * * *"` + curl step with
  the secret from Actions secrets (self-hosted runner or public URL needed).
- **External cron** (cron-job.org, EasyCron, systemd timer): HTTPS POST with
  the Bearer header on the same cadence.
- **Always-on server**: a tiny loop/timer process calling the endpoint;
  never in-browser timers.
