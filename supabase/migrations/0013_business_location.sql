-- Phase 7.6: business location fields for map and address display.

alter table public.businesses
  add column if not exists address text,
  add column if not exists latitude numeric,
  add column if not exists longitude numeric;
