-- Add append-only event log and counters for WhatsApp OTP flows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'app'::regnamespace AND typname = 'whatsapp_otp_event_type'
  ) THEN
    CREATE TYPE app.whatsapp_otp_event_type AS ENUM (
      'send_success',
      'send_throttled',
      'send_failed',
      'verify_success',
      'verify_invalid',
      'verify_throttled',
      'verify_expired',
      'verify_max_attempts'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app.whatsapp_otp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  event_type app.whatsapp_otp_event_type NOT NULL,
  attempts_remaining INTEGER,
  ip_address TEXT,
  device_fingerprint TEXT,
  device_id TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now())
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_events_phone_created
  ON app.whatsapp_otp_events (phone_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_events_event_created
  ON app.whatsapp_otp_events (event_type, created_at DESC);

ALTER TABLE app.whatsapp_otp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role manages whatsapp otp events"
  ON app.whatsapp_otp_events
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE TABLE IF NOT EXISTS app.whatsapp_otp_stats (
  phone_number TEXT PRIMARY KEY,
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  last_event_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_ip TEXT,
  last_device_fingerprint TEXT,
  last_device_id TEXT
);

ALTER TABLE app.whatsapp_otp_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role manages whatsapp otp stats"
  ON app.whatsapp_otp_stats
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE OR REPLACE FUNCTION app.record_whatsapp_otp_event(
  phone_number TEXT,
  event_type app.whatsapp_otp_event_type,
  attempts_remaining INTEGER DEFAULT NULL,
  ip_address TEXT DEFAULT NULL,
  device_fingerprint TEXT DEFAULT NULL,
  device_id TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  metadata JSONB DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'app', 'public'
AS $$
DECLARE
  now_ts TIMESTAMPTZ := timezone('UTC', now());
  failure_inc INTEGER := CASE
    WHEN event_type IN ('send_throttled', 'send_failed', 'verify_invalid', 'verify_throttled', 'verify_expired', 'verify_max_attempts') THEN 1
    ELSE 0
  END;
  success_inc INTEGER := CASE
    WHEN event_type = 'verify_success' THEN 1
    ELSE 0
  END;
BEGIN
  INSERT INTO app.whatsapp_otp_events (
    phone_number,
    event_type,
    attempts_remaining,
    ip_address,
    device_fingerprint,
    device_id,
    user_agent,
    metadata,
    created_at
  )
  VALUES (
    phone_number,
    event_type,
    attempts_remaining,
    ip_address,
    device_fingerprint,
    device_id,
    user_agent,
    metadata,
    now_ts
  );

  INSERT INTO app.whatsapp_otp_stats (
    phone_number,
    failure_count,
    success_count,
    last_event_at,
    last_failure_at,
    last_success_at,
    last_ip,
    last_device_fingerprint,
    last_device_id
  )
  VALUES (
    phone_number,
    failure_inc,
    success_inc,
    now_ts,
    CASE WHEN failure_inc > 0 THEN now_ts ELSE NULL END,
    CASE WHEN success_inc > 0 THEN now_ts ELSE NULL END,
    ip_address,
    device_fingerprint,
    device_id
  )
  ON CONFLICT (phone_number) DO UPDATE
  SET
    failure_count = CASE
      WHEN EXCLUDED.success_count > 0 THEN 0
      ELSE app.whatsapp_otp_stats.failure_count + EXCLUDED.failure_count
    END,
    success_count = app.whatsapp_otp_stats.success_count + EXCLUDED.success_count,
    last_event_at = now_ts,
    last_failure_at = CASE
      WHEN EXCLUDED.failure_count > 0 THEN now_ts
      ELSE app.whatsapp_otp_stats.last_failure_at
    END,
    last_success_at = CASE
      WHEN EXCLUDED.success_count > 0 THEN now_ts
      ELSE app.whatsapp_otp_stats.last_success_at
    END,
    last_ip = COALESCE(EXCLUDED.last_ip, app.whatsapp_otp_stats.last_ip),
    last_device_fingerprint = COALESCE(EXCLUDED.last_device_fingerprint, app.whatsapp_otp_stats.last_device_fingerprint),
    last_device_id = COALESCE(EXCLUDED.last_device_id, app.whatsapp_otp_stats.last_device_id);
END;
$$;

GRANT EXECUTE ON FUNCTION app.record_whatsapp_otp_event(
  TEXT,
  app.whatsapp_otp_event_type,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) TO service_role;

COMMENT ON TABLE app.whatsapp_otp_events IS 'Append-only log of WhatsApp OTP send/verify events for fraud analytics.';
COMMENT ON TABLE app.whatsapp_otp_stats IS 'Aggregated counters tracking WhatsApp OTP verification outcomes per phone number.';
