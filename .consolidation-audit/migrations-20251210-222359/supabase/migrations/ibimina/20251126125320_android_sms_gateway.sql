-- Android SMS Bridge Gateway Integration
-- This migration creates tables for managing Android SMS bridge devices,
-- tracking gateway health via heartbeats, and storing raw SMS logs with parsing metadata.

-- Table: gateway_devices (tracks Android bridge phones)
CREATE TABLE IF NOT EXISTS app.gateway_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  device_name TEXT,
  sacco_id UUID REFERENCES app.saccos(id) ON DELETE CASCADE,
  sim_carrier TEXT, -- e.g., "MTN", "Airtel"
  last_heartbeat_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now())
);

-- Index for active device queries
CREATE INDEX IF NOT EXISTS idx_gateway_devices_last_heartbeat 
  ON app.gateway_devices(last_heartbeat_at) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_gateway_devices_sacco 
  ON app.gateway_devices(sacco_id);

-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS gateway_devices_touch_updated_at ON app.gateway_devices;
CREATE TRIGGER gateway_devices_touch_updated_at
  BEFORE UPDATE ON app.gateway_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Table: gateway_heartbeats (health monitoring)
CREATE TABLE IF NOT EXISTS app.gateway_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL REFERENCES app.gateway_devices(device_id) ON DELETE CASCADE,
  battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100), -- 0-100
  network_type TEXT, -- "WIFI", "4G", "3G"
  signal_strength INTEGER,
  pending_sms_count INTEGER DEFAULT 0,
  ip_address INET,
  app_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now())
);

-- Index for performance on device heartbeat queries
CREATE INDEX IF NOT EXISTS idx_gateway_heartbeats_device_created 
  ON app.gateway_heartbeats(device_id, created_at DESC);

-- Table: raw_sms_logs (audit trail of all received SMS)
CREATE TABLE IF NOT EXISTS app.raw_sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  raw_message TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  parse_source TEXT, -- "REGEX", "GEMINI", "OPENAI", "MANUAL"
  parse_confidence NUMERIC(3,2) CHECK (parse_confidence >= 0 AND parse_confidence <= 1),
  parsed_json JSONB,
  payment_id UUID REFERENCES app.payments(id),
  status TEXT DEFAULT 'PENDING', -- PENDING, PARSED, FAILED, DUPLICATE
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_raw_sms_logs_status 
  ON app.raw_sms_logs(status) WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_raw_sms_logs_device 
  ON app.raw_sms_logs(device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_raw_sms_logs_payment 
  ON app.raw_sms_logs(payment_id);

CREATE INDEX IF NOT EXISTS idx_raw_sms_logs_received_at 
  ON app.raw_sms_logs(received_at DESC);

-- RLS Policies
ALTER TABLE app.gateway_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.gateway_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.raw_sms_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Staff can view gateway devices" ON app.gateway_devices;
DROP POLICY IF EXISTS "Staff can view heartbeats" ON app.gateway_heartbeats;
DROP POLICY IF EXISTS "Staff can view SMS logs" ON app.raw_sms_logs;

-- Staff can view all gateway data for their SACCO
CREATE POLICY "Staff can view gateway devices" ON app.gateway_devices
  FOR SELECT USING (
    sacco_id IN (
      SELECT sacco_id FROM app.user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view heartbeats" ON app.gateway_heartbeats
  FOR SELECT USING (
    device_id IN (
      SELECT device_id FROM app.gateway_devices 
      WHERE sacco_id IN (
        SELECT sacco_id FROM app.user_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Staff can view SMS logs" ON app.raw_sms_logs
  FOR SELECT USING (
    device_id IN (
      SELECT device_id FROM app.gateway_devices 
      WHERE sacco_id IN (
        SELECT sacco_id FROM app.user_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Database triggers for real-time notifications
-- Notify when new SMS log is inserted
CREATE OR REPLACE FUNCTION app.notify_new_sms_log()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('new_sms_log', json_build_object(
    'id', NEW.id,
    'device_id', NEW.device_id,
    'status', NEW.status,
    'received_at', NEW.received_at
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_new_sms_log ON app.raw_sms_logs;
CREATE TRIGGER trigger_notify_new_sms_log
  AFTER INSERT ON app.raw_sms_logs
  FOR EACH ROW
  EXECUTE FUNCTION app.notify_new_sms_log();

-- Notify when SMS-sourced payment is created
CREATE OR REPLACE FUNCTION app.notify_sms_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.channel = 'SMS' THEN
    PERFORM pg_notify('new_sms_payment', json_build_object(
      'id', NEW.id,
      'sacco_id', NEW.sacco_id,
      'amount', NEW.amount,
      'status', NEW.status,
      'occurred_at', NEW.occurred_at
    )::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_sms_payment ON app.payments;
CREATE TRIGGER trigger_notify_sms_payment
  AFTER INSERT ON app.payments
  FOR EACH ROW
  EXECUTE FUNCTION app.notify_sms_payment();

-- Comment documentation
COMMENT ON TABLE app.gateway_devices IS 'Tracks Android bridge devices that forward SMS to the platform';
COMMENT ON TABLE app.gateway_heartbeats IS 'Health monitoring data from Android bridge devices';
COMMENT ON TABLE app.raw_sms_logs IS 'Audit trail of all SMS received from Android bridge devices';
COMMENT ON COLUMN app.gateway_devices.device_id IS 'Unique identifier from Android device';
COMMENT ON COLUMN app.gateway_devices.sim_carrier IS 'Mobile carrier of the SIM card (MTN, Airtel, etc.)';
COMMENT ON COLUMN app.raw_sms_logs.parse_source IS 'AI/parsing method used: REGEX, GEMINI, OPENAI, or MANUAL';
COMMENT ON COLUMN app.raw_sms_logs.status IS 'Processing status: PENDING, PARSED, FAILED, or DUPLICATE';
