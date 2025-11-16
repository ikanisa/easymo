BEGIN;

-- Migration: Service Configurations
-- Purpose: Centralized configuration storage for microservices
-- Complements existing service_registry with runtime configuration management

-- ============================================================================
-- CONFIGURATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.configurations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name text NOT NULL,
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production', 'all')),
  config_key text NOT NULL,
  config_value jsonb NOT NULL,
  value_type text DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'secret')),
  is_secret boolean DEFAULT false,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(service_name, environment, config_key)
);

-- Indexes for configuration queries
CREATE INDEX IF NOT EXISTS idx_configurations_service_env 
  ON public.configurations (service_name, environment);

CREATE INDEX IF NOT EXISTS idx_configurations_key 
  ON public.configurations (config_key);

CREATE INDEX IF NOT EXISTS idx_configurations_updated 
  ON public.configurations (updated_at DESC);

-- RLS policies for configurations
ALTER TABLE public.configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_config" ON public.configurations;
CREATE POLICY "service_role_full_access_config" 
  ON public.configurations 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_config" ON public.configurations;
CREATE POLICY "authenticated_read_config" 
  ON public.configurations 
  FOR SELECT 
  TO authenticated 
  USING (is_secret = false);

-- Grant permissions
GRANT SELECT ON public.configurations TO authenticated;
GRANT ALL ON public.configurations TO service_role;

-- ============================================================================
-- CONFIGURATION HISTORY TABLE (Audit trail for config changes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.configuration_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  configuration_id uuid NOT NULL,
  service_name text NOT NULL,
  environment text NOT NULL,
  config_key text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  change_reason text,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for configuration history
CREATE INDEX IF NOT EXISTS idx_config_history_config_id 
  ON public.configuration_history (configuration_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_config_history_service 
  ON public.configuration_history (service_name, environment, created_at DESC);

-- RLS policies for configuration history
ALTER TABLE public.configuration_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_config_history" ON public.configuration_history;
CREATE POLICY "service_role_full_access_config_history" 
  ON public.configuration_history 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_config_history" ON public.configuration_history;
CREATE POLICY "authenticated_read_config_history" 
  ON public.configuration_history 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.configuration_history TO authenticated;
GRANT INSERT ON public.configuration_history TO service_role;

-- ============================================================================
-- TRIGGER FOR CONFIGURATION CHANGES
-- ============================================================================

-- Trigger function to track configuration changes
CREATE OR REPLACE FUNCTION public.track_configuration_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track updates, not inserts
  IF TG_OP = 'UPDATE' AND (OLD.config_value IS DISTINCT FROM NEW.config_value) THEN
    INSERT INTO public.configuration_history (
      configuration_id,
      service_name,
      environment,
      config_key,
      old_value,
      new_value,
      changed_by
    ) VALUES (
      NEW.id,
      NEW.service_name,
      NEW.environment,
      NEW.config_key,
      OLD.config_value,
      NEW.config_value,
      NEW.updated_by
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_track_config_changes ON public.configurations;
CREATE TRIGGER trg_track_config_changes
  AFTER UPDATE ON public.configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.track_configuration_changes();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get configuration value
CREATE OR REPLACE FUNCTION public.get_config(
  p_service_name text,
  p_config_key text,
  p_environment text DEFAULT 'production'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config_value jsonb;
BEGIN
  -- Try to get environment-specific config first
  SELECT config_value INTO v_config_value
  FROM public.configurations
  WHERE service_name = p_service_name
    AND config_key = p_config_key
    AND environment = p_environment
  LIMIT 1;
  
  -- If not found, try 'all' environment
  IF v_config_value IS NULL THEN
    SELECT config_value INTO v_config_value
    FROM public.configurations
    WHERE service_name = p_service_name
      AND config_key = p_config_key
      AND environment = 'all'
    LIMIT 1;
  END IF;
  
  RETURN v_config_value;
END;
$$;

-- Function to set configuration value
CREATE OR REPLACE FUNCTION public.set_config(
  p_service_name text,
  p_config_key text,
  p_config_value jsonb,
  p_environment text DEFAULT 'production',
  p_value_type text DEFAULT 'string',
  p_is_secret boolean DEFAULT false,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config_id uuid;
BEGIN
  INSERT INTO public.configurations (
    service_name,
    environment,
    config_key,
    config_value,
    value_type,
    is_secret,
    description,
    created_by,
    updated_by
  ) VALUES (
    p_service_name,
    p_environment,
    p_config_key,
    p_config_value,
    p_value_type,
    p_is_secret,
    p_description,
    auth.uid(),
    auth.uid()
  )
  ON CONFLICT (service_name, environment, config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    value_type = EXCLUDED.value_type,
    is_secret = EXCLUDED.is_secret,
    description = EXCLUDED.description,
    updated_by = auth.uid(),
    updated_at = timezone('utc', now())
  RETURNING id INTO v_config_id;
  
  RETURN v_config_id;
END;
$$;

-- Function to get all configs for a service
CREATE OR REPLACE FUNCTION public.get_service_configs(
  p_service_name text,
  p_environment text DEFAULT 'production',
  p_include_secrets boolean DEFAULT false
)
RETURNS TABLE (
  config_key text,
  config_value jsonb,
  value_type text,
  description text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.config_key,
    c.config_value,
    c.value_type,
    c.description
  FROM public.configurations c
  WHERE c.service_name = p_service_name
    AND (c.environment = p_environment OR c.environment = 'all')
    AND (p_include_secrets = true OR c.is_secret = false)
  ORDER BY c.config_key;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_config(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_config(text, text, jsonb, text, text, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_service_configs(text, text, boolean) TO service_role;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for configuration summary
CREATE OR REPLACE VIEW public.configuration_summary AS
SELECT 
  service_name,
  environment,
  COUNT(*) as config_count,
  SUM(CASE WHEN is_secret THEN 1 ELSE 0 END) as secret_count,
  MAX(updated_at) as last_updated
FROM public.configurations
GROUP BY service_name, environment
ORDER BY service_name, environment;

-- Grant view access
GRANT SELECT ON public.configuration_summary TO authenticated;

COMMIT;
