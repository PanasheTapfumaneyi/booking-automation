-- Phase 7.6: service/resource images, service descriptions, business theme config.

-- Services: add optional image and description for public page display.
alter table public.services
  add column if not exists image_url text,
  add column if not exists description text;

-- Resources: add optional image for public page display.
alter table public.resources
  add column if not exists image_url text;

-- Businesses: add theme configuration (JSONB) for public page color theming.
-- Structure: { "primary": "#hex", "accent": "#hex", "background": "#hex",
--              "surface": "#hex", "foreground": "#hex", "muted": "#hex" }
-- Null = use default Kivo teal theme.
alter table public.businesses
  add column if not exists theme_config jsonb;
