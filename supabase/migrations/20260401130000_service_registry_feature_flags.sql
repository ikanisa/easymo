BEGIN;

-- Migration: Service Registry and Feature Flags
-- Purpose: Microservice coordination and dynamic feature management
-- Supports service discovery and gradual rollout capabilities

-- ============================================================================
-- SERVICE REGISTRY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.service_registry (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name text UNIQUE NOT NULL,
  service_type text NOT NULL, -- 'microservice', 'edge_function', 'api', 'worker'
  version text NOT NULL,
  endpoint text NOT NULL,
  health_check_url text,
  health_check_interval integer DEFAULT 30, -- seconds
  status text DEFAULT 'healthy' CHECK (status IN ('healthy', 'unhealthy', 'starting', 'stopping', 'stopped')),
  capabilities jsonb DEFAULT '[]'::jsonb, -- Array of service capabilities
  dependencies jsonb DEFAULT '[]'::jsonb, -- Array of dependent services
  configuration jsonb DEFAULT '{}'::jsonb,
  metrics jsonb DEFAULT '{}'::jsonb,
  last_heartbeat_at timestamptz,
  last_health_check_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  registered_by text
);

-- Indexes for service registry
CREATE INDEX IF NOT EXISTS idx_service_registry_name 
  ON public.service_registry (service_name);

CREATE INDEX IF NOT EXISTS idx_service_registry_status 
  ON public.service_registry (status) 
  WHERE status IN ('healthy', 'unhealthy');

