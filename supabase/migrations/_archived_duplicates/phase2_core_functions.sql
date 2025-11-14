-- =====================================================
-- PHASE 2: CORE FUNCTIONS - Business Logic & Observability
-- Migrations: Partitions, Functions, Observability, Security
-- =====================================================

BEGIN;

-- =====================================================
-- MIGRATION 7: 20251112135631_partition_automation.sql
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_monthly_partition(
  parent_table TEXT,
  partition_date DATE
)
RETURNS VOID AS $$
DECLARE
  partition_name TEXT;
  start_date TEXT;
  end_date TEXT;
BEGIN
  partition_name := parent_table || '_' || TO_CHAR(partition_date, 'YYYY_MM');
  start_date := TO_CHAR(partition_date, 'YYYY-MM-01');
  end_date := TO_CHAR(partition_date + INTERVAL '1 month', 'YYYY-MM-01');
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = partition_name
    AND n.nspname = 'public'
  ) THEN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
      partition_name, parent_table, start_date, end_date
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MIGRATION 8: 20251112135632_add_essential_functions.sql
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, created_at, updated_at)
  VALUES (NEW.id::TEXT, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.get_user_wallet(p_user_id TEXT)
RETURNS TABLE (
  wallet_id UUID,
  balance NUMERIC,
  currency TEXT,
  status TEXT,
  last_transaction_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id,
    w.balance,
    w.currency,
    w.status,
    (
      SELECT MAX(wt.created_at)
      FROM public.wallet_transactions wt
      WHERE wt.wallet_id = w.id
    ) as last_transaction_at
  FROM public.wallet_accounts w
  WHERE w.user_id = p_user_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- MIGRATION 9: 20251112135633_observability_enhancements.sql
-- =====================================================

CREATE OR REPLACE FUNCTION public.log_structured_event(
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'::JSONB,
  p_user_id TEXT DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_correlation_id TEXT;
BEGIN
  v_correlation_id := COALESCE(p_correlation_id, gen_random_uuid()::TEXT);
  
  INSERT INTO public.event_store (
    event_type,
    event_data,
    user_id,
    correlation_id,
    created_at
  ) VALUES (
    p_event_type,
    p_event_data || jsonb_build_object(
      'timestamp', NOW()::TEXT,
      'source', 'database'
    ),
    p_user_id,
    v_correlation_id,
    NOW()
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.record_metric(
  p_service_name text,
  p_metric_type text,
  p_metric_name text,
  p_value numeric,
  p_unit text DEFAULT NULL,
  p_tags jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_metric_id uuid;
BEGIN
  INSERT INTO public.system_metrics (
    service_name,
    metric_type,
    metric_name,
    value,
    unit,
    tags
  ) VALUES (
    p_service_name,
    p_metric_type,
    p_metric_name,
    p_value,
    p_unit,
    p_tags
  ) RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$$;

-- =====================================================
-- MIGRATION 10: 20251112135634_security_policy_refinements.sql
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (auth.jwt() ->> 'sub')::UUID
    AND (metadata->>'is_admin')::BOOLEAN = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
CREATE POLICY "profiles_read_own" ON public.profiles
  FOR SELECT
  USING (
    user_id = (auth.jwt() ->> 'sub')::UUID
    OR public.is_admin()
    OR auth.role() = 'service_role'
  );

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_wallet(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_structured_event(TEXT, JSONB, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_metric(text, text, text, numeric, text, jsonb) TO service_role;

COMMIT;

-- Mark migrations as applied
INSERT INTO supabase_migrations.schema_migrations (version, name, inserted_at)
VALUES
  ('20251112135631', 'partition_automation', NOW()),
  ('20251112135632', 'add_essential_functions', NOW()),
  ('20251112135633', 'observability_enhancements', NOW()),
  ('20251112135634', 'security_policy_refinements', NOW())
ON CONFLICT (version) DO NOTHING;
