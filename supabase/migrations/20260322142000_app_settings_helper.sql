BEGIN;

-- Ensure app_settings exists
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Helper function to fetch settings from app_settings table
CREATE OR REPLACE FUNCTION public.get_app_setting(setting_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  setting_value TEXT;
BEGIN
  SELECT value INTO setting_value
  FROM public.app_settings
  WHERE key = setting_key;

  RETURN setting_value;
END;
$$;

-- Upsert required settings
INSERT INTO public.app_settings (key, value, description)
VALUES
  ('app.supabase_url', 'https://lhbowpbcpwoiparwnwgt.supabase.co', 'Supabase project URL'),
  ('app.service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSIsInNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc', 'Service role key for scheduler hooks'),
  ('app.supabase_service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSIsInNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc', 'Legacy service role key alias'),
  ('app.property_owner_id', 'c7a4b3da-a9b4-4dc8-92f3-6d457dd2f888', 'Synthetic profile that owns scraped property listings')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = timezone('utc', now());

-- Ensure synthetic profile exists for property listings ownership
INSERT INTO public.profiles (user_id, display_name, metadata)
VALUES (
  'c7a4b3da-a9b4-4dc8-92f3-6d457dd2f888',
  'Property Aggregator',
  jsonb_build_object('source', 'system', 'description', 'Auto-generated profile for deep search listings')
)
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
