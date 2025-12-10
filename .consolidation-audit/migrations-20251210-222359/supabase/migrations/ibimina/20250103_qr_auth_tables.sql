-- Database migration for QR authentication tables

-- Create auth_qr_sessions table
CREATE TABLE IF NOT EXISTS auth_qr_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  challenge TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'authenticated', 'expired', 'cancelled')),
  staff_id UUID REFERENCES auth.users(id),
  device_id TEXT,
  web_access_token TEXT,
  web_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  biometric_verified BOOLEAN DEFAULT FALSE,
  browser_fingerprint TEXT,
  ip_address TEXT,
  signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  authenticated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Create indexes for faster lookups
CREATE INDEX idx_auth_qr_sessions_session_id ON auth_qr_sessions(session_id);
CREATE INDEX idx_auth_qr_sessions_status ON auth_qr_sessions(status);
CREATE INDEX idx_auth_qr_sessions_staff_id ON auth_qr_sessions(staff_id);
CREATE INDEX idx_auth_qr_sessions_expires_at ON auth_qr_sessions(expires_at);

-- Create staff_devices table for registered devices
CREATE TABLE IF NOT EXISTS staff_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  staff_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT,
  device_model TEXT,
  os_version TEXT,
  app_version TEXT,
  push_token TEXT,
  biometric_enabled BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for devices
CREATE INDEX idx_staff_devices_device_id ON staff_devices(device_id);
CREATE INDEX idx_staff_devices_staff_id ON staff_devices(staff_id);
CREATE INDEX idx_staff_devices_status ON staff_devices(status);

-- Create auth_logs table for audit trail
CREATE TABLE IF NOT EXISTS auth_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  device_id TEXT,
  session_id TEXT,
  biometric_used BOOLEAN DEFAULT FALSE,
  ip_address TEXT,
  browser_fingerprint TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for auth logs
CREATE INDEX idx_auth_logs_staff_id ON auth_logs(staff_id);
CREATE INDEX idx_auth_logs_event_type ON auth_logs(event_type);
CREATE INDEX idx_auth_logs_created_at ON auth_logs(created_at DESC);

-- Enable RLS on all tables
ALTER TABLE auth_qr_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for auth_qr_sessions
-- Anyone can create a session (for web login)
CREATE POLICY "Anyone can create QR session"
  ON auth_qr_sessions
  FOR INSERT
  WITH CHECK (TRUE);

-- Only allow reading own sessions
CREATE POLICY "Users can read own sessions"
  ON auth_qr_sessions
  FOR SELECT
  USING (
    staff_id = auth.uid() OR
    staff_id IS NULL -- Allow reading pending sessions
  );

-- Only allow updating own sessions
CREATE POLICY "Users can update own sessions"
  ON auth_qr_sessions
  FOR UPDATE
  USING (staff_id = auth.uid() OR staff_id IS NULL);

-- RLS Policies for staff_devices
CREATE POLICY "Staff can view own devices"
  ON staff_devices
  FOR SELECT
  USING (staff_id = auth.uid());

CREATE POLICY "Staff can register devices"
  ON staff_devices
  FOR INSERT
  WITH CHECK (staff_id = auth.uid());

CREATE POLICY "Staff can update own devices"
  ON staff_devices
  FOR UPDATE
  USING (staff_id = auth.uid());

-- RLS Policies for auth_logs
CREATE POLICY "Staff can view own logs"
  ON auth_logs
  FOR SELECT
  USING (staff_id = auth.uid());

CREATE POLICY "Service role can insert logs"
  ON auth_logs
  FOR INSERT
  WITH CHECK (TRUE);

-- Function to cleanup expired sessions (runs every 10 minutes)
CREATE OR REPLACE FUNCTION cleanup_expired_qr_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE auth_qr_sessions
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
  
  -- Delete sessions older than 24 hours
  DELETE FROM auth_qr_sessions
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- Schedule cleanup job with pg_cron (if available)
-- SELECT cron.schedule('cleanup-expired-qr-sessions', '*/10 * * * *', 'SELECT cleanup_expired_qr_sessions()');

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for staff_devices
CREATE TRIGGER update_staff_devices_updated_at
  BEFORE UPDATE ON staff_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON auth_qr_sessions TO anon, authenticated, service_role;
GRANT ALL ON staff_devices TO authenticated, service_role;
GRANT ALL ON auth_logs TO authenticated, service_role;
