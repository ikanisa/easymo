-- Ensure the client_settings view only exposes the primary settings row.
CREATE OR REPLACE VIEW public.client_settings AS
SELECT 
  id,
  subscription_price,
  search_radius_km,
  max_results,
  support_phone_e164,
  created_at,
  updated_at
FROM public.settings
WHERE key IS NULL;