CREATE INDEX IF NOT EXISTS idx_service_registry_heartbeat 
  ON public.service_registry (last_heartbeat_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_registry_type 
  ON public.service_registry (service_type);

-- RLS policies for service registry
ALTER TABLE public.service_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_registry" ON public.service_registry;
CREATE POLICY "service_role_full_access_registry" 
  ON public.service_registry 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_registry" ON public.service_registry;
CREATE POLICY "authenticated_read_registry" 
  ON public.service_registry 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.service_registry TO authenticated;
GRANT ALL ON public.service_registry TO service_role;

-- ============================================================================
-- FEATURE FLAGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  enabled boolean DEFAULT false NOT NULL,
  rollout_percentage integer DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  rollout_strategy text DEFAULT 'percentage' CHECK (rollout_strategy IN ('percentage', 'user_list', 'condition', 'all', 'none')),
  target_users jsonb DEFAULT '[]'::jsonb, -- Array of user IDs for targeted rollout
  conditions jsonb DEFAULT '{}'::jsonb, -- Conditions for conditional rollout
  environment text DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production', 'all')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for feature flags
CREATE INDEX IF NOT EXISTS idx_feature_flags_key 
  ON public.feature_flags (key);

CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled 
  ON public.feature_flags (enabled) 
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_feature_flags_environment 
  ON public.feature_flags (environment);

CREATE INDEX IF NOT EXISTS idx_feature_flags_updated 
  ON public.feature_flags (updated_at DESC);

-- RLS policies for feature flags
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_flags" ON public.feature_flags;
CREATE POLICY "service_role_full_access_flags" 
  ON public.feature_flags 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_flags" ON public.feature_flags;
CREATE POLICY "authenticated_read_flags" 
  ON public.feature_flags 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;

-- ============================================================================
-- FEATURE FLAG EVALUATIONS TABLE (Audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flag_evaluations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_key text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  evaluation_result boolean NOT NULL,
  evaluation_reason text, -- 'enabled', 'disabled', 'rollout', 'condition_match', etc.
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for evaluations
CREATE INDEX IF NOT EXISTS idx_flag_evaluations_flag_time 
  ON public.feature_flag_evaluations (flag_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_flag_evaluations_user 
  ON public.feature_flag_evaluations (user_id, created_at DESC);

-- RLS policies
ALTER TABLE public.feature_flag_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_evaluations" ON public.feature_flag_evaluations;
CREATE POLICY "service_role_full_access_evaluations" 
  ON public.feature_flag_evaluations 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Grant permissions
GRANT INSERT ON public.feature_flag_evaluations TO service_role;
GRANT SELECT ON public.feature_flag_evaluations TO authenticated;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to register or update a service
CREATE OR REPLACE FUNCTION public.register_service(
  p_service_name text,
  p_service_type text,
  p_version text,
  p_endpoint text,
  p_health_check_url text DEFAULT NULL,
  p_capabilities jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_service_id uuid;
BEGIN
  INSERT INTO public.service_registry (
    service_name,
    service_type,
    version,
    endpoint,
    health_check_url,
    capabilities,
    last_heartbeat_at
  ) VALUES (
    p_service_name,
    p_service_type,
    p_version,
    p_endpoint,
    p_health_check_url,
    p_capabilities,
    timezone('utc', now())
  )
  ON CONFLICT (service_name) DO UPDATE SET
    version = EXCLUDED.version,
    endpoint = EXCLUDED.endpoint,
    health_check_url = EXCLUDED.health_check_url,
    capabilities = EXCLUDED.capabilities,
    last_heartbeat_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  RETURNING id INTO v_service_id;
  
  RETURN v_service_id;
END;
$$;

-- Function to update service heartbeat
CREATE OR REPLACE FUNCTION public.service_heartbeat(
  p_service_name text,
  p_status text DEFAULT 'healthy',
  p_metrics jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.service_registry
  SET 
    status = p_status,
    metrics = p_metrics,
    last_heartbeat_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  WHERE service_name = p_service_name;
  
  RETURN FOUND;
END;
$$;

-- Function to evaluate a feature flag for a user
CREATE OR REPLACE FUNCTION public.is_feature_enabled(
  p_flag_key text,
  p_user_id uuid DEFAULT NULL,
  p_environment text DEFAULT 'production'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_flag record;
  v_result boolean := false;
  v_reason text := 'disabled';
  v_random_value integer;
BEGIN
  -- Get the feature flag
  SELECT * INTO v_flag
  FROM public.feature_flags
  WHERE key = p_flag_key
    AND (environment = p_environment OR environment = 'all')
  LIMIT 1;
  
  -- If flag doesn't exist or is disabled, return false
  IF v_flag IS NULL OR NOT v_flag.enabled THEN
    v_result := false;
    v_reason := 'disabled';
  ELSE
    -- Evaluate based on rollout strategy
    CASE v_flag.rollout_strategy
      WHEN 'all' THEN
        v_result := true;
        v_reason := 'enabled_for_all';
        
      WHEN 'none' THEN
        v_result := false;
        v_reason := 'disabled_for_all';
        
      WHEN 'user_list' THEN
        -- Check if user is in target list
        IF p_user_id IS NOT NULL AND v_flag.target_users ? p_user_id::text THEN
          v_result := true;
          v_reason := 'user_in_target_list';
        ELSE
          v_result := false;
          v_reason := 'user_not_in_target_list';
        END IF;
        
      WHEN 'percentage' THEN
        -- Use consistent hashing based on user_id for percentage rollout
        IF p_user_id IS NOT NULL THEN
          v_random_value := (hashtext(p_user_id::text) % 100);
          IF v_random_value < v_flag.rollout_percentage THEN
            v_result := true;
            v_reason := 'percentage_rollout_match';
          ELSE
            v_result := false;
            v_reason := 'percentage_rollout_no_match';
          END IF;
        ELSE
          v_result := false;
          v_reason := 'no_user_for_percentage';
        END IF;
        
      ELSE
        v_result := v_flag.enabled;
        v_reason := 'default_enabled_state';
    END CASE;
  END IF;
  
  -- Log evaluation (async, don't wait)
  INSERT INTO public.feature_flag_evaluations (
    flag_key,
    user_id,
    evaluation_result,
    evaluation_reason
  ) VALUES (
    p_flag_key,
    p_user_id,
    v_result,
    v_reason
  );
  
  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.register_service(text, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.service_heartbeat(text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_feature_enabled(text, uuid, text) TO authenticated, service_role;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for service health overview
CREATE OR REPLACE VIEW public.service_health_overview AS
SELECT 
  service_name,
  service_type,
  version,
  status,
  last_heartbeat_at,
  EXTRACT(EPOCH FROM (timezone('utc', now()) - last_heartbeat_at)) as seconds_since_heartbeat,
  CASE 
    WHEN last_heartbeat_at IS NULL THEN 'never_reported'
    WHEN timezone('utc', now()) - last_heartbeat_at < interval '2 minutes' THEN 'healthy'
    WHEN timezone('utc', now()) - last_heartbeat_at < interval '5 minutes' THEN 'warning'
    ELSE 'critical'
  END as health_status
FROM public.service_registry
ORDER BY service_name;

-- View for feature flag overview
CREATE OR REPLACE VIEW public.feature_flag_overview AS
SELECT 
  key,
  name,
  enabled,
  rollout_percentage,
  rollout_strategy,
  environment,
  updated_at
FROM public.feature_flags
ORDER BY name;

-- Grant view access
GRANT SELECT ON public.service_health_overview TO authenticated;
GRANT SELECT ON public.feature_flag_overview TO authenticated;

COMMIT;
