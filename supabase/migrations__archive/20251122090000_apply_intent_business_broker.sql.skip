-- ================================================================
-- Business Broker Agent - Intent Application Logic
-- ================================================================
-- This migration creates the apply_intent_business_broker function
-- that handles all Business Broker agent intents.
--
-- Agent: Business Broker (find nearby services, shops, pharmacies)
-- Tables: business_directory, vendors, vendor_capabilities, user_saved_businesses
-- Intent Types:
--   - find_service, search_business, find_nearby
--   - get_details, business_info
--   - save_business, save_favorite
--   - view_saved, my_favorites
--   - get_directions
--   - general_inquiry, help
--
-- Created: 2025-11-22
-- ================================================================

BEGIN;

-- ================================================================
-- 1. CREATE user_saved_businesses TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.user_saved_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.whatsapp_users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.business_directory(id) ON DELETE CASCADE,
  
  -- Metadata
  notes TEXT,
  tags TEXT[] DEFAULT '{}'::text[],
  
  -- Timestamps
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  last_visited TIMESTAMPTZ,
  
  UNIQUE(user_id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_user_saved_businesses_user_id 
  ON public.user_saved_businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_businesses_business_id 
  ON public.user_saved_businesses(business_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_businesses_saved_at 
  ON public.user_saved_businesses(saved_at DESC);

-- RLS for user_saved_businesses
ALTER TABLE public.user_saved_businesses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_saved_businesses' 
    AND policyname = 'user_saved_businesses_select'
  ) THEN
    CREATE POLICY "user_saved_businesses_select"
      ON public.user_saved_businesses
      FOR SELECT
      USING (TRUE);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_saved_businesses' 
    AND policyname = 'user_saved_businesses_insert'
  ) THEN
    CREATE POLICY "user_saved_businesses_insert"
      ON public.user_saved_businesses
      FOR INSERT
      WITH CHECK (TRUE);
  END IF;
END $$;

COMMENT ON TABLE public.user_saved_businesses IS 
  'User-saved favorite businesses for quick access';

-- ================================================================
-- 2. CREATE apply_intent_business_broker FUNCTION
-- ================================================================

