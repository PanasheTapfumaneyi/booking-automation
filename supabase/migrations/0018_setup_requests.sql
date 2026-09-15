-- =============================================================================
-- Migration 0018: onboarding setup requests (managed vs self-config leads)
--
-- Kivo is a managed service with an optional self-configuration path.
-- After signup + business basics, the owner chooses "Set it up for me"
-- (managed) or "I'll configure it now" (self). This table records that
-- choice and the setup lifecycle so no lead disappears.
--
-- Design notes:
--   - One row per business (business_id PRIMARY KEY). Upserts make the
--     choice step naturally idempotent: refresh/retry never duplicates.
--   - NO backfill rows. Businesses without a row are existing/production
--     tenants and are treated as `live` by absence. This migration must
--     not reclassify any existing business.
--   - Contact data reuses the businesses row where possible; contact_phone
--     here is the number Kivo should use for setup follow-up (usually the
--     same as businesses.phone, stored explicitly so later business edits
--     don't rewrite the lead record).
--   - RLS enabled with no policies: service-role only, like
--     operations_events. Global lead visibility is additionally gated in
--     the API layer by platform-admin authorization.
-- =============================================================================

create table if not exists public.setup_requests (
  business_id     uuid primary key references public.businesses (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  business_type   text,
  contact_phone   text,
  preference      text,
  status          text not null default 'new',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint setup_requests_preference_check
    check (preference is null or preference in ('managed', 'self')),
  constraint setup_requests_status_check
    check (status in (
      'new',
      'pending_setup',
      'contacted',
      'setting_up',
      'self_configuring',
      'ready_for_review',
      'live'
    ))
);

create index if not exists setup_requests_user_idx
  on public.setup_requests (user_id);

create index if not exists setup_requests_status_idx
  on public.setup_requests (status, created_at desc);

alter table public.setup_requests enable row level security;

-- No policies: the Next.js API layer uses the service-role client and
-- enforces ownership (owner) or platform-admin (global list) itself.

comment on table public.setup_requests is
  'Onboarding lead + setup lifecycle. No row = existing/live business (by absence).';
comment on column public.setup_requests.preference is
  'Owner setup choice: managed (Kivo sets up) or self (owner configures).';
comment on column public.setup_requests.status is
  'new → pending_setup|self_configuring → contacted|setting_up|ready_for_review → live.';
