BEGIN;

-- Migration: Lock down public reads
-- Purpose: Remove overly-permissive public SELECT policies, create authenticated-only 
-- SELECT policies for profiles, driver_presence, trips, subscriptions; create a 
-- sanitized public.client_settings view exposing only non-sensitive settings; revoke 
-- direct public access to settings and grant select on client_settings to public.

-- Drop existing overly-permissive public SELECT policies if they exist
DROP POLICY IF EXISTS "public_read_profiles" ON public.profiles;
DROP POLICY IF EXISTS "public_read_driver_presence" ON public.driver_presence;
DROP POLICY IF EXISTS "public_read_trips" ON public.trips;
DROP POLICY IF EXISTS "public_read_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "public_read_settings" ON public.settings;

-- Create authenticated-only SELECT policies
CREATE POLICY "authenticated_read_profiles" 
  ON public.profiles 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "authenticated_read_driver_presence" 
  ON public.driver_presence 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "authenticated_read_trips" 
  ON public.trips 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "authenticated_read_subscriptions" 
  ON public.subscriptions 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Create sanitized view for client settings (non-sensitive fields only)
CREATE OR REPLACE VIEW public.client_settings AS
SELECT 
  id,
  subscription_price,
  search_radius_km,
  max_results,
  support_phone_e164,
  created_at,
  updated_at
FROM public.settings;

-- Revoke direct public access to settings table
REVOKE SELECT ON public.settings FROM public;
REVOKE SELECT ON public.settings FROM anon;

-- Grant SELECT on the sanitized view to public and anon roles
GRANT SELECT ON public.client_settings TO public;
GRANT SELECT ON public.client_settings TO anon;
GRANT SELECT ON public.client_settings TO authenticated;

COMMIT;