CREATE OR REPLACE FUNCTION public.apply_intent_business_broker(
  p_intent_id UUID,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_intent_type TEXT;
  v_user_id UUID;
  v_conversation_id UUID;
  v_result JSONB := '{"success": true}'::jsonb;
  v_updated_entities JSONB[] := ARRAY[]::JSONB[];
  v_matches JSONB[] := ARRAY[]::JSONB[];
  v_business RECORD;
  v_search_results JSONB[] := ARRAY[]::JSONB[];
  v_saved_businesses JSONB[] := ARRAY[]::JSONB[];
  v_category TEXT;
  v_location_lat DOUBLE PRECISION;
  v_location_lng DOUBLE PRECISION;
  v_radius_km DOUBLE PRECISION := 10;
  v_business_id UUID;
  v_limit INTEGER := 10;
BEGIN
  -- Get intent details
  SELECT 
    i.intent_type,
    c.user_id,
    i.conversation_id
  INTO v_intent_type, v_user_id, v_conversation_id
  FROM ai_agent_intents i
  JOIN whatsapp_conversations c ON c.id = i.conversation_id
  WHERE i.id = p_intent_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Intent not found'
    );
  END IF;

  -- ============================================================
  -- INTENT: find_service, search_business, find_nearby
  -- ============================================================
  IF v_intent_type IN ('find_service', 'search_business', 'find_nearby') THEN
    
    v_category := p_payload->>'category';
    v_location_lat := (p_payload->>'latitude')::DOUBLE PRECISION;
    v_location_lng := (p_payload->>'longitude')::DOUBLE PRECISION;
    v_radius_km := COALESCE((p_payload->>'radius_km')::DOUBLE PRECISION, 10);
    v_limit := COALESCE((p_payload->>'limit')::INTEGER, 10);

    -- Search business_directory
    FOR v_business IN
      SELECT 
        id,
        name,
        category,
        address,
        city,
        phone,
        rating,
        review_count,
        lat,
        lng,
        google_maps_url,
        operating_hours,
        CASE 
          WHEN v_location_lat IS NOT NULL AND v_location_lng IS NOT NULL 
            AND lat IS NOT NULL AND lng IS NOT NULL
          THEN 
            -- Calculate distance in km using Haversine formula
            6371 * acos(
              cos(radians(v_location_lat)) 
              * cos(radians(lat)) 
              * cos(radians(lng) - radians(v_location_lng)) 
              + sin(radians(v_location_lat)) 
              * sin(radians(lat))
            )
          ELSE NULL
        END AS distance_km
      FROM business_directory
      WHERE 
        (v_category IS NULL OR category ILIKE '%' || v_category || '%')
        AND status NOT IN ('DO_NOT_CALL')
      ORDER BY
        CASE 
          WHEN v_location_lat IS NOT NULL AND v_location_lng IS NOT NULL 
            AND lat IS NOT NULL AND lng IS NOT NULL
          THEN distance_km
          ELSE rating
        END ASC NULLS LAST,
        rating DESC,
        review_count DESC
      LIMIT v_limit
    LOOP
      v_search_results := v_search_results || jsonb_build_object(
        'id', v_business.id,
        'name', v_business.name,
        'category', v_business.category,
        'address', v_business.address,
        'city', v_business.city,
        'phone', v_business.phone,
        'rating', v_business.rating,
        'review_count', v_business.review_count,
        'distance_km', v_business.distance_km,
        'google_maps_url', v_business.google_maps_url,
        'operating_hours', v_business.operating_hours
      );
    END LOOP;

    v_matches := v_matches || jsonb_build_object(
      'type', 'business_search_results',
      'count', array_length(v_search_results, 1),
      'results', v_search_results
    );

    v_result := v_result || jsonb_build_object(
      'next_action', format('Found %s businesses', 
        COALESCE(array_length(v_search_results, 1), 0))
    );

  -- ============================================================
  -- INTENT: get_details, business_info
  -- ============================================================
  ELSIF v_intent_type IN ('get_details', 'business_info') THEN
    
    v_business_id := (p_payload->>'business_id')::UUID;

    IF v_business_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Missing business_id'
      );
    END IF;

    -- Get full business details
    SELECT
      id,
      name,
      category,
      address,
      city,
      phone,
      website,
      email,
      rating,
      review_count,
      lat,
      lng,
      google_maps_url,
      operating_hours,
      business_type,
      notes
    INTO v_business
    FROM business_directory
    WHERE id = v_business_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Business not found'
      );
    END IF;

    v_updated_entities := v_updated_entities || jsonb_build_object(
      'type', 'business_details',
      'business', row_to_json(v_business)
    );

    v_result := v_result || jsonb_build_object(
      'next_action', format('Details for %s', v_business.name)
    );

  -- ============================================================
  -- INTENT: save_business, save_favorite
  -- ============================================================
  ELSIF v_intent_type IN ('save_business', 'save_favorite') THEN
    
    v_business_id := (p_payload->>'business_id')::UUID;

    IF v_business_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Missing business_id'
      );
    END IF;

    -- Insert or update saved business
    INSERT INTO user_saved_businesses (user_id, business_id, notes, tags)
    VALUES (
      v_user_id,
      v_business_id,
      p_payload->>'notes',
      COALESCE((p_payload->>'tags')::TEXT[], '{}'::TEXT[])
    )
    ON CONFLICT (user_id, business_id) 
    DO UPDATE SET
      notes = COALESCE(EXCLUDED.notes, user_saved_businesses.notes),
      tags = COALESCE(EXCLUDED.tags, user_saved_businesses.tags),
      saved_at = NOW();

    -- Get business name
    SELECT name INTO v_business
    FROM business_directory
    WHERE id = v_business_id;

    v_updated_entities := v_updated_entities || jsonb_build_object(
      'type', 'saved_business',
      'action', 'created',
      'business_id', v_business_id,
      'business_name', v_business.name
    );

    v_result := v_result || jsonb_build_object(
      'next_action', format('Saved %s to favorites', v_business.name)
    );

  -- ============================================================
  -- INTENT: view_saved, my_favorites
  -- ============================================================
  ELSIF v_intent_type IN ('view_saved', 'my_favorites') THEN
    
    -- Get user's saved businesses
    FOR v_business IN
      SELECT 
        bd.id,
        bd.name,
        bd.category,
        bd.address,
        bd.city,
        bd.phone,
        bd.rating,
        usb.saved_at,
        usb.last_visited,
        usb.notes,
        usb.tags
      FROM user_saved_businesses usb
      JOIN business_directory bd ON bd.id = usb.business_id
      WHERE usb.user_id = v_user_id
      ORDER BY usb.saved_at DESC
      LIMIT 20
    LOOP
      v_saved_businesses := v_saved_businesses || jsonb_build_object(
        'id', v_business.id,
        'name', v_business.name,
        'category', v_business.category,
        'address', v_business.address,
        'city', v_business.city,
        'phone', v_business.phone,
        'rating', v_business.rating,
        'saved_at', v_business.saved_at,
        'last_visited', v_business.last_visited,
        'notes', v_business.notes,
        'tags', v_business.tags
      );
    END LOOP;

    v_matches := v_matches || jsonb_build_object(
      'type', 'saved_businesses',
      'count', array_length(v_saved_businesses, 1),
      'businesses', v_saved_businesses
    );

    v_result := v_result || jsonb_build_object(
      'next_action', format('You have %s saved businesses', 
        COALESCE(array_length(v_saved_businesses, 1), 0))
    );

  -- ============================================================
  -- INTENT: get_directions
  -- ============================================================
  ELSIF v_intent_type = 'get_directions' THEN
    
    v_business_id := (p_payload->>'business_id')::UUID;

    IF v_business_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Missing business_id'
      );
    END IF;

    -- Get business location
    SELECT
      name,
      lat,
      lng,
      google_maps_url,
      address
    INTO v_business
    FROM business_directory
    WHERE id = v_business_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Business not found'
      );
    END IF;

    v_updated_entities := v_updated_entities || jsonb_build_object(
      'type', 'directions',
      'business_name', v_business.name,
      'latitude', v_business.lat,
      'longitude', v_business.lng,
      'google_maps_url', v_business.google_maps_url,
      'address', v_business.address
    );

    v_result := v_result || jsonb_build_object(
      'next_action', format('Directions to %s', v_business.name)
    );

  -- ============================================================
  -- INTENT: general_inquiry, help
  -- ============================================================
  ELSIF v_intent_type IN ('general_inquiry', 'help') THEN
    
    v_result := v_result || jsonb_build_object(
      'next_action', 'Show help menu with available categories'
    );

  -- ============================================================
  -- UNKNOWN INTENT TYPE
  -- ============================================================
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Unknown intent type: %s', v_intent_type)
    );
  END IF;

  -- ============================================================
  -- UPDATE INTENT STATUS
  -- ============================================================
  UPDATE ai_agent_intents
  SET 
    status = 'applied',
    applied_at = NOW(),
    result = v_result
  WHERE id = p_intent_id;

  -- ============================================================
  -- BUILD FINAL RESULT
  -- ============================================================
  v_result := v_result || jsonb_build_object(
    'updated_entities', v_updated_entities,
    'matches', v_matches
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Update intent with error
    UPDATE ai_agent_intents
    SET 
      status = 'error',
      result = jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'detail', SQLSTATE
      )
    WHERE id = p_intent_id;
    
    -- Return error
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;

-- ================================================================
-- 3. GRANT PERMISSIONS
-- ================================================================

GRANT EXECUTE ON FUNCTION public.apply_intent_business_broker TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_intent_business_broker TO anon;
GRANT EXECUTE ON FUNCTION public.apply_intent_business_broker TO service_role;

-- ================================================================
-- 4. ADD COMMENTS
-- ================================================================

COMMENT ON FUNCTION public.apply_intent_business_broker IS 
  'Applies Business Broker agent intents - search businesses, save favorites, get directions';

COMMIT;
