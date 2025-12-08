-- =====================================================================
-- APPLY INTENT: REAL ESTATE AGENT
-- =====================================================================
-- Domain-specific intent application for Real Estate Agent
-- Called by agent framework after intent is parsed
--
-- FEATURES:
-- - Search properties by location/budget/bedrooms
-- - Create property listings
-- - Schedule viewings
-- - Match tenants with landlords
-- - Manage saved searches
-- - Track viewing history
--
-- INTENT TYPES SUPPORTED:
-- - search_property, find_property: Search for rental properties
-- - create_listing, list_property: Create new property listing
-- - schedule_viewing, book_viewing: Schedule property viewing
-- - view_listings, my_listings: View user's property listings
-- - save_search: Save search criteria for alerts
-- - contact_landlord: Initiate contact with property owner
-- - general_inquiry, help: Show help information
--
-- Created: 2025-11-22 (Agent Refactor - Phase 1)
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_intent_real_estate(
  intent_id uuid,
  payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_intent_type text;
  v_user_id uuid;
  v_result jsonb := '{}';
  v_updated_entities jsonb[] := '{}';
  v_matches jsonb[] := '{}';
  v_next_action text;
BEGIN
  -- 1. Get intent details
  SELECT ai.intent_type, wc.user_id
  INTO v_intent_type, v_user_id
  FROM ai_agent_intents ai
  JOIN whatsapp_conversations wc ON wc.id = ai.conversation_id
  WHERE ai.id = intent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intent not found: %', intent_id;
  END IF;

  -- 2. Apply intent based on type
  CASE v_intent_type
    
    -- SEARCH PROPERTIES
    WHEN 'search_property', 'find_property', 'find_rental' THEN
      DECLARE
        v_location text;
        v_city_area text;
        v_min_price numeric;
        v_max_price numeric;
        v_bedrooms int;
        v_property_type text;
        v_properties jsonb;
      BEGIN
        v_location := payload->>'location';
        v_city_area := payload->>'city_area';
        v_min_price := (payload->>'min_price')::numeric;
        v_max_price := (payload->>'max_price')::numeric;
        v_bedrooms := (payload->>'bedrooms')::int;
        v_property_type := payload->>'property_type';
        
        -- Search properties (assuming properties table exists)
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'title', p.title,
            'location', p.location_text,
            'city_area', p.city_area,
            'price', p.monthly_rent,
            'currency', p.currency,
            'bedrooms', p.bedrooms,
            'bathrooms', p.bathrooms,
            'property_type', p.property_type,
            'available_from', p.available_from,
            'landlord_phone', wu.phone_number
          )
          ORDER BY p.monthly_rent ASC
        )
        INTO v_properties
        FROM properties p
        LEFT JOIN whatsapp_users wu ON wu.id = p.landlord_id
        WHERE p.status = 'available'
          AND (v_city_area IS NULL OR p.city_area ILIKE '%' || v_city_area || '%')
          AND (v_min_price IS NULL OR p.monthly_rent >= v_min_price)
          AND (v_max_price IS NULL OR p.monthly_rent <= v_max_price)
          AND (v_bedrooms IS NULL OR p.bedrooms >= v_bedrooms)
          AND (v_property_type IS NULL OR p.property_type = v_property_type)
        LIMIT 5;
        
        v_next_action := format(
          'Found %s properties in %s. Show list with prices and bedroom counts.',
          COALESCE(jsonb_array_length(v_properties), 0),
          COALESCE(v_city_area, v_location, 'area')
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'property_search',
            'action', 'searched',
            'location', COALESCE(v_city_area, v_location),
            'results_count', COALESCE(jsonb_array_length(v_properties), 0),
            'properties', v_properties
          )
        ];
        
        -- Create match events
        FOR i IN 0..COALESCE(jsonb_array_length(v_properties), 0) - 1 LOOP
          v_matches := array_append(v_matches,
            jsonb_build_object(
              'entity_type', 'property',
              'entity_id', (v_properties->i->>'id')::uuid,
              'match_score', 0.85,
              'metadata', jsonb_build_object(
                'price', v_properties->i->>'price',
                'bedrooms', v_properties->i->>'bedrooms'
              )
            )
          );
        END LOOP;
      END;
    
    -- CREATE PROPERTY LISTING
    WHEN 'create_listing', 'list_property' THEN
      DECLARE
        v_property_id uuid;
        v_title text;
        v_property_type text;
        v_bedrooms int;
        v_bathrooms int;
        v_monthly_rent numeric;
        v_currency text;
        v_city_area text;
        v_location_text text;
        v_available_from date;
      BEGIN
        v_title := payload->>'title';
        v_property_type := COALESCE(payload->>'property_type', 'apartment');
        v_bedrooms := (payload->>'bedrooms')::int;
        v_bathrooms := (payload->>'bathrooms')::int;
        v_monthly_rent := (payload->>'monthly_rent')::numeric;
        v_currency := COALESCE(payload->>'currency', 'RWF');
        v_city_area := payload->>'city_area';
        v_location_text := payload->>'location';
        v_available_from := COALESCE((payload->>'available_from')::date, CURRENT_DATE);
        
        -- Create property listing
        INSERT INTO properties (
          landlord_id,
          title,
          property_type,
          bedrooms,
          bathrooms,
          monthly_rent,
          currency,
          city_area,
          location_text,
          available_from,
          status
        )
        VALUES (
          v_user_id,
          v_title,
          v_property_type,
          v_bedrooms,
          v_bathrooms,
          v_monthly_rent,
          v_currency,
          v_city_area,
          v_location_text,
          v_available_from,
          'available'
        )
        RETURNING id INTO v_property_id;
        
        v_next_action := format(
          'Property listed! ID: %s. %s BR %s in %s at %s %s/month.',
          v_property_id, v_bedrooms, v_property_type, v_city_area, v_monthly_rent, v_currency
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'property',
            'action', 'created',
            'property_id', v_property_id,
            'title', v_title,
            'bedrooms', v_bedrooms,
            'price', v_monthly_rent
          )
        ];
      END;
    
    -- SCHEDULE VIEWING
    WHEN 'schedule_viewing', 'book_viewing' THEN
      DECLARE
        v_property_id uuid;
        v_viewing_date timestamptz;
        v_viewing_id uuid;
      BEGIN
        v_property_id := (payload->>'property_id')::uuid;
        v_viewing_date := (payload->>'viewing_date')::timestamptz;
        
        -- Create viewing record (assuming property_viewings table)
        INSERT INTO property_viewings (
          property_id,
          viewer_id,
          viewing_date,
          status
        )
        VALUES (
          v_property_id,
          v_user_id,
          v_viewing_date,
          'scheduled'
        )
        RETURNING id INTO v_viewing_id;
        
        v_next_action := format(
          'Viewing scheduled for %s. Notify landlord and send confirmation to tenant.',
          v_viewing_date
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'viewing',
            'action', 'scheduled',
            'viewing_id', v_viewing_id,
            'property_id', v_property_id,
            'date', v_viewing_date
          )
        ];
      END;
    
    -- VIEW MY LISTINGS
    WHEN 'view_listings', 'my_listings', 'my_properties' THEN
      DECLARE
        v_listings jsonb;
      BEGIN
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'title', p.title,
            'bedrooms', p.bedrooms,
            'price', p.monthly_rent,
            'currency', p.currency,
            'status', p.status,
            'city_area', p.city_area,
            'available_from', p.available_from,
            'created_at', p.created_at
          )
          ORDER BY p.created_at DESC
        )
        INTO v_listings
        FROM properties p
        WHERE p.landlord_id = v_user_id
        LIMIT 10;
        
        v_next_action := format(
          'Showing %s property listings. Display with emoji numbers.',
          COALESCE(jsonb_array_length(v_listings), 0)
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'listings_view',
            'action', 'retrieved',
            'count', COALESCE(jsonb_array_length(v_listings), 0),
            'listings', v_listings
          )
        ];
      END;
    
    -- SAVE SEARCH CRITERIA
    WHEN 'save_search' THEN
      DECLARE
        v_search_id uuid;
        v_search_name text;
      BEGIN
        v_search_name := payload->>'name';
        
        -- Create saved search (assuming saved_searches table)
        INSERT INTO saved_searches (
          user_id,
          search_name,
          search_type,
          criteria
        )
        VALUES (
          v_user_id,
          v_search_name,
          'property',
          payload
        )
        RETURNING id INTO v_search_id;
        
        v_next_action := format(
          'Search "%s" saved! Will notify when matching properties are listed.',
          v_search_name
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'saved_search',
            'action', 'created',
            'search_id', v_search_id,
            'name', v_search_name
          )
        ];
      END;
    
    -- CONTACT LANDLORD
    WHEN 'contact_landlord', 'inquire' THEN
      DECLARE
        v_property_id uuid;
        v_landlord_id uuid;
        v_message text;
      BEGIN
        v_property_id := (payload->>'property_id')::uuid;
        v_message := payload->>'message';
        
        -- Get landlord ID
        SELECT landlord_id INTO v_landlord_id
        FROM properties
        WHERE id = v_property_id;
        
        v_next_action := format(
          'Connecting you with landlord for property %s. Send inquiry message.',
          v_property_id
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'inquiry',
            'action', 'sent',
            'property_id', v_property_id,
            'landlord_id', v_landlord_id
          )
        ];
        
        v_matches := ARRAY[
          jsonb_build_object(
            'entity_type', 'property_inquiry',
            'entity_id', v_property_id,
            'match_score', 0.9,
            'metadata', jsonb_build_object(
              'landlord_id', v_landlord_id,
              'message', v_message
            )
          )
        ];
      END;
    
    -- GENERAL INQUIRY / HELP
    WHEN 'general_inquiry', 'help' THEN
      v_next_action := 'Show Real Estate help: 1️⃣ Search Properties 2️⃣ List Property 3️⃣ My Listings 4️⃣ Schedule Viewing 5️⃣ Saved Searches';
      v_updated_entities := ARRAY[
        jsonb_build_object(
          'type', 'help',
          'action', 'shown',
          'menu_items', 5
        )
      ];
    
    ELSE
      v_next_action := format('Unknown intent type: %s. Ask user to clarify.', v_intent_type);
      v_updated_entities := ARRAY[
        jsonb_build_object(
          'type', 'error',
          'action', 'unknown_intent',
          'intent_type', v_intent_type
        )
      ];
  END CASE;

  -- 3. Build result object
  v_result := jsonb_build_object(
    'success', true,
    'intent_id', intent_id,
    'intent_type', v_intent_type,
    'user_id', v_user_id,
    'updated_entities', v_updated_entities,
    'matches', v_matches,
    'next_action', v_next_action,
    'applied_at', NOW()
  );

  -- 4. Update intent status
  UPDATE ai_agent_intents
  SET
    status = 'applied',
    applied_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'result', v_result,
      'entities_updated', array_length(v_updated_entities, 1)
    )
  WHERE id = intent_id;

  -- 5. Create match events
  IF array_length(v_matches, 1) > 0 THEN
    INSERT INTO ai_agent_match_events (
      intent_id,
      entity_type,
      entity_id,
      match_score,
      metadata
    )
    SELECT
      intent_id,
      (m->>'entity_type')::text,
      (m->>'entity_id')::uuid,
      (m->>'match_score')::numeric,
      (m->'metadata')::jsonb
    FROM unnest(v_matches) AS m;
  END IF;

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.apply_intent_real_estate(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.apply_intent_real_estate IS
'Apply real estate agent intents: search properties, create listings, schedule viewings, match tenants';

COMMIT;
