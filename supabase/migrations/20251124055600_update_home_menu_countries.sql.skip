-- Migration: Update home menu active countries
-- Date: 2025-11-24
-- Remove: UG (Uganda), KE (Kenya)
-- Add: CD (DR Congo), ZM (Zambia), TG (Togo)

BEGIN;

-- Update all menu items
-- Current: {RW,UG,KE,TZ,BI,CD} 
-- New: {RW,TZ,BI,CD,ZM,TG}

UPDATE whatsapp_home_menu_items
SET active_countries = ARRAY['RW', 'TZ', 'BI', 'CD', 'ZM', 'TG']
WHERE 'UG' = ANY(active_countries) OR 'KE' = ANY(active_countries);

COMMIT;
