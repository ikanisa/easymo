BEGIN;

-- Add easyMO Petro Station as token recipient partner
INSERT INTO public.token_partners (name, whatsapp_e164, category, is_active, metadata)
VALUES 
  ('easyMO Petro Station', '+250795588258', 'petrol_station', true, '{"location": "Kigali", "type": "production"}'::jsonb)
ON CONFLICT (whatsapp_e164) DO UPDATE
SET 
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata;

COMMIT;
