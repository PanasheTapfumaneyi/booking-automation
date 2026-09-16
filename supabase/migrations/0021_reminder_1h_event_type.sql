-- =============================================================================
-- Migration 0021 — register booking.reminder.1h in the notifications constraint
--
-- Migration 0006 added booking.reminder.24h and booking.reminder.2h to the
-- event_type check. The implemented reminder system uses booking.reminder.1h
-- (exactly one reminder, 1 hour before start). This migration adds that value
-- so reminder records can be persisted.
--
-- Additive only: no rows, columns, or existing constraints are dropped.
-- =============================================================================

alter table public.notifications drop constraint if exists notifications_event_type_check;

alter table public.notifications add constraint notifications_event_type_check check (
  event_type in (
    'booking.created',
    'booking.rescheduled',
    'booking.cancelled',
    'booking.reminder.24h',
    'booking.reminder.2h',
    'booking.reminder.1h'
  )
);
