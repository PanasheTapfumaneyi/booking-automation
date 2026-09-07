-- =============================================================================
-- Phase 6B — dashboard query indexes (additive only)
--
-- Supports the business booking list (business + status + start_time),
-- customer search within a business, and per-booking notification lookups.
-- Existing indexes already cover bookings(business_id) and
-- notifications(booking_id, event_type); these add ordering/filter support.
-- =============================================================================

create index if not exists bookings_business_status_start_idx
  on public.bookings (business_id, status, start_time desc);

create index if not exists customers_business_name_idx
  on public.customers (business_id, name);
