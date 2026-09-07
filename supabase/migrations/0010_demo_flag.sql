-- =============================================================================
-- Migration 0010: explicit demo-business flag
--
-- Replaces brittle UUID-prefix demo detection with an explicit server-side
-- boolean. Production businesses default to false. Only the three known
-- demo slugs are marked true.
--
-- Additive + safe. Run order: after 0009. Idempotent (IF NOT EXISTS).
-- =============================================================================

alter table public.businesses
  add column if not exists is_demo boolean not null default false;

-- Mark the known demo businesses (whatever ids they ended up with).
update public.businesses
   set is_demo = true
 where slug in ('fade-area', 'island-surf', 'blue-lagoon')
   and is_demo is not true;
