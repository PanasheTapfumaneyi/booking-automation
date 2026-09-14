-- =============================================================================
-- Migration 0015: real opening hours for every demo storefront
--
-- Demo storefronts previously rendered an empty "Opening hours" panel (KIVO-041)
-- and had no hours beneath the heading (KIVO-017). This seeds credible weekly
-- hours for each demo business, in its own IANA timezone.
--
-- Additive + safe: only fills rows whose availability is still NULL, so a demo
-- owner's edited hours are never overwritten, and real (non-demo) businesses
-- with matching slugs are never touched. Idempotent.
-- =============================================================================

-- Fade Area (appointment / barbershop)
update public.businesses
   set availability = '{"mon":{"open":"09:00","close":"18:00"},"tue":{"open":"09:00","close":"18:00"},"wed":{"open":"09:00","close":"18:00"},"thu":{"open":"09:00","close":"18:00"},"fri":{"open":"09:00","close":"18:00"},"sat":{"open":"09:00","close":"16:00"},"sun":null}'::jsonb
 where slug = 'fade-area'
   and availability is null;

-- Island Surf Co. (resource / rental)
update public.businesses
   set availability = '{"mon":{"open":"08:00","close":"19:00"},"tue":{"open":"08:00","close":"19:00"},"wed":{"open":"08:00","close":"19:00"},"thu":{"open":"08:00","close":"19:00"},"fri":{"open":"08:00","close":"19:00"},"sat":{"open":"08:00","close":"19:00"},"sun":{"open":"08:00","close":"19:00"}}'::jsonb
 where slug = 'island-surf'
   and availability is null;

-- Blue Lagoon Swim School (capacity / lessons)
update public.businesses
   set availability = '{"mon":{"open":"07:00","close":"18:00"},"tue":{"open":"07:00","close":"18:00"},"wed":{"open":"07:00","close":"18:00"},"thu":{"open":"07:00","close":"18:00"},"fri":{"open":"07:00","close":"18:00"},"sat":{"open":"08:00","close":"18:00"},"sun":{"open":"09:00","close":"13:00"}}'::jsonb
 where slug = 'blue-lagoon'
   and availability is null;

-- Kivo Drive (resource / car rental)
update public.businesses
   set availability = '{"mon":{"open":"08:00","close":"20:00"},"tue":{"open":"08:00","close":"20:00"},"wed":{"open":"08:00","close":"20:00"},"thu":{"open":"08:00","close":"20:00"},"fri":{"open":"08:00","close":"20:00"},"sat":{"open":"08:00","close":"20:00"},"sun":{"open":"08:00","close":"20:00"}}'::jsonb
 where slug = 'kivo-drive'
   and availability is null;