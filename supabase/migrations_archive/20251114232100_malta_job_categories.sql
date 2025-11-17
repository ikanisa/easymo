-- Add Malta-Specific Job Categories
-- Extends job_categories with Malta popular sectors

BEGIN;

-- Add Malta-specific categories
INSERT INTO job_categories (name, description, icon, parent_category) VALUES
  ('igaming', 'iGaming & Betting', '🎰', NULL),
  ('healthcare', 'Healthcare & Nursing', '🏥', NULL),
  ('maritime', 'Maritime & Yachting', '⚓', NULL),
  ('finance', 'Finance & Banking', '💰', NULL)
ON CONFLICT (name) DO NOTHING;

-- Add sub-categories for hospitality (popular in Malta)
INSERT INTO job_categories (name, description, icon, parent_category) VALUES
  ('bar_staff', 'Bar Staff', '🍺', 'cooking'),
  ('hotel_staff', 'Hotel Staff', '🏨', 'cooking'),
  ('restaurant_manager', 'Restaurant Manager', '👔', 'cooking')
ON CONFLICT (name) DO NOTHING;

-- Update job category matching to recognize Malta terms
COMMENT ON TABLE job_categories IS 
  'Job categories including Malta-specific sectors: iGaming, maritime, healthcare, hospitality.';

COMMIT;
