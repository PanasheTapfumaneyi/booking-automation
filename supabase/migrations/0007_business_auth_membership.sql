-- =============================================================================
-- Phase 6A — business auth, membership, public slug, hours, RLS
--
-- * business_members: links Supabase Auth users to businesses (pilot: owner).
-- * businesses.slug: unique public slug for per-business booking URLs.
-- * businesses.availability: optional per-business weekly hours (JSONB).
--   Null/absent days fall back to the platform defaults in the slot engine.
-- * RLS: authenticated members can SELECT only rows of their own businesses
--   (via business_members + auth.uid()). No insert/update/delete policies are
--   granted to anon/authenticated — all writes stay server-side (service role
--   bypasses RLS and is unaffected). Public customer flows keep using the
--   existing server-side service access and are unchanged.
--
-- Additive only; existing data untouched (demo business gets slug
-- 'fade-district').
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Membership table
-- -----------------------------------------------------------------------------
create table if not exists public.business_members (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'owner' check (role in ('owner', 'admin', 'staff')),
  created_at  timestamptz not null default now(),
  constraint business_members_business_user_uq unique (business_id, user_id)
);

create index if not exists business_members_user_idx on public.business_members (user_id);
create index if not exists business_members_business_idx on public.business_members (business_id);

alter table public.business_members enable row level security;

-- -----------------------------------------------------------------------------
-- 2. Public slug + availability hours on businesses
-- -----------------------------------------------------------------------------
alter table public.businesses
  add column if not exists slug text;

-- Backfill the seeded demo business before enforcing uniqueness/not-null.
update public.businesses
   set slug = 'fade-district'
 where id = '00000000-0000-4000-8000-000000000001'
   and slug is null;

alter table public.businesses
  add column if not exists availability jsonb;

-- Slugs are lowercase alphanumerics separated by single hyphens.
alter table public.businesses drop constraint if exists businesses_slug_format;
alter table public.businesses add constraint businesses_slug_format check (
  slug is null or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
);

create unique index if not exists businesses_slug_uq on public.businesses (slug);

-- -----------------------------------------------------------------------------
-- 3. RLS policies for authenticated business members
--
-- Pattern: <table>.business_id IN (member businesses of auth.uid()).
-- business_members itself: members may read their own rows only.
-- No anon policies anywhere (public flows use server-side service access).
-- -----------------------------------------------------------------------------

-- business_members: read own memberships only.
drop policy if exists business_members_select_own on public.business_members;
create policy business_members_select_own
  on public.business_members for select
  to authenticated
  using (user_id = auth.uid());

-- businesses: read businesses you belong to.
drop policy if exists businesses_select_member on public.businesses;
create policy businesses_select_member
  on public.businesses for select
  to authenticated
  using (
    id in (
      select business_id from public.business_members where user_id = auth.uid()
    )
  );

-- services: read services of your businesses.
drop policy if exists services_select_member on public.services;
create policy services_select_member
  on public.services for select
  to authenticated
  using (
    business_id in (
      select business_id from public.business_members where user_id = auth.uid()
    )
  );

-- resources: read resources of your businesses.
drop policy if exists resources_select_member on public.resources;
create policy resources_select_member
  on public.resources for select
  to authenticated
  using (
    business_id in (
      select business_id from public.business_members where user_id = auth.uid()
    )
  );

-- booking_sessions: read sessions of your businesses.
drop policy if exists booking_sessions_select_member on public.booking_sessions;
create policy booking_sessions_select_member
  on public.booking_sessions for select
  to authenticated
  using (
    business_id in (
      select business_id from public.business_members where user_id = auth.uid()
    )
  );

-- bookings: read bookings of your businesses (owner view of their own data).
drop policy if exists bookings_select_member on public.bookings;
create policy bookings_select_member
  on public.bookings for select
  to authenticated
  using (
    business_id in (
      select business_id from public.business_members where user_id = auth.uid()
    )
  );

-- customers: read customers of your businesses.
drop policy if exists customers_select_member on public.customers;
create policy customers_select_member
  on public.customers for select
  to authenticated
  using (
    business_id in (
      select business_id from public.business_members where user_id = auth.uid()
    )
  );

-- calendar_connections: read (never tokens — enforced by selecting explicit
-- columns in app code; the policy only gates row visibility).
drop policy if exists calendar_connections_select_member on public.calendar_connections;
create policy calendar_connections_select_member
  on public.calendar_connections for select
  to authenticated
  using (
    business_id in (
      select business_id from public.business_members where user_id = auth.uid()
    )
  );

-- business_notification_settings: read settings of your businesses.
drop policy if exists business_notification_settings_select_member on public.business_notification_settings;
create policy business_notification_settings_select_member
  on public.business_notification_settings for select
  to authenticated
  using (
    business_id in (
      select business_id from public.business_members where user_id = auth.uid()
    )
  );

-- notifications: read notification rows of your businesses.
drop policy if exists notifications_select_member on public.notifications;
create policy notifications_select_member
  on public.notifications for select
  to authenticated
  using (
    business_id in (
      select business_id from public.business_members where user_id = auth.uid()
    )
  );
