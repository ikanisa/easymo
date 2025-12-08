-- Week 6: Webhook Traffic Routing Infrastructure
-- Migration: 20251203140600_webhook_traffic_routing.sql
-- Purpose: Enable gradual traffic migration to wa-webhook-unified

BEGIN;

-- Create webhook routing configuration table
CREATE TABLE IF NOT EXISTS webhook_routing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (percentage >= 0 AND percentage <= 100),
  enabled BOOLEAN NOT NULL DEFAULT false,
  domains TEXT[] NOT NULL DEFAULT ARRAY['jobs', 'marketplace', 'property']::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT DEFAULT current_user,
  notes TEXT
);

-- Align existing table in case earlier deployments created a partial shape
ALTER TABLE webhook_routing_config
  ADD COLUMN IF NOT EXISTS percentage DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS domains TEXT[],
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE webhook_routing_config ALTER COLUMN percentage SET DEFAULT 0.00;
ALTER TABLE webhook_routing_config ALTER COLUMN enabled SET DEFAULT false;
ALTER TABLE webhook_routing_config ALTER COLUMN domains SET DEFAULT ARRAY['jobs', 'marketplace', 'property']::TEXT[];
ALTER TABLE webhook_routing_config ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE webhook_routing_config ALTER COLUMN updated_at SET DEFAULT now();

-- Add comment
COMMENT ON TABLE webhook_routing_config IS 'Controls gradual traffic routing to wa-webhook-unified';
COMMENT ON COLUMN webhook_routing_config.percentage IS 'Percentage of traffic to route to unified webhook (0-100)';
COMMENT ON COLUMN webhook_routing_config.domains IS 'Domains eligible for routing (jobs, marketplace, property)';

-- Insert initial config (0% routing, disabled)
INSERT INTO webhook_routing_config (domain, target_function, traffic_percentage, percentage, domains, enabled, notes)
VALUES (
  'default',
  'legacy',
  0,
  0.00, 
  ARRAY['jobs', 'marketplace', 'property']::TEXT[], 
  false,
  'Week 6 initial setup - routing disabled until infrastructure verified'
)
ON CONFLICT DO NOTHING;

-- Function to safely update routing percentage
CREATE OR REPLACE FUNCTION update_routing_percentage(
  new_percentage DECIMAL,
  update_notes TEXT DEFAULT NULL
)
RETURNS webhook_routing_config AS $$
DECLARE
  result webhook_routing_config;
BEGIN
  -- Validate percentage
  IF new_percentage < 0 OR new_percentage > 100 THEN
    RAISE EXCEPTION 'Percentage must be between 0 and 100, got %', new_percentage;
  END IF;
  
  -- Update configuration
  UPDATE webhook_routing_config
  SET 
    percentage = new_percentage,
    updated_at = now(),
    notes = COALESCE(update_notes, notes)
  WHERE id = (
    SELECT id FROM webhook_routing_config 
    ORDER BY created_at DESC 
    LIMIT 1
  )
  RETURNING * INTO result;
  
  -- Log the change
  RAISE NOTICE 'Routing percentage updated to %. Enabled: %, Domains: %', 
    result.percentage, result.enabled, result.domains;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_routing_percentage IS 'Safely update webhook routing percentage with validation';

-- Function to enable/disable routing
CREATE OR REPLACE FUNCTION set_routing_enabled(
  is_enabled BOOLEAN,
  update_notes TEXT DEFAULT NULL
)
RETURNS webhook_routing_config AS $$
DECLARE
  result webhook_routing_config;
BEGIN
  UPDATE webhook_routing_config
  SET 
    enabled = is_enabled,
    updated_at = now(),
    notes = COALESCE(update_notes, notes)
  WHERE id = (
    SELECT id FROM webhook_routing_config 
    ORDER BY created_at DESC 
    LIMIT 1
  )
  RETURNING * INTO result;
  
  RAISE NOTICE 'Routing enabled set to: %', is_enabled;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create routing logs table for monitoring
CREATE TABLE IF NOT EXISTS webhook_routing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  routed_to TEXT NOT NULL CHECK (routed_to IN ('unified', 'legacy', 'error')),
  from_number TEXT,
  message_id TEXT,
  response_time_ms INTEGER CHECK (response_time_ms >= 0),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE webhook_routing_logs IS 'Logs all webhook routing decisions for monitoring and debugging';

