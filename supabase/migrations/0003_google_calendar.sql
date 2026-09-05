-- =============================================================================
-- Phase 3 — Business-level Google Calendar integration
--
-- * calendar_connections: one active Google connection per business.
-- * bookings.* calendar sync tracking columns.
--
-- Nothing is dropped or renamed; existing data is untouched.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Calendar connections
-- -----------------------------------------------------------------------------
create table if not exists public.calendar_connections (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses (id) on delete cascade,
  provider              text not null default 'google',
  google_account_email  text,
  calendar_id           text not null,
  refresh_token         text,               -- encrypted server-side; never exposed
  access_token          text,               -- optional cache; never exposed
  access_token_expires_at timestamptz,
  scope                 text,
  connected_at          timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  active                boolean not null default true
);

-- At most one ACTIVE Google connection per business (deactivated rows are kept
-- for history; a resurrected connection inserts a fresh active row).
create unique index if not exists calendar_connections_one_active_per_business
  on public.calendar_connections (business_id)
  where active;

create index if not exists calendar_connections_business_id_idx
  on public.calendar_connections (business_id);

-- -----------------------------------------------------------------------------
-- 2. Booking ↔ calendar sync tracking
-- -----------------------------------------------------------------------------
alter table public.bookings
  add column if not exists calendar_sync_status text not null default 'not_connected',
  add column if not exists calendar_sync_error  text,
  add column if not exists calendar_synced_at   timestamptz;

do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.bookings'::regclass
      and attname = 'calendar_sync_status'
      and not exists (
        select 1 from pg_constraint
        where conrelid = 'public.bookings'::regclass
          and conname = 'bookings_calendar_sync_status_check'
      )
  ) then
    alter table public.bookings
      add constraint bookings_calendar_sync_status_check
        check (calendar_sync_status in ('not_connected', 'pending', 'synced', 'failed'));
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3. RLS — calendar_connections holds credentials; anonymous access is blocked.
-- -----------------------------------------------------------------------------
alter table public.calendar_connections enable row level security;

-- No policies are created: the server-only service-role client bypasses RLS,
-- while anonymous/publishable requests see nothing (consistent with every
-- other table created so far).