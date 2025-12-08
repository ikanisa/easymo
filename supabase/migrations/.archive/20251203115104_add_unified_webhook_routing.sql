-- Migration: Add unified webhook routing infrastructure
-- Purpose: Enable gradual migration from legacy webhooks to wa-webhook-unified
-- Week: 4-7+ Migration
-- Date: 2025-12-03

BEGIN;

DO $$
DECLARE
  v_user_table TEXT;
  v_fk_clause TEXT;
  v_index_name TEXT;
BEGIN
  -- Prefer the canonical users table; fall back to profiles on projects that do not expose public.users
  SELECT tbl INTO v_user_table
  FROM (
    SELECT 'public.users' AS tbl WHERE to_regclass('public.users') IS NOT NULL
    UNION ALL
    SELECT 'public.profiles' AS tbl WHERE to_regclass('public.profiles') IS NOT NULL
  ) candidates
  LIMIT 1;

  IF v_user_table IS NULL THEN
    RAISE NOTICE 'Skipping unified webhook routing migration: no public.users or public.profiles table present.';
    RETURN;
  END IF;

  v_fk_clause := format(' REFERENCES %s(id)', v_user_table);
  v_index_name := CASE
    WHEN v_user_table = 'public.users' THEN 'idx_users_unified_webhook'
    WHEN v_user_table = 'public.profiles' THEN 'idx_profiles_unified_webhook'
    ELSE 'idx_unified_webhook'
  END;

  -- =========================================================================
  -- 1. Add routing column to the resolved user table
  -- =========================================================================
  EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS use_unified_webhook BOOLEAN DEFAULT false', v_user_table);

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %s(use_unified_webhook) WHERE use_unified_webhook = true',
    v_index_name,
    v_user_table
  );

  EXECUTE format(
    'COMMENT ON COLUMN %s.use_unified_webhook IS %L',
    v_user_table,
    'Controls routing to wa-webhook-unified (true) or legacy webhooks (false). Used for gradual migration.'
  );

  EXECUTE format('UPDATE %s SET use_unified_webhook = COALESCE(use_unified_webhook, false)', v_user_table);

  -- =========================================================================
  -- 2. Create monitoring tables (FK is attached to whichever user table exists)
  -- =========================================================================
  EXECUTE format($fmt$
    CREATE TABLE IF NOT EXISTS public.webhook_metrics (
      id BIGSERIAL PRIMARY KEY,
      webhook_name TEXT NOT NULL,
      user_id UUID%s,
      agent_type TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      duration_ms INTEGER,
      status TEXT NOT NULL, -- 'success', 'error', 'timeout'
      error_message TEXT,
      request_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  $fmt$, v_fk_clause);

  EXECUTE $fmt$
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
  $fmt$;

  EXECUTE $fmt$
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
  $fmt$;

  -- Align webhook_metrics schema when it already exists
  IF to_regclass('public.webhook_metrics') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.webhook_metrics ADD COLUMN IF NOT EXISTS webhook_name TEXT';
    EXECUTE 'ALTER TABLE public.webhook_metrics ADD COLUMN IF NOT EXISTS user_id UUID';
    EXECUTE 'ALTER TABLE public.webhook_metrics ADD COLUMN IF NOT EXISTS agent_type TEXT';
    EXECUTE 'ALTER TABLE public.webhook_metrics ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ';
    EXECUTE 'ALTER TABLE public.webhook_metrics ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ';
    EXECUTE 'ALTER TABLE public.webhook_metrics ADD COLUMN IF NOT EXISTS duration_ms INTEGER';
    EXECUTE 'ALTER TABLE public.webhook_metrics ADD COLUMN IF NOT EXISTS status TEXT';
    EXECUTE 'ALTER TABLE public.webhook_metrics ADD COLUMN IF NOT EXISTS error_message TEXT';
    EXECUTE 'ALTER TABLE public.webhook_metrics ADD COLUMN IF NOT EXISTS request_id TEXT';
    EXECUTE 'ALTER TABLE public.webhook_metrics ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ';
    EXECUTE 'ALTER TABLE public.webhook_metrics ALTER COLUMN started_at SET DEFAULT NOW()';
    EXECUTE 'ALTER TABLE public.webhook_metrics ALTER COLUMN created_at SET DEFAULT NOW()';
  END IF;

  -- Index for fast querying
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_webhook_metrics_webhook_name ON public.webhook_metrics(webhook_name, created_at DESC)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_webhook_metrics_user_id ON public.webhook_metrics(user_id, created_at DESC)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_webhook_metrics_status ON public.webhook_metrics(status, created_at DESC)';

  -- =========================================================================
  -- 3. Row Level Security (RLS)
  -- =========================================================================
  EXECUTE 'ALTER TABLE public.webhook_metrics ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.migration_status ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.migration_rollbacks ENABLE ROW LEVEL SECURITY';

  EXECUTE 'DROP POLICY IF EXISTS "Service role can manage webhook_metrics" ON public.webhook_metrics';
  EXECUTE 'CREATE POLICY "Service role can manage webhook_metrics" ON public.webhook_metrics FOR ALL TO service_role USING (true) WITH CHECK (true)';

  EXECUTE 'DROP POLICY IF EXISTS "Service role can manage migration_status" ON public.migration_status';
  EXECUTE 'CREATE POLICY "Service role can manage migration_status" ON public.migration_status FOR ALL TO service_role USING (true) WITH CHECK (true)';

  EXECUTE 'DROP POLICY IF EXISTS "Service role can manage migration_rollbacks" ON public.migration_rollbacks';
  EXECUTE 'CREATE POLICY "Service role can manage migration_rollbacks" ON public.migration_rollbacks FOR ALL TO service_role USING (true) WITH CHECK (true)';

  -- =========================================================================
  -- 4. Initial Data
  -- =========================================================================
  IF NOT EXISTS (SELECT 1 FROM public.migration_status WHERE phase = 'week4') THEN
    EXECUTE format(
      'INSERT INTO public.migration_status (
        phase, percentage, total_users, unified_users, started_at, notes
      ) VALUES (
        ''week4'', 0, (SELECT COUNT(*) FROM %s), 0, NOW(),
        ''Migration infrastructure deployed. Ready to start 10%% rollout.''
      )',
      v_user_table
    );
  END IF;

  -- =========================================================================
  -- 5. Grants
  -- =========================================================================
  EXECUTE format('GRANT SELECT ON %s TO anon, authenticated', v_user_table);
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- Helper Functions (resolve target user table at runtime)
-- ===========================================================================
CREATE OR REPLACE FUNCTION assign_users_to_unified_webhook(target_percentage INTEGER)
RETURNS TABLE(assigned_count BIGINT, total_count BIGINT) AS $$
DECLARE
  v_assigned_count BIGINT := 0;
  v_total_count BIGINT := 0;
  v_target_table TEXT;
  v_target_count BIGINT;
