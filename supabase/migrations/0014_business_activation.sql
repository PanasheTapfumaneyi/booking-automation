-- Phase 8 (first real tenant): business activation flag.
--
-- Real businesses are provisioned inactive and only flipped active once
-- configuration is complete (owner, services, hours verified). Public
-- surfaces (/business/[slug], /book/[slug], public catalog API) hide
-- inactive businesses; owner dashboard/settings keep working via membership
-- so configuration can happen pre-launch.
--
-- Additive only; existing rows (demo + seed) default to active, preserving
-- current behaviour.

alter table public.businesses
  add column if not exists is_active boolean not null default true;
