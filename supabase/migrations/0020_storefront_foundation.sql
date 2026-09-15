-- =============================================================================
-- Migration 0020: Storefront 2.0 data foundation
--
-- Presentation layer beside (never inside) the booking engine:
--   - business_storefronts : 1:1 optional customization per business
--   - storefront_gallery   : gallery images
--   - storefront_team      : public team profiles (independent from logins)
--   - storefront_reviews   : legitimate/import-oriented reviews (no fake data)
--   - businesses.category  : nullable controlled string (presentation hint)
--
-- Backwards-compatibility rules (all enforced below):
--   - strictly additive: new tables + one nullable column, no ALTERs to
--     existing columns, no backfill rows, no data updates.
--   - every new column is nullable or has a safe default; a business with
--     no storefront rows renders exactly today's page.
--   - RLS enabled, no policies: service-role access only, matching the
--     house convention (0002/0016/0018/0019). All reads/writes go through
--     the Next.js API layer with membership/platform-admin checks.
--
-- Storage (storefront-media bucket):
--   - public bucket for reads; NO storage write policies. All uploads and
--     deletes go through the Next.js API layer with the service-role
--     client after an explicit owner-membership check, so one tenant can
--     never touch another tenant's media.
--   - existing hotlinked image URLs are untouched and keep rendering.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Storefront configuration (1:1, optional)
-- ---------------------------------------------------------------------------

create table if not exists public.business_storefronts (
  business_id     uuid primary key references public.businesses (id) on delete cascade,
  template        text not null default 'appointment_modern',
  headline        text,
  subheadline     text,
  hero_image_url  text,
  show_gallery    boolean not null default true,
  show_team       boolean not null default true,
  show_reviews    boolean not null default true,
  show_about      boolean not null default true,
  show_hours      boolean not null default true,
  show_location   boolean not null default true,
  show_social     boolean not null default true,
  social_links    jsonb not null default '{}'::jsonb,
  amenities       text[] not null default '{}',
  section_order   text[],
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.business_storefronts enable row level security;

comment on table public.business_storefronts is
  'Optional Storefront 2.0 customization. No row = defaults derived from businesses/services.';
comment on column public.business_storefronts.social_links is
  'Constrained JSON object: {instagram, facebook, tiktok, website, whatsapp} URL strings.';
comment on column public.business_storefronts.amenities is
  'Controlled display chips (Parking, Wi-Fi, ...). Display-only.';
comment on column public.business_storefronts.section_order is
  'Optional explicit section ordering. Null = template default order.';

-- ---------------------------------------------------------------------------
-- 2. Gallery
-- ---------------------------------------------------------------------------

create table if not exists public.storefront_gallery (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  image_url     text not null,
  caption       text,
  alt_text      text,
  sort_order    integer not null default 0,
  is_featured   boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists storefront_gallery_business_idx
  on public.storefront_gallery (business_id, sort_order);

alter table public.storefront_gallery enable row level security;

comment on table public.storefront_gallery is
  'Storefront gallery images. Empty = Gallery section hides.';

-- ---------------------------------------------------------------------------
-- 3. Public team profiles (independent from authenticated members)
-- ---------------------------------------------------------------------------

create table if not exists public.storefront_team (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  member_user_id  uuid,
  name            text not null,
  role            text,
  bio             text,
  photo_url       text,
  visible         boolean not null default true,
  bookable        boolean not null default false,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists storefront_team_business_idx
  on public.storefront_team (business_id, sort_order);

alter table public.storefront_team enable row level security;

comment on table public.storefront_team is
  'Public team profiles. A profile never implies a login; member_user_id is an optional future link (unenforced).';
comment on column public.storefront_team.bookable is
  'Reserved for a future service-to-staff booking model. No booking semantics in V1.';

-- ---------------------------------------------------------------------------
-- 4. Reviews (legitimate / import-oriented only)
-- ---------------------------------------------------------------------------

create table if not exists public.storefront_reviews (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  source          text not null default 'manual',
  external_id     text,
  reviewer_name   text,
  rating          integer check (rating is null or (rating >= 1 and rating <= 5)),
  body            text,
  review_date     date,
  visible         boolean not null default true,
  created_at      timestamptz not null default now(),
  constraint storefront_reviews_external_uq unique (business_id, source, external_id)
);

create index if not exists storefront_reviews_business_idx
  on public.storefront_reviews (business_id, visible, review_date desc nulls last);

alter table public.storefront_reviews enable row level security;

comment on table public.storefront_reviews is
  'Legitimate reviews only (future Google/external imports deduped by source+external_id). Empty = Reviews section hides. No fake-review seeding.';

-- ---------------------------------------------------------------------------
-- 5. Business category (nullable presentation hint)
-- ---------------------------------------------------------------------------

alter table public.businesses
  add column if not exists category text;

comment on column public.businesses.category is
  'Controlled presentation string (e.g. barber, beauty_salon). Null = uncategorized. Validated in app code, not a PG enum.';

-- ---------------------------------------------------------------------------
-- 6. Storage bucket for storefront media
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('storefront-media', 'storefront-media', true)
on conflict (id) do nothing;

-- Reads are public via the bucket flag. Writes/deletes happen exclusively
-- through the Next.js API layer (service-role after owner-membership
-- check), so no storage write policies are created here. Assets live at
-- {business_id}/{logo|cover|gallery|team}/{uuid}.{ext} — paths are built
-- server-side, never trusted from client input.
