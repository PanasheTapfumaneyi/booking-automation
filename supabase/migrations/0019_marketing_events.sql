-- =============================================================================
-- Migration 0019: first-party marketing analytics events
--
-- Kivo's marketing/product analytics ("Is the marketing working?") lives
-- here, SEPARATE from operations_events ("Is Kivo working?").
--
-- Why a separate table instead of reusing operations_events:
--   - operations dashboards aggregate by category/event_name; mixing
--     marketing interactions into that stream would pollute reliability
--     monitoring and force every ops query to exclude marketing names.
--   - Marketing needs its own columns (session, source, device, UTM)
--     that make no sense on booking-funnel rows.
--   - Same access model, same privacy posture: RLS enabled with no
--     policies (service-role only), no IPs, no user identifiers, no
--     tokens, no form contents. Acquisition attribution comes from
--     first-touch UTM/referrer props, never fingerprinting.
--
-- Session model: `session_id` is a random anonymous id generated
-- client-side per browser session (localStorage, rotated after 30 min
-- inactivity). It cannot identify a person and never leaves Kivo.
-- =============================================================================

create table if not exists public.marketing_events (
  id            uuid primary key default gen_random_uuid(),
  event_name    text not null,
  session_id    text not null,
  pathname      text,
  referrer      text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,
  source        text,
  device        text,
  browser       text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists marketing_events_created_idx
  on public.marketing_events (created_at desc);

create index if not exists marketing_events_name_created_idx
  on public.marketing_events (event_name, created_at desc);

create index if not exists marketing_events_session_idx
  on public.marketing_events (session_id, created_at desc);

create index if not exists marketing_events_source_idx
  on public.marketing_events (source, created_at desc)
  where source is not null;

alter table public.marketing_events enable row level security;

-- No policies: the Next.js API layer uses the service-role client.
-- Global marketing reads are additionally gated by platform-admin
-- authorization (/admin/analytics).

comment on table public.marketing_events is
  'First-party marketing analytics. Anonymous sessions only: no IPs, no user ids, no tokens, no PII.';
comment on column public.marketing_events.session_id is
  'Random anonymous browser-session id. Cannot identify a person.';
comment on column public.marketing_events.source is
  'Derived acquisition source (direct, instagram, facebook, whatsapp, google, search, other). Never guessed when unattributable.';
