-- 0016_operations_events.sql
-- Operations monitoring: booking funnel events and failure tracking.
--
-- This table stores lightweight, privacy-conscious events that help Kivo
-- understand booking funnel health, technical failures, and provider status.
-- No passwords, tokens, OAuth credentials, or unnecessary PII are stored.
--
-- Access model:
--   - All reads/writes go through the service-role client (bypasses RLS).
--   - RLS is enabled with a restrictive policy to block anon/authenticated
--     access as defense-in-depth. Even if a code bug routes through the
--     anon/authenticated client, operations data is never exposed.

-- Event categories for classification
DO $$ BEGIN
  CREATE TYPE operations_event_category AS ENUM (
    'funnel',       -- booking funnel progression events
    'failure',      -- booking/technical failures
    'notification', -- WhatsApp/notification events
    'calendar',     -- Google Calendar sync events
    'reminder',     -- reminder delivery events
    'system'        -- provider health, system status
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Failure severity levels
DO $$ BEGIN
  CREATE TYPE failure_severity AS ENUM (
    'expected',     -- booking conflicts, validation errors (normal)
    'technical'     -- database errors, provider failures (abnormal)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS operations_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name    TEXT NOT NULL,
  category      operations_event_category NOT NULL,
  business_id   TEXT,                  -- nullable for cross-business/system events
  booking_id    TEXT,                  -- nullable for funnel events without a booking yet
  attempt_id    TEXT NOT NULL,         -- correlation ID for funnel sequences
  severity      failure_severity,     -- only set for 'failure' category
  error_code    TEXT,                  -- safe, stable error code (never raw exceptions)
  provider      TEXT,                  -- 'baileys', 'openwa', 'google-calendar'
  metadata      JSONB DEFAULT '{}'::jsonb,  -- safe, non-sensitive additional data
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_operations_events_created ON operations_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operations_events_category ON operations_events (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operations_events_business ON operations_events (business_id, created_at DESC) WHERE business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_operations_events_attempt ON operations_events (attempt_id);
CREATE INDEX IF NOT EXISTS idx_operations_events_name ON operations_events (event_name, created_at DESC);

-- RLS: enable and block anon/authenticated access (service-role bypasses RLS)
ALTER TABLE operations_events ENABLE ROW LEVEL SECURITY;

-- No policies = no access for anon/authenticated roles.
-- All access goes through the service-role client which bypasses RLS.

COMMENT ON TABLE operations_events IS 'Lightweight operations monitoring for booking funnel, failures, and provider health. Privacy-conscious: no tokens, credentials, or unnecessary PII. Access via service-role only (RLS blocks anon/authenticated).';
COMMENT ON COLUMN operations_events.attempt_id IS 'Correlation ID for funnel sequences. Grants no access. Never a manage token or auth token.';
COMMENT ON COLUMN operations_events.error_code IS 'Safe, stable error code (e.g. SLOT_UNAVAILABLE, BAILEYS_SEND_FAILED). Never raw exception messages.';
COMMENT ON COLUMN operations_events.metadata IS 'Safe, non-sensitive additional data. Never contains passwords, tokens, or credentials.';
