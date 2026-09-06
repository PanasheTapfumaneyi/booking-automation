-- =============================================================================
-- Phase 4 — Booking event notifications (provider-independent)
--
-- * notifications: audited delivery records for customer + business messages.
--   One row per (event, recipient_type, channel); messages are rendered and
--   sent at dispatch time — rendered bodies and WhatsApp JIDs are never
--   persisted here, only canonical E.164 destinations and outcomes.
-- * business_notification_settings: per-business enable flags + the owner's
--   WhatsApp destination (never hardcoded in source code).
--
-- Nothing is dropped, altered or renamed; existing data is untouched.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Notifications audit log
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id                uuid primary key default gen_random_uuid(),
  -- Unique identity of the booking operation (create/reschedule/cancel) that
  -- produced this notification. A retried delivery of the SAME event must not
  -- duplicate a message; two genuine operations always get different ids.
  event_id          text not null,
  business_id       uuid not null references public.businesses (id) on delete cascade,
  booking_id        uuid not null references public.bookings (id) on delete cascade,
  customer_id       uuid references public.customers (id) on delete set null,
  event_type        text not null check (
                      event_type in ('booking.created', 'booking.rescheduled', 'booking.cancelled')
                    ),
  recipient_type    text not null check (recipient_type in ('customer', 'business')),
  channel           text not null default 'whatsapp' check (channel = 'whatsapp'),
  -- Canonical E.164 destination (e.g. +23057123456). The WhatsApp JID
  -- (23057123456@c.us) is derived inside the provider adapter and never stored.
  destination       text not null,
  status            text not null default 'pending' check (
                      status in ('pending', 'processing', 'sent', 'failed', 'skipped')
                    ),
  provider          text not null,
  provider_message_id text,
  attempt_count     integer not null default 0 check (attempt_count >= 0),
  error_code        text check (
                      error_code in (
                        'OPENWA_UNAVAILABLE',
                        'OPENWA_AUTH_FAILED',
                        'OPENWA_SESSION_NOT_READY',
                        'OPENWA_SEND_FAILED',
                        'INVALID_PHONE'
                      )
                    ),
  error_message     text,
  -- Optional event context (e.g. previous/new start for reschedules).
  metadata          jsonb not null default '{}'::jsonb,
  sent_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- At most one delivery per (event, recipient, channel). This is the
-- idempotency guard: re-dispatching the same event inserts nothing.
create unique index if not exists notifications_event_recipient_channel_uq
  on public.notifications (event_id, recipient_type, channel);

create index if not exists notifications_business_id_idx
  on public.notifications (business_id);
create index if not exists notifications_booking_id_idx
  on public.notifications (booking_id);
create index if not exists notifications_status_idx
  on public.notifications (status);

-- -----------------------------------------------------------------------------
-- 2. Per-business notification settings
-- -----------------------------------------------------------------------------
create table if not exists public.business_notification_settings (
  business_id                   uuid primary key references public.businesses (id) on delete cascade,
  customer_notifications_enabled boolean not null default true,
  business_notifications_enabled boolean not null default true,
  whatsapp_enabled               boolean not null default true,
  -- The owner's WhatsApp destination (E.164). Left null until an owner is
  -- configured — business messages are then skipped, not failed.
  business_notification_phone    text,
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now()
);

-- Explicit default row for the Fade District demo business (no real phone
-- number is seeded — the owner's destination stays empty until configured).
insert into public.business_notification_settings (business_id)
values ('00000000-0000-4000-8000-000000000001')
on conflict (business_id) do nothing;

-- -----------------------------------------------------------------------------
-- 3. RLS — notifications carry customer contact data; no anonymous access.
-- -----------------------------------------------------------------------------
alter table public.notifications enable row level security;
alter table public.business_notification_settings enable row level security;

-- No policies are created: the server-only service-role client bypasses RLS,
-- while anonymous/publishable requests see nothing (consistent with every
-- other table created so far).