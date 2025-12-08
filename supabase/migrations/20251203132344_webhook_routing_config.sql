BEGIN;

-- Routing configuration table for wa-webhook consolidation
CREATE TABLE IF NOT EXISTS webhook_routing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  target_function TEXT NOT NULL,
  traffic_percentage INTEGER DEFAULT 0 CHECK (traffic_percentage >= 0 AND traffic_percentage <= 100),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE webhook_routing_config IS 'Traffic routing configuration for wa-webhook consolidation (Phase 2)';
COMMENT ON COLUMN webhook_routing_config.traffic_percentage IS 'Percentage of traffic to route to target_function (0-100)';

-- Insert initial config (0% traffic)
INSERT INTO webhook_routing_config (domain, target_function, traffic_percentage) VALUES
  ('jobs', 'wa-webhook-unified', 0),
  ('marketplace', 'wa-webhook-unified', 0),
  ('property', 'wa-webhook-unified', 0),
  ('ai-agents', 'wa-webhook-unified', 0)
ON CONFLICT (domain) DO NOTHING;

-- Routing logs for monitoring and debugging
CREATE TABLE IF NOT EXISTS webhook_routing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  source_function TEXT NOT NULL,
  target_function TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  message_id TEXT,
  latency_ms INTEGER,
  success BOOLEAN,
  error_message TEXT,
  routed_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE webhook_routing_logs IS 'Audit log for webhook routing decisions and outcomes';

CREATE INDEX IF NOT EXISTS idx_routing_logs_domain ON webhook_routing_logs(domain, routed_at DESC);
CREATE INDEX IF NOT EXISTS idx_routing_logs_success ON webhook_routing_logs(success, routed_at DESC);
CREATE INDEX IF NOT EXISTS idx_routing_logs_routed_at ON webhook_routing_logs(routed_at DESC);

-- RLS policies
ALTER TABLE webhook_routing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_routing_logs ENABLE ROW LEVEL SECURITY;

-- Service role can manage routing configuration
DROP POLICY IF EXISTS "Service role can manage routing config" ON webhook_routing_config;
CREATE POLICY "Service role can manage routing config" ON webhook_routing_config
  FOR ALL USING (auth.role() = 'service_role');

-- Service role can insert/view routing logs
DROP POLICY IF EXISTS "Service role can manage routing logs" ON webhook_routing_logs;
CREATE POLICY "Service role can manage routing logs" ON webhook_routing_logs
  FOR ALL USING (auth.role() = 'service_role');

-- View for monitoring routing metrics
CREATE OR REPLACE VIEW webhook_routing_metrics AS
SELECT 
  domain,
  target_function,
  COUNT(*) as total_requests,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as success_rate,
  ROUND(AVG(latency_ms), 0) as avg_latency_ms,
  ROUND(MAX(latency_ms), 0) as max_latency_ms,
  MAX(routed_at) as last_routed_at
FROM webhook_routing_logs
WHERE routed_at > NOW() - INTERVAL '24 hours'
GROUP BY domain, target_function;

COMMENT ON VIEW webhook_routing_metrics IS 'Real-time routing metrics for last 24 hours';

COMMIT;
