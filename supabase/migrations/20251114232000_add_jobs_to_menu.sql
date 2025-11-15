-- Add Jobs Menu Item to WhatsApp Home Menu
-- Place it on first page (display_order 1)
-- Available in both Rwanda and Malta

BEGIN;

-- Shift all existing menu items down by 1
UPDATE whatsapp_home_menu_items 
SET display_order = display_order + 1 
WHERE display_order >= 1;

-- Insert Jobs as the first menu item
INSERT INTO whatsapp_home_menu_items (
  key,
  name,
  label_en,
  label_fr,
  label_rw,
  description_en,
  description_fr,
  description_rw,
  icon,
  display_order,
  active_countries,
  page_number,
  is_active,
  requires_auth,
  feature_flag
) VALUES (
  'jobs',
  '💼 Jobs & Gigs',
  'Jobs & Gigs',
  'Emplois & Petits Boulots',
  'Imirimo n''Akazi',
  'Find work or post jobs - from one-day gigs to full-time positions',
  'Trouver du travail ou publier des offres d''emploi - des petits boulots aux postes à temps plein',
  'Shakisha akazi cyangwa utangaze imirimo - kuva ku murimo w''umunsi umwe kugeza ku kazi cyuzuye',
  '💼',
  1,
  ARRAY['RW', 'MT'],
  1,
  true,
  false,
  'FEATURE_JOB_BOARD'
) ON CONFLICT (key) DO UPDATE SET
  display_order = 1,
  active_countries = ARRAY['RW', 'MT'],
  page_number = 1,
  is_active = true;

-- Update job_sources config to include Malta queries
UPDATE job_sources
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{queries}',
  (
    SELECT jsonb_agg(query)
    FROM (
      -- Keep existing Rwanda queries
      SELECT jsonb_array_elements(config->'queries') as query
      FROM job_sources
      WHERE source_type = 'openai_deep_search'
      
      UNION ALL
      
      -- Add Malta queries
      SELECT '{"country": "MT", "city": "Valletta", "query": "one day casual jobs in Valletta Malta", "kind": "one_day"}'::jsonb
      UNION ALL
      SELECT '{"country": "MT", "city": "Sliema", "query": "part time jobs in Sliema Malta", "kind": "part_time"}'::jsonb
      UNION ALL
      SELECT '{"country": "MT", "city": "St Julians", "query": "hospitality jobs St Julians Malta", "kind": "full_time"}'::jsonb
      UNION ALL
      SELECT '{"country": "MT", "query": "delivery driver jobs Malta", "kind": "full_time"}'::jsonb
      UNION ALL
      SELECT '{"country": "MT", "query": "restaurant waiter jobs Malta", "kind": "part_time"}'::jsonb
    ) subquery
  )
)
WHERE source_type = 'openai_deep_search';

-- Update SerpAPI config to include Malta
UPDATE job_sources
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{queries}',
  (
    SELECT jsonb_agg(query)
    FROM (
      -- Keep existing queries
      SELECT jsonb_array_elements(config->'queries') as query
      FROM job_sources
      WHERE source_type = 'serpapi'
      
      UNION ALL
      
      -- Add Malta queries
      SELECT '{"country": "MT", "query": "jobs in Malta"}'::jsonb
      UNION ALL
      SELECT '{"country": "MT", "city": "Valletta", "query": "jobs in Valletta"}'::jsonb
      UNION ALL
      SELECT '{"country": "MT", "city": "Sliema", "query": "jobs in Sliema"}'::jsonb
    ) subquery
  )
)
WHERE source_type = 'serpapi';

-- Add comment for tracking
COMMENT ON TABLE whatsapp_home_menu_items IS 
  'WhatsApp home menu configuration. Jobs menu item added as first item (display_order=1) for RW and MT.';

COMMIT;
