-- Standardize Waiter Domain Tables
-- Creates views for backward compatibility

BEGIN;

-- Create view for backward compatibility with restaurant_menu_items
-- This allows both table names to work
CREATE OR REPLACE VIEW restaurant_menu_items AS 
SELECT 
  id,
  restaurant_id,
  name,
  description,
  price,
  category,
  tags,
  available,
  image_url,
  created_at,
  updated_at
FROM menu_items
WHERE restaurant_id IS NOT NULL;

-- Add comment explaining the standardization
COMMENT ON VIEW restaurant_menu_items IS 
  'Backward compatibility view. Primary table is menu_items. Use menu_items in new code.';

COMMIT;
