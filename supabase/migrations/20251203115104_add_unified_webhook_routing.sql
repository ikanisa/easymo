-- Migration: Add unified webhook routing infrastructure
-- Purpose: Enable gradual migration from legacy webhooks to wa-webhook-unified
-- Week: 4-7+ Migration
-- Date: 2025-12-03

BEGIN;

-- ============================================================================
-- 1. Add routing column to users table
-- ============================================================================

-- Add column to control which webhook version users use
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS use_unified_webhook BOOLEAN DEFAULT false;

-- Add index for fast routing lookups
CREATE INDEX IF NOT EXISTS idx_users_unified_webhook 
ON public.users(use_unified_webhook) 
WHERE use_unified_webhook = true;

-- Add comment for documentation
COMMENT ON COLUMN public.users.use_unified_webhook IS 
'Controls routing to wa-webhook-unified (true) or legacy webhooks (false). Used for gradual migration.';


-- ============================================================================
-- 2. Create monitoring tables
-- ============================================================================

-- Track webhook invocations for comparison
CREATE TABLE IF NOT EXISTS public.webhook_metrics (
  id BIGSERIAL PRIMARY KEY,
  webhook_name TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id),
  agent_type TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT NOT NULL, -- 'success', 'error', 'timeout'
  error_message TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast querying
CREATE INDEX IF NOT EXISTS idx_webhook_metrics_webhook_name 
ON public.webhook_metrics(webhook_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_metrics_user_id 
ON public.webhook_metrics(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_metrics_status 
ON public.webhook_metrics(status, created_at DESC);

-- Track migration progress
CREATE TABLE IF NOT EXISTS public.migration_status (
  id SERIAL PRIMARY KEY,
  phase TEXT NOT NULL, -- 'week4', 'week5', 'week6', 'week7+'
  percentage INTEGER NOT NULL,
  total_users INTEGER NOT NULL,
  unified_users INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  success_criteria_met BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track rollback events
CREATE TABLE IF NOT EXISTS public.migration_rollbacks (
  id SERIAL PRIMARY KEY,
  phase TEXT NOT NULL,
  reason TEXT NOT NULL,
  error_rate DECIMAL(5,2),
  latency_p95 INTEGER,
  user_complaints INTEGER,
  rolled_back_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rolled_back_by TEXT
);


-- ============================================================================
-- 3. Helper Functions
-- ============================================================================

-- Function to randomly assign users to unified webhook (for gradual rollout)
CREATE OR REPLACE FUNCTION assign_users_to_unified_webhook(target_percentage INTEGER)
RETURNS TABLE(assigned_count BIGINT, total_count BIGINT) AS $$
DECLARE
  v_assigned_count BIGINT;
  v_total_count BIGINT;
BEGIN
  -- Get total user count
  SELECT COUNT(*) INTO v_total_count FROM public.users;
  
  -- Reset all users to legacy first
  UPDATE public.users SET use_unified_webhook = false;
  
  -- Randomly assign target percentage to unified
  WITH random_users AS (
    SELECT id
    FROM public.users
    ORDER BY RANDOM()
    LIMIT (v_total_count * target_percentage / 100)
  )
  UPDATE public.users
  SET use_unified_webhook = true
  WHERE id IN (SELECT id FROM random_users);
  
  -- Get count of assigned users
  SELECT COUNT(*) INTO v_assigned_count 
  FROM public.users 
  WHERE use_unified_webhook = true;
  
  -- Return results
  RETURN QUERY SELECT v_assigned_count, v_total_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get routing decision for a user
CREATE OR REPLACE FUNCTION get_webhook_route(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_use_unified BOOLEAN;
BEGIN
  SELECT use_unified_webhook INTO v_use_unified
  FROM public.users
  WHERE id = p_user_id;
  
  IF v_use_unified THEN
    RETURN 'wa-webhook-unified';
  ELSE
    RETURN 'legacy';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to log webhook metrics
CREATE OR REPLACE FUNCTION log_webhook_metric(
  p_webhook_name TEXT,
  p_user_id UUID,
  p_agent_type TEXT,
  p_started_at TIMESTAMPTZ,
  p_completed_at TIMESTAMPTZ,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_duration_ms INTEGER;
BEGIN
  v_duration_ms := EXTRACT(EPOCH FROM (p_completed_at - p_started_at)) * 1000;
  
  INSERT INTO public.webhook_metrics (
    webhook_name,
    user_id,
    agent_type,
    started_at,
    completed_at,
    duration_ms,
    status,
    error_message,
    request_id
  ) VALUES (
    p_webhook_name,
    p_user_id,
    p_agent_type,
    p_started_at,
    p_completed_at,
    v_duration_ms,
    p_status,
    p_error_message,
    p_request_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 4. Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.webhook_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_rollbacks ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write metrics (monitoring queries)
DROP POLICY IF EXISTS "Service role can manage webhook_metrics" ON public.webhook_metrics;
CREATE POLICY "Service role can manage webhook_metrics"
ON public.webhook_metrics
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage migration_status" ON public.migration_status;
CREATE POLICY "Service role can manage migration_status"
ON public.migration_status
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage migration_rollbacks" ON public.migration_rollbacks;
CREATE POLICY "Service role can manage migration_rollbacks"
ON public.migration_rollbacks
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ============================================================================
-- 5. Initial Data
-- ============================================================================

-- Record Week 4 start
INSERT INTO public.migration_status (
  phase,
  percentage,
  total_users,
  unified_users,
  started_at,
  notes
) VALUES (
  'week4',
  0,
  (SELECT COUNT(*) FROM public.users),
  0,
  NOW(),
  'Migration infrastructure deployed. Ready to start 10% rollout.'
);


-- ============================================================================
-- 6. Grants
-- ============================================================================

-- Grant necessary permissions
GRANT SELECT ON public.users TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_webhook_route(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION assign_users_to_unified_webhook(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION log_webhook_metric(TEXT, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO service_role;

COMMIT;
