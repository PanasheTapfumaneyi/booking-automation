-- =============================================================================
-- Migration 0023: per-resource photo galleries
--
-- Services show a single image_url; rental listings need a cover plus extra
-- photos. `images` holds additional photo URLs (jsonb string array);
-- `image_url` remains the cover so every existing reader keeps working.
-- Display rule: [image_url?, ...images], deduplicated.
--
-- Nullable-tolerant: NOT NULL DEFAULT '[]' so old rows read as "no extras".
-- =============================================================================

alter table public.resources
  add column if not exists images jsonb not null default '[]';

comment on column public.resources.images is
  'Extra listing photos as a JSON string array. image_url stays the cover.';