DO $$
DECLARE
  has_created_at BOOLEAN;
  has_routed_to BOOLEAN;
  has_status BOOLEAN;
  has_latency BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'webhook_routing_logs' AND column_name = 'created_at'
  ) INTO has_created_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'webhook_routing_logs' AND column_name = 'routed_to'
  ) INTO has_routed_to;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'webhook_routing_logs' AND column_name = 'status'
  ) INTO has_status;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'webhook_routing_logs' AND column_name = 'response_time_ms'
  ) INTO has_latency;

  IF has_created_at AND has_routed_to AND has_status THEN
    -- New schema
    CREATE INDEX IF NOT EXISTS idx_routing_logs_created_at 
      ON webhook_routing_logs(created_at DESC);
      
    CREATE INDEX IF NOT EXISTS idx_routing_logs_status 
      ON webhook_routing_logs(status) 
      WHERE status = 'error';
      
    CREATE INDEX IF NOT EXISTS idx_routing_logs_domain 
      ON webhook_routing_logs(domain, created_at DESC);
      
    CREATE INDEX IF NOT EXISTS idx_routing_logs_routed_to 
      ON webhook_routing_logs(routed_to, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_routing_logs_domain_status_time 
      ON webhook_routing_logs(domain, status, created_at DESC);

    CREATE OR REPLACE VIEW webhook_routing_stats AS
    SELECT 
      domain,
      routed_to,
      COUNT(*) as request_count,
      ROUND(AVG(response_time_ms)::numeric, 2) as avg_response_ms,
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY response_time_ms)::numeric, 2) as p50_ms,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms)::numeric, 2) as p95_ms,
      ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms)::numeric, 2) as p99_ms,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
      ROUND(
        (SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(*), 0)) * 100,
        4
      ) as error_rate_pct,
      MIN(created_at) as first_request,
      MAX(created_at) as last_request
    FROM webhook_routing_logs
    WHERE created_at > now() - interval '1 hour'
    GROUP BY domain, routed_to
    ORDER BY domain, routed_to;
  ELSE
    -- Legacy schema: routed_at + latency_ms + success boolean + target_function
    RAISE NOTICE 'Using legacy webhook_routing_logs schema for routing stats.';
    CREATE OR REPLACE VIEW webhook_routing_stats AS
    SELECT 
      domain,
      target_function AS routed_to,
      COUNT(*) as request_count,
      ROUND(AVG(latency_ms)::numeric, 2) as avg_response_ms,
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms)::numeric, 2) as p50_ms,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::numeric, 2) as p95_ms,
      ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms)::numeric, 2) as p99_ms,
      SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as error_count,
      ROUND(
        (SUM(CASE WHEN success = false THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(*), 0)) * 100,
        4
      ) as error_rate_pct,
      MIN(routed_at) as first_request,
      MAX(routed_at) as last_request
    FROM webhook_routing_logs
    WHERE routed_at > now() - interval '1 hour'
    GROUP BY domain, target_function
    ORDER BY domain, target_function;
  END IF;
END $$;

COMMENT ON VIEW webhook_routing_stats IS 'Real-time webhook routing statistics (last 1 hour)';

-- Create function to get current routing config
CREATE OR REPLACE FUNCTION get_current_routing_config()
RETURNS webhook_routing_config AS $$
  SELECT * FROM webhook_routing_config 
  ORDER BY created_at DESC 
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Create function to check routing health
CREATE OR REPLACE FUNCTION check_routing_health()
RETURNS TABLE(
  domain TEXT,
  routed_to TEXT,
  is_healthy BOOLEAN,
  error_rate DECIMAL,
  p95_latency DECIMAL,
  issue TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.domain,
    s.routed_to,
    (s.error_rate_pct < 0.1 AND s.p95_ms < 2000) as is_healthy,
    s.error_rate_pct,
    s.p95_ms,
    CASE 
      WHEN s.error_rate_pct >= 0.1 THEN 'High error rate: ' || s.error_rate_pct || '%'
      WHEN s.p95_ms >= 2000 THEN 'High P95 latency: ' || s.p95_ms || 'ms'
      ELSE 'OK'
    END as issue
  FROM webhook_routing_stats s;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_routing_health IS 'Check if routing meets health criteria (error < 0.1%, P95 < 2s)';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT ON webhook_routing_config TO anon, authenticated;
-- GRANT SELECT ON webhook_routing_logs TO authenticated;
-- GRANT SELECT ON webhook_routing_stats TO authenticated;

COMMIT;
