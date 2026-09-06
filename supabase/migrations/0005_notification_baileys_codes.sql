-- =============================================================================
-- Phase 4 follow-up — Baileys transport error codes (additive only)
--
-- Extends the notifications.error_code check with the BAILEYS_* family so
-- Baileys delivery failures persist exactly like OpenWA ones. Nothing is
-- dropped, altered or renamed; existing rows are untouched.
-- =============================================================================

alter table public.notifications drop constraint if exists notifications_error_code_check;

alter table public.notifications add constraint notifications_error_code_check check (
  error_code in (
    'OPENWA_UNAVAILABLE',
    'OPENWA_AUTH_FAILED',
    'OPENWA_SESSION_NOT_READY',
    'OPENWA_SEND_FAILED',
    'BAILEYS_UNAVAILABLE',
    'BAILEYS_AUTH_FAILED',
    'BAILEYS_SESSION_NOT_READY',
    'BAILEYS_SEND_FAILED',
    'INVALID_PHONE'
  )
);
