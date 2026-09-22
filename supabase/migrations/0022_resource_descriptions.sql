-- =============================================================================
-- Migration 0022: resource descriptions for public display
--
-- Services already carry `description` (migration 0012); resources never
-- got one. This adds an optional description so rental items / equipment
-- can show the same explanatory copy as services on booking pages.
--
-- Nullable + no backfill: existing rows read as NULL (no description
-- shown) until an owner writes one. No behavior change for rows that
-- stay NULL.
-- =============================================================================

alter table public.resources
  add column if not exists description text;

comment on column public.resources.description is
  'Optional customer-facing description shown on booking pages. Null = no description shown.';
