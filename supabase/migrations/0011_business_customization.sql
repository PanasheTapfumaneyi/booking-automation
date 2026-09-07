-- Business page customization: tagline, description, cover image, logo.
-- All nullable — existing pages are unaffected.

alter table public.businesses
  add column if not exists tagline text,
  add column if not exists description text,
  add column if not exists cover_image_url text,
  add column if not exists logo_url text;
