BEGIN;

-- Migration 2: Create get_profile_menu_items_v2 RPC function with business category filtering

CREATE OR REPLACE FUNCTION public.get_profile_menu_items_v2(
  p_user_id UUID,
  p_country_code TEXT DEFAULT 'RW',
  p_language TEXT DEFAULT 'en'
)
RETURNS TABLE (
  item_key TEXT,
  display_order INTEGER,
  icon TEXT,
  title TEXT,
  description TEXT,
  action_type TEXT,
  action_target TEXT,
  metadata JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_business BOOLEAN := false;
  v_user_business_categories TEXT[];
  v_has_bar_restaurant BOOLEAN := false;
BEGIN
  -- Check if user has any businesses
  SELECT EXISTS (
    SELECT 1 FROM public.business
    WHERE owner_user_id = p_user_id
      AND is_active = true
    LIMIT 1
  ) INTO v_has_business;
  
  -- Get user's business categories (lowercase for matching)
  SELECT ARRAY_AGG(DISTINCT LOWER(COALESCE(b.category_name, b.tag, '')))
  INTO v_user_business_categories
  FROM public.business b
  WHERE b.owner_user_id = p_user_id
    AND b.is_active = true
    AND (b.category_name IS NOT NULL OR b.tag IS NOT NULL);
  
  -- Ensure we have an array even if empty
  v_user_business_categories := COALESCE(v_user_business_categories, ARRAY[]::TEXT[]);
  
  -- Check if user has bar/restaurant businesses
  SELECT EXISTS (
    SELECT 1
    FROM unnest(v_user_business_categories) AS cat
    WHERE cat ILIKE '%bar%'
       OR cat ILIKE '%restaurant%'
       OR cat ILIKE '%pub%'
       OR cat ILIKE '%cafe%'
       OR cat ILIKE '%bistro%'
    LIMIT 1
  ) INTO v_has_bar_restaurant;
  
  -- Return filtered menu items
  RETURN QUERY
  SELECT 
    pmi.item_key,
    pmi.display_order,
    pmi.icon,
    COALESCE(
      pmi.translations->>p_language->'title',
      pmi.translations->'en'->>'title',
      pmi.item_key
    ) AS title,
    COALESCE(
      pmi.translations->>p_language->'description',
      pmi.translations->'en'->>'description',
      ''
    ) AS description,
    pmi.action_type,
    pmi.action_target,
    jsonb_build_object(
      'has_business', v_has_business,
      'has_bar_restaurant', v_has_bar_restaurant,
      'user_categories', v_user_business_categories
    ) AS metadata
  FROM public.profile_menu_items pmi
  WHERE pmi.is_active = true
    -- Filter by country if active_countries is set
    AND (pmi.active_countries IS NULL OR p_country_code = ANY(pmi.active_countries))
    -- Filter by business category if requires_business_category is set
    AND (
      pmi.requires_business_category IS NULL
      OR EXISTS (
        SELECT 1
        FROM unnest(pmi.requires_business_category) AS required_cat
        FROM unnest(v_user_business_categories) AS user_cat
        WHERE user_cat ILIKE '%' || required_cat || '%'
      )
    )
    -- Filter by visibility conditions
    AND (
      pmi.visibility_conditions = '{}'::jsonb
      OR (
        -- Check has_bar_restaurant condition
        (pmi.visibility_conditions->>'has_bar_restaurant')::BOOLEAN IS NULL
        OR (pmi.visibility_conditions->>'has_bar_restaurant')::BOOLEAN = v_has_bar_restaurant
      )
    )
  ORDER BY pmi.display_order, pmi.item_key;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_profile_menu_items_v2(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_menu_items_v2(UUID, TEXT, TEXT) TO anon;

COMMIT;
