-- =============================================================================
-- Phase 5 — timed reminder events (additive only)
--
-- Extends the notifications.event_type check with the scheduler-driven
-- reminder events. Reminder deliveries reuse the notifications table:
-- one row per (reminder event, customer, whatsapp), claimed atomically.
-- Nothing is dropped, altered or renamed; existing rows are untouched.
-- =============================================================================

alter table public.notifications drop constraint if exists notifications_event_type_check;

alter table public.notifications add constraint notifications_event_type_check check (
  event_type in (
    'booking.created',
    'booking.rescheduled',
    'booking.cancelled',
    'booking.reminder.24h',
    'booking.reminder.2h'
  )
);

-- Scheduler scan: upcoming live bookings by start time.
create index if not exists notifications_booking_event_idx
  on public.notifications (booking_id, event_type);
