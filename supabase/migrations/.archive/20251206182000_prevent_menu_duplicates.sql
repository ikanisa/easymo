BEGIN;

-- Enhanced duplicate prevention for bar menu items
-- Prevents similar/duplicate items within the same bar

-- 1. Add function to normalize item names for comparison
CREATE OR REPLACE FUNCTION normalize_menu_item_name(item_name TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Remove extra spaces, convert to lowercase, trim
  RETURN lower(regexp_replace(trim(item_name), '\s+', ' ', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Add check constraint to prevent empty names
ALTER TABLE public.bar_menu_items
DROP CONSTRAINT IF EXISTS bar_menu_items_item_name_not_empty;

ALTER TABLE public.bar_menu_items
ADD CONSTRAINT bar_menu_items_item_name_not_empty 
CHECK (length(trim(item_name)) > 0);

-- 3. Create unique index on normalized names (case-insensitive)
DROP INDEX IF EXISTS idx_bar_menu_items_unique_normalized;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bar_menu_items_unique_normalized 
ON public.bar_menu_items (bar_id, normalize_menu_item_name(item_name), lower(category));

-- 4. Add trigger to prevent similar names being inserted
CREATE OR REPLACE FUNCTION prevent_similar_menu_items()
RETURNS TRIGGER AS $$
DECLARE
  similar_count INT;
  normalized_new TEXT;
BEGIN
  -- Normalize the new item name
  normalized_new := normalize_menu_item_name(NEW.item_name);
  
  -- Check for items with > 85% similarity in the same category
  SELECT COUNT(*) INTO similar_count
  FROM bar_menu_items
  WHERE bar_id = NEW.bar_id
    AND category = NEW.category
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND similarity(normalize_menu_item_name(item_name), normalized_new) > 0.85;
  
  IF similar_count > 0 THEN
    RAISE EXCEPTION 'Similar menu item already exists in this category. Please use a more unique name.'
      USING HINT = 'Check existing items in category: ' || NEW.category;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger (optional - can be disabled if too strict)
DROP TRIGGER IF EXISTS trigger_prevent_similar_menu_items ON public.bar_menu_items;
-- Commented out by default - uncomment to enable similarity checking
-- CREATE TRIGGER trigger_prevent_similar_menu_items
--   BEFORE INSERT OR UPDATE ON public.bar_menu_items
--   FOR EACH ROW
--   EXECUTE FUNCTION prevent_similar_menu_items();

-- 6. Create helper function to find duplicates
CREATE OR REPLACE FUNCTION find_duplicate_menu_items(p_bar_id UUID DEFAULT NULL)
RETURNS TABLE (
  bar_id UUID,
  bar_name TEXT,
  item_name TEXT,
  category TEXT,
  duplicate_count BIGINT,
  item_ids UUID[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bmi.bar_id,
    MAX(bmi.bar_name) as bar_name,
    bmi.item_name,
    bmi.category,
    COUNT(*) as duplicate_count,
    array_agg(bmi.id ORDER BY bmi.created_at) as item_ids
  FROM bar_menu_items bmi
  WHERE p_bar_id IS NULL OR bmi.bar_id = p_bar_id
  GROUP BY bmi.bar_id, normalize_menu_item_name(bmi.item_name), lower(bmi.category), bmi.item_name, bmi.category
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC, bmi.bar_name;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to clean duplicates (keeps oldest)
CREATE OR REPLACE FUNCTION clean_duplicate_menu_items(p_bar_id UUID DEFAULT NULL)
RETURNS TABLE (
  deleted_count INT,
  bar_id UUID,
  details TEXT
) AS $$
DECLARE
  total_deleted INT := 0;
  dup_record RECORD;
BEGIN
  FOR dup_record IN 
    SELECT * FROM find_duplicate_menu_items(p_bar_id)
  LOOP
    -- Delete all but the first (oldest) item
    DELETE FROM bar_menu_items
    WHERE id = ANY(dup_record.item_ids[2:]);
    
    GET DIAGNOSTICS total_deleted = ROW_COUNT;
    
    RETURN QUERY SELECT 
      total_deleted,
      dup_record.bar_id,
      format('Removed %s duplicates of "%s" in category "%s"', 
             total_deleted, dup_record.item_name, dup_record.category);
  END LOOP;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, NULL::UUID, 'No duplicates found'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Usage Examples:
-- 
-- 1. Find duplicates across all bars:
--    SELECT * FROM find_duplicate_menu_items();
--
-- 2. Find duplicates for specific bar:
--    SELECT * FROM find_duplicate_menu_items('bar-uuid');
--
-- 3. Clean duplicates (keeps oldest, removes rest):
--    SELECT * FROM clean_duplicate_menu_items();
--
-- 4. Test the normalized index:
--    -- These should all fail as duplicates:
--    INSERT INTO bar_menu_items (bar_id, bar_name, item_name, category, price)
--    VALUES ('bar-id', 'Bar Name', 'Pizza Margherita', 'Pizza', 10.00);
--    -- Fails: 'pizza margherita' (lowercase)
--    -- Fails: 'Pizza  Margherita' (extra space)
--    -- Fails: '  Pizza Margherita  ' (extra spaces)
