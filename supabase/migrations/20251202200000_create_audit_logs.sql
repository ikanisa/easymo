BEGIN;

-- Audit Logs Table for Security and Compliance
-- Tracks sensitive operations for security and compliance

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  service VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  request_id VARCHAR(100),
  correlation_id VARCHAR(100),
  ip_address INET,
  resource VARCHAR(100),
  resource_id VARCHAR(100),
  details JSONB DEFAULT '{}',
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('success', 'failure', 'partial')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_service ON audit_logs(service);
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation ON audit_logs(correlation_id);

-- RLS Policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can insert
DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_logs;
CREATE POLICY "Service role can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- Only admins can view
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

COMMENT ON TABLE audit_logs IS 'Security and compliance audit trail for all sensitive operations';
COMMENT ON COLUMN audit_logs.service IS 'Microservice name that generated the log';
COMMENT ON COLUMN audit_logs.action IS 'Action performed (e.g., AUTH_SUCCESS, WALLET_TRANSFER)';
COMMENT ON COLUMN audit_logs.severity IS 'Event severity level for alerting';
COMMENT ON COLUMN audit_logs.details IS 'Additional context (sensitive data must be masked)';

COMMIT;
