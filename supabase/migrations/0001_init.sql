-- =============================================================================
-- Fade District — booking automation backend
-- Migration 0001: core schema (businesses, services, customers, bookings)
-- Run against a fresh Supabase project:
--   supabase db push            (or)  psql "$DATABASE_URL" -f 0001_init.sql
-- =============================================================================

-- btree_gist powers the time-overlap exclusion constraint below.
create extension if not exists btree_gist;

-- -----------------------------------------------------------------------------
-- businesses
-- -----------------------------------------------------------------------------
create table if not exists public.businesses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  email       text,
  timezone    text not null default 'Indian/Mauritius',
  calendar_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- services
-- -----------------------------------------------------------------------------
create table if not exists public.services (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  name             text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  price            numeric not null check (price >= 0),
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists services_business_id_idx on public.services (business_id);

-- -----------------------------------------------------------------------------
-- customers
-- -----------------------------------------------------------------------------
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text not null,
  phone       text not null,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists customers_business_phone_idx on public.customers (business_id, phone);

-- -----------------------------------------------------------------------------
-- bookings
-- -----------------------------------------------------------------------------
create table if not exists public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses (id) on delete cascade,
  service_id          uuid not null references public.services (id) on delete restrict,
  customer_id         uuid not null references public.customers (id) on delete restrict,

  start_time          timestamptz not null,
  end_time            timestamptz not null,

  status              text not null check (
                        status in ('confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show')
                      ),

  google_event_id     text,
  manage_token        text unique not null,
  previous_start_time timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint bookings_time_order check (end_time > start_time),

  -- Hard double-booking protection: an active booking's time range can never
  -- overlap another active booking for the same business, enforced at the
  -- database level (the final line of defence after application checks).
  constraint bookings_no_overlap exclude using gist (
    business_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (status in ('confirmed', 'rescheduled'))
);

create index if not exists bookings_business_id_idx  on public.bookings (business_id);
create index if not exists bookings_service_id_idx  on public.bookings (service_id);
create index if not exists bookings_customer_id_idx on public.bookings (customer_id);
create index if not exists bookings_start_time_idx  on public.bookings (start_time);
create index if not exists bookings_status_idx      on public.bookings (status);
create index if not exists bookings_calendar_id_idx on public.bookings (google_event_id);

-- -----------------------------------------------------------------------------
-- RPC helpers (atomic, race-safe mutations used by the API layer)
-- -----------------------------------------------------------------------------

-- Creates a booking, guarding against overlapping active bookings.
-- Returns jsonb instead of raising, so PostgREST can surface the conflict.
create or replace function public.create_booking(
  p_business_id uuid,
  p_service_id  uuid,
  p_customer_id uuid,
  p_start_time  timestamptz,
  p_end_time    timestamptz,
  p_manage_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  begin
    insert into public.bookings (
      id, business_id, service_id, customer_id,
      start_time, end_time, status, manage_token
    )
    values (
      gen_random_uuid(), p_business_id, p_service_id, p_customer_id,
      p_start_time, p_end_time, 'confirmed', p_manage_token
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

-- Atomically moves an active booking to a new time, recording the previous
-- time and marking it as rescheduled. Detects overlaps and concurrent
-- cancellations.
create or replace function public.update_booking_time(
  p_booking_id uuid,
  p_start_time timestamptz,
  p_end_time   timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  update public.bookings
     set previous_start_time = start_time,
         start_time          = p_start_time,
         end_time            = p_end_time,
         status              = 'rescheduled',
         updated_at          = now()
   where id = p_booking_id
     and status in ('confirmed', 'rescheduled')
  returning * into v_booking;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'BOOKING_INVALID');
  end if;

  return jsonb_build_object('ok', true, 'booking', to_jsonb(v_booking));
exception
  when exclusion_violation then
    return jsonb_build_object('ok', false, 'code', 'SLOT_UNAVAILABLE');
end;
$$;

-- -----------------------------------------------------------------------------
-- Seed data — demo business "Fade District"
-- -----------------------------------------------------------------------------
insert into public.businesses (id, name, phone, email, timezone)
values (
  '00000000-0000-4000-8000-000000000001',
  'Fade District',
  '+230 5700 0000',
  'hello@fadedistrict.mu',
  'Indian/Mauritius'
)
on conflict (id) do nothing;

insert into public.services (id, business_id, name, duration_minutes, price, active)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Haircut',       45, 500, true),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Haircut + Beard', 60, 700, true),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'Beard Trim',    30, 300, true)
on conflict (id) do nothing;

insert into public.customers (id, business_id, name, phone, email)
values (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000001',
  'Jean-Marc',
  '+230 5712 0001',
  null
)
on conflict (id) do nothing;

-- Demo appointments (relative to "now" so availability always looks realistic).
-- The token "demo" lets anyone preview /manage/demo.
insert into public.bookings (
  id, business_id, service_id, customer_id,
  start_time, end_time, status, manage_token
)
values (
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000201',
  timezone('Indian/Mauritius',
    ((now() at time zone 'Indian/Mauritius') + interval '3 days')::date + time '10:00'),
  timezone('Indian/Mauritius',
    ((now() at time zone 'Indian/Mauritius') + interval '3 days')::date + time '10:45'),
  'confirmed',
  'demo'
)
on conflict (manage_token) do nothing;

insert into public.bookings (
  id, business_id, service_id, customer_id,
  start_time, end_time, status, manage_token
)
values (
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000201',
  timezone('Indian/Mauritius',
    ((now() at time zone 'Indian/Mauritius') + interval '3 days')::date + time '14:00'),
  timezone('Indian/Mauritius',
    ((now() at time zone 'Indian/Mauritius') + interval '3 days')::date + time '15:00'),
  'confirmed',
  'seed-kevin-1400'
)
on conflict (manage_token) do nothing;

insert into public.bookings (
  id, business_id, service_id, customer_id,
  start_time, end_time, status, manage_token
)
values (
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000201',
  timezone('Indian/Mauritius',
    ((now() at time zone 'Indian/Mauritius') + interval '4 days')::date + time '09:00'),
  timezone('Indian/Mauritius',
    ((now() at time zone 'Indian/Mauritius') + interval '4 days')::date + time '09:30'),
  'confirmed',
  'seed-ravi-0900'
)
on conflict (manage_token) do nothing;

-- Repair/re-apply the overlap guard for environments where the bookings table
-- predates this constraint. Idempotent: safe to run the whole file repeatedly.
alter table public.bookings drop constraint if exists bookings_no_overlap;

alter table public.bookings
  add constraint bookings_no_overlap exclude using gist (
    business_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (status in ('confirmed', 'rescheduled'));