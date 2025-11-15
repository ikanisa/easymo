-- Add Malta-Specific Job Categories
-- Extends job_categories with Malta popular sectors

BEGIN;

-- Add Malta-specific categories
INSERT INTO job_categories (name, description, icon, parent_category, is_active) VALUES
  ('igaming', 'iGaming & Betting', '🎰', NULL, true),
  ('healthcare', 'Healthcare & Nursing', '🏥', NULL, true),
  ('maritime', 'Maritime & Yachting', '⚓', NULL, true),
  ('finance', 'Finance & Banking', '💰', NULL, true)
ON CONFLICT (name) DO NOTHING;

-- Add sub-categories for hospitality (popular in Malta)
INSERT INTO job_categories (name, description, icon, parent_category, is_active) VALUES
  ('bar_staff', 'Bar Staff', '🍺', 'cooking', true),
  ('hotel_staff', 'Hotel Staff', '🏨', 'cooking', true),
  ('restaurant_manager', 'Restaurant Manager', '👔', 'cooking', true)
ON CONFLICT (name) DO NOTHING;

-- Update job category matching to recognize Malta terms
COMMENT ON TABLE job_categories IS 
  'Job categories including Malta-specific sectors: iGaming, maritime, healthcare, hospitality.';

COMMIT;
