BEGIN;

-- Migration: Add updated_at triggers to all tables with updated_at column
-- Date: 2025-11-12
-- Description: Ensure updated_at columns are automatically updated on row modification

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper function to safely add trigger
CREATE OR REPLACE FUNCTION public.add_updated_at_trigger(p_table_name TEXT)
RETURNS VOID AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = p_table_name 
    AND column_name = 'updated_at'
  ) THEN
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', p_table_name);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', p_table_name);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all relevant tables
DO $$ 
DECLARE
  table_names TEXT[] := ARRAY[
    'admin_alert_prefs', 'admin_sessions', 'agent_document_chunks', 'agent_personas',
    'agent_registry', 'agent_toolkits', 'agent_versions', 'app_config', 'background_jobs',
    'bar_numbers', 'bar_settings', 'bar_tables', 'bars', 'cache_entries', 'carts',
    'categories', 'chat_state', 'contacts', 'driver_status', 'driver_presence',
    'driver_availability', 'driver_parking', 'properties', 'scheduled_trips',
    'recurring_trips', 'shops', 'businesses', 'menus', 'items', 'orders',
    'notifications', 'wallet_accounts', 'payment_methods', 'locations', 'routes',
    'feature_flags', 'service_registry', 'profiles', 'trips', 'vouchers',
    'subscriptions', 'settings', 'sessions', 'petrol_stations', 'campaigns'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY table_names LOOP
    PERFORM public.add_updated_at_trigger(tbl);
  END LOOP;
END $$;

-- Clean up helper function
DROP FUNCTION IF EXISTS public.add_updated_at_trigger(TEXT);

COMMIT;