BEGIN
  v_target_table := CASE
    WHEN to_regclass('public.users') IS NOT NULL THEN 'public.users'
    WHEN to_regclass('public.profiles') IS NOT NULL THEN 'public.profiles'
    ELSE NULL
  END;

  IF v_target_table IS NULL THEN
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  EXECUTE format('SELECT COUNT(*) FROM %s', v_target_table) INTO v_total_count;

  EXECUTE format('UPDATE %s SET use_unified_webhook = false', v_target_table);

  v_target_count := (v_total_count * GREATEST(LEAST(target_percentage, 100), 0) / 100);

  EXECUTE format(
    'WITH random_users AS (
       SELECT id FROM %s ORDER BY RANDOM() LIMIT %s
     )
     UPDATE %s
     SET use_unified_webhook = true
     WHERE id IN (SELECT id FROM random_users)',
    v_target_table,
    v_target_count,
    v_target_table
  );

  EXECUTE format('SELECT COUNT(*) FROM %s WHERE use_unified_webhook = true', v_target_table)
  INTO v_assigned_count;

  RETURN QUERY SELECT v_assigned_count, v_total_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_webhook_route(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_use_unified BOOLEAN := false;
  v_target_table TEXT;
BEGIN
  v_target_table := CASE
    WHEN to_regclass('public.users') IS NOT NULL THEN 'public.users'
    WHEN to_regclass('public.profiles') IS NOT NULL THEN 'public.profiles'
    ELSE NULL
  END;

  IF v_target_table IS NULL THEN
    RETURN 'legacy';
  END IF;

  EXECUTE format('SELECT use_unified_webhook FROM %s WHERE id = $1', v_target_table)
  INTO v_use_unified
  USING p_user_id;

  IF v_use_unified THEN
    RETURN 'wa-webhook-unified';
  ELSE
    RETURN 'legacy';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

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
  -- Skip quietly if the metrics table is unavailable on this environment
  IF to_regclass('public.webhook_metrics') IS NULL THEN
    RETURN;
  END IF;

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

GRANT EXECUTE ON FUNCTION get_webhook_route(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION assign_users_to_unified_webhook(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION log_webhook_metric(TEXT, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO service_role;

COMMIT;
