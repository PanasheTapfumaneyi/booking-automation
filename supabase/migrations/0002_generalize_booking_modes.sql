-- =============================================================================
-- Fade District — booking automation backend
-- Migration 0002: generalize booking modes (appointment / resource / capacity)
--
-- Additive + safe. Preserves all existing Fade District data. Adds:
--   * businesses.booking_mode                   (appointment | resource | capacity)
--   * resources                                (generic reservable things)
--   * booking_sessions                         (scheduled capacity occurrences)
--   * bookings.resource_id / session_id / quantity (nullable future-compatible)
--   * overlap constraints scoped per booking kind
--   * RLS enabled on all application tables
--
-- Run order: 0001 first, then 0002. Idempotent enough to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Booking mode
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'booking_mode') then
    create type public.booking_mode as enum ('appointment', 'resource', 'capacity');
  end if;
end
$$;

alter table public.businesses
  add column if not exists booking_mode public.booking_mode not null default 'appointment';

update public.businesses
   set booking_mode = 'appointment'
 where booking_mode is null;

create index if not exists businesses_booking_mode_idx
  on public.businesses (booking_mode);

-- -----------------------------------------------------------------------------
-- 2. Resources
-- -----------------------------------------------------------------------------
create table if not exists public.resources (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  name          text not null,
  resource_type text not null default 'generic',
  active        boolean not null default true,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists resources_business_active_idx
  on public.resources (business_id, active);

-- -----------------------------------------------------------------------------
-- 3. Booking sessions / departures (tours, classes, activities)
-- -----------------------------------------------------------------------------
create table if not exists public.booking_sessions (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  service_id  uuid not null references public.services (id) on delete restrict,
  start_time  timestamptz not null,
  end_time    timestamptz,
  capacity    integer not null check (capacity > 0),
  active      boolean not null default true,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint booking_sessions_time_order check (end_time is null or end_time > start_time)
);

create index if not exists booking_sessions_business_active_idx
  on public.booking_sessions (business_id, active);

create index if not exists booking_sessions_service_start_idx
  on public.booking_sessions (service_id, start_time);

-- -----------------------------------------------------------------------------
-- 4. Generalize bookings
-- -----------------------------------------------------------------------------
alter table public.bookings
  add column if not exists resource_id uuid references public.resources (id) on delete set null;

alter table public.bookings
  add column if not exists session_id uuid references public.booking_sessions (id) on delete set null;

alter table public.bookings
  add column if not exists quantity integer not null default 1 check (quantity > 0);

create index if not exists bookings_resource_id_idx on public.bookings (resource_id);
create index if not exists bookings_session_id_idx  on public.bookings (session_id);

-- -----------------------------------------------------------------------------
-- 5. Double-booking constraints, scoped per booking kind
--
--    appointment:  one active booking per business per time (no resource/session)
--    resource:     one active booking per resource per overlapping time
--    capacity:     no time-overlap constraint — many bookings share a session and
--                  overselling is prevented by the create_booking RPC (capacity lock)
--
-- Only "confirmed" and "rescheduled" statuses block availability. This is the
-- single source of truth mirrored in src/lib/server/database.ts as
-- BLOCKING_BOOKING_STATUSES. Keep the two lists in sync.
-- -----------------------------------------------------------------------------
alter table public.bookings drop constraint if exists bookings_no_overlap;

alter table public.bookings
  add constraint bookings_no_overlap exclude using gist (
    business_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (
    status in ('confirmed', 'rescheduled')
    and resource_id is null
    and session_id is null
  );

alter table public.bookings drop constraint if exists bookings_resource_no_overlap;

alter table public.bookings
  add constraint bookings_resource_no_overlap exclude using gist (
    resource_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (
    status in ('confirmed', 'rescheduled')
    and resource_id is not null
  );

-- -----------------------------------------------------------------------------
-- 6. Atomic, race-safe booking creation for all modes
--
-- Extended create_booking. The RPC runs as a single transaction, so the
-- capacity re-check ("select ... for update") and insert happen atomically —
-- the final line of defence against overselling capacity sessions.
--
-- The Phase 2 six-arg signature is dropped first: defaulted parameters create
-- a NEW overload instead of replacing the old one, which makes PostgREST
-- report an ambiguous call (PGRST203).
-- -----------------------------------------------------------------------------
drop function if exists public.create_booking(uuid, uuid, uuid, timestamptz, timestamptz, text) cascade;

create or replace function public.create_booking(
  p_business_id uuid,
  p_service_id  uuid,
  p_customer_id uuid,
  p_start_time  timestamptz,
  p_end_time    timestamptz,
  p_manage_token text,
  p_resource_id uuid default null,
  p_session_id  uuid default null,
  p_quantity    integer default 1
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking  public.bookings;
  v_capacity integer;
  v_booked   integer;
begin
  if p_quantity is null or p_quantity < 1 then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  -- Capacity guard: lock the session, sum active bookings, reject oversell.
  if p_session_id is not null then
    select s.capacity into v_capacity
      from public.booking_sessions s
     where s.id = p_session_id
       and s.active = true
       for update;

    if v_capacity is null then
      return jsonb_build_object('ok', false, 'code', 'SESSION_NOT_FOUND');
    end if;

    select coalesce(sum(b.quantity), 0) into v_booked
      from public.bookings b
     where b.session_id = p_session_id
       and b.status in ('confirmed', 'rescheduled');

    if v_booked + p_quantity > v_capacity then
      return jsonb_build_object('ok', false, 'code', 'CAPACITY_FULL');
    end if;
  end if;

  begin
    insert into public.bookings (
      id, business_id, service_id, customer_id,
      start_time, end_time, status, manage_token,
      resource_id, session_id, quantity
    )
    values (
      gen_random_uuid(), p_business_id, p_service_id, p_customer_id,
      p_start_time, p_end_time, 'confirmed', p_manage_token,
      p_resource_id, p_session_id, p_quantity
    )
    returning * into v_booking;
  exception
    when exclusion_violation then
      return jsonb_build_object('ok', false, 'code', 'SLOT_UNAVAILABLE');
    when unique_violation then
      return jsonb_build_object('ok', false, 'code', 'TOKEN_CONFLICT');
  end;

  return jsonb_build_object('ok', true, 'booking', to_jsonb(v_booking));
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Row level security
--
-- All application tables have RLS enabled with NO policies. The service-role
-- process bypasses RLS (BYPASSRLS), so the Next.js API layer is unaffected.
-- Anonymous / publishable-key queries are fully blocked: no customer or
-- booking-management data can be read directly. Enable RLS does not lock out
-- the app.
-- -----------------------------------------------------------------------------
alter table public.businesses      enable row level security;
alter table public.services        enable row level security;
alter table public.customers       enable row level security;
alter table public.bookings        enable row level security;
alter table public.resources       enable row level security;
alter table public.booking_sessions enable row level security;

-- -----------------------------------------------------------------------------
-- 8. Idempotent re-apply of the overlap guards (mirrors 0001 repair block)
-- -----------------------------------------------------------------------------
alter table public.bookings drop constraint if exists bookings_no_overlap;

alter table public.bookings
  add constraint bookings_no_overlap exclude using gist (
    business_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (
    status in ('confirmed', 'rescheduled')
    and resource_id is null
    and session_id is null
  );

alter table public.bookings drop constraint if exists bookings_resource_no_overlap;

alter table public.bookings
  add constraint bookings_resource_no_overlap exclude using gist (
    resource_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (
    status in ('confirmed', 'rescheduled')
    and resource_id is not null
  );