-- =====================================================================
-- APPLY INTENT: FARMER AGENT
-- =====================================================================
-- Domain-specific intent application for Farmer Agent
-- Called by agent framework after intent is parsed
--
-- FEATURES:
-- - Create/list produce listings
-- - Match farmers with buyers
-- - Manage farm profiles
-- - Search produce by category/location
-- - Handle buyer inquiries
-- - Track harvest schedules
--
-- INTENT TYPES SUPPORTED:
-- - create_listing, list_produce: Create new produce listing
-- - find_buyers, search_buyers: Find buyers for produce
-- - view_listings, my_listings: View farmer's listings
-- - search_produce, find_produce: Search for produce to buy
-- - update_listing: Update existing listing
-- - create_farm, register_farm: Register a farm
-- - general_inquiry, help: Show help information
--
-- Created: 2025-11-22 (Agent Refactor - Phase 1)
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_intent_farmer(
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
    
    -- CREATE PRODUCE LISTING
    WHEN 'create_listing', 'list_produce' THEN
      DECLARE
        v_listing_id uuid;
        v_produce_slug text;
        v_quantity numeric;
        v_unit text;
        v_price_per_unit numeric;
        v_currency text;
        v_available_from date;
        v_location_text text;
      BEGIN
        v_produce_slug := payload->>'produce_slug';
        v_quantity := (payload->>'quantity')::numeric;
        v_unit := COALESCE(payload->>'unit', 'kg');
        v_price_per_unit := (payload->>'price_per_unit')::numeric;
        v_currency := COALESCE(payload->>'currency', 'RWF');
        v_available_from := COALESCE((payload->>'available_from')::date, CURRENT_DATE);
        v_location_text := payload->>'location';
        
        -- Create listing
        INSERT INTO produce_listings (
          seller_id,
          produce_slug,
          quantity,
          unit_type,
          price_per_unit,
          currency,
          available_from,
          location_text,
          status
        )
        VALUES (
          v_user_id,
          v_produce_slug,
          v_quantity,
          v_unit,
          v_price_per_unit,
          v_currency,
          v_available_from,
          v_location_text,
          'active'
        )
        RETURNING id INTO v_listing_id;
        
        v_next_action := format(
          'Listing created! ID: %s. Find buyers matching: %s (%s %s) at %s %s/%s.',
          v_listing_id, v_produce_slug, v_quantity, v_unit, v_price_per_unit, v_currency, v_unit
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'produce_listing',
            'action', 'created',
            'listing_id', v_listing_id,
            'produce', v_produce_slug,
            'quantity', v_quantity,
            'unit', v_unit,
            'price', v_price_per_unit,
            'currency', v_currency
          )
        ];
      END;
    
    -- FIND BUYERS FOR PRODUCE
    WHEN 'find_buyers', 'search_buyers' THEN
      DECLARE
        v_produce_slug text;
        v_buyers_found jsonb;
      BEGIN
        v_produce_slug := payload->>'produce_slug';
        
        -- Find recent buyer inquiries for this produce
        -- (This would typically search buyer_requests or match with buyer profiles)
        SELECT jsonb_agg(
          jsonb_build_object(
            'user_id', wu.id,
            'phone', wu.phone_number,
            'name', wu.profile_name,
            'last_inquiry', wu.updated_at
          )
        )
        INTO v_buyers_found
        FROM whatsapp_users wu
        WHERE wu.id IN (
          SELECT DISTINCT wc.user_id
          FROM whatsapp_conversations wc
          JOIN whatsapp_messages wm ON wm.conversation_id = wc.id
          WHERE wm.body ILIKE '%' || v_produce_slug || '%'
            AND wc.context->>'agent_slug' = 'farmer'
            AND wm.created_at > NOW() - INTERVAL '30 days'
        )
        LIMIT 5;
        
        v_next_action := format(
          'Found %s potential buyers for %s. Show list with contact options.',
          COALESCE(jsonb_array_length(v_buyers_found), 0),
          v_produce_slug
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'buyer_search',
            'action', 'searched',
            'produce', v_produce_slug,
            'buyers_count', COALESCE(jsonb_array_length(v_buyers_found), 0),
            'buyers', v_buyers_found
          )
        ];
      END;
    
    -- VIEW MY LISTINGS
    WHEN 'view_listings', 'my_listings' THEN
      DECLARE
        v_listings jsonb;
      BEGIN
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pl.id,
            'produce', pl.produce_slug,
            'quantity', pl.quantity,
            'unit', pl.unit_type,
            'price', pl.price_per_unit,
            'currency', pl.currency,
            'status', pl.status,
            'available_from', pl.available_from,
            'location', pl.location_text,
            'created_at', pl.created_at
          )
          ORDER BY pl.created_at DESC
        )
        INTO v_listings
        FROM produce_listings pl
        WHERE pl.seller_id = v_user_id
          AND pl.status IN ('active', 'pending')
        LIMIT 10;
        
        v_next_action := format(
          'Showing %s active listings. Display with emoji numbers for editing.',
          COALESCE(jsonb_array_length(v_listings), 0)
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'listing_view',
            'action', 'retrieved',
            'count', COALESCE(jsonb_array_length(v_listings), 0),
            'listings', v_listings
          )
        ];
      END;
    
    -- SEARCH PRODUCE (BUYER LOOKING FOR PRODUCE)
    WHEN 'search_produce', 'find_produce' THEN
      DECLARE
        v_produce_slug text;
        v_location text;
        v_max_price numeric;
        v_produce_found jsonb;
      BEGIN
        v_produce_slug := payload->>'produce_slug';
        v_location := payload->>'location';
        v_max_price := (payload->>'max_price')::numeric;
        
        -- Search active listings
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pl.id,
            'produce', pl.produce_slug,
            'quantity', pl.quantity,
            'unit', pl.unit_type,
            'price', pl.price_per_unit,
            'currency', pl.currency,
            'location', pl.location_text,
            'available_from', pl.available_from,
            'seller_phone', wu.phone_number
          )
          ORDER BY pl.price_per_unit ASC
        )
        INTO v_produce_found
        FROM produce_listings pl
        JOIN whatsapp_users wu ON wu.id = pl.seller_id
        WHERE pl.status = 'active'
          AND (v_produce_slug IS NULL OR pl.produce_slug = v_produce_slug)
          AND (v_location IS NULL OR pl.location_text ILIKE '%' || v_location || '%')
          AND (v_max_price IS NULL OR pl.price_per_unit <= v_max_price)
          AND pl.quantity > 0
        LIMIT 5;
        
        v_next_action := format(
          'Found %s listings for %s. Show with prices and contact farmer options.',
          COALESCE(jsonb_array_length(v_produce_found), 0),
          COALESCE(v_produce_slug, 'produce')
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'produce_search',
            'action', 'searched',
            'produce', v_produce_slug,
            'results_count', COALESCE(jsonb_array_length(v_produce_found), 0),
            'listings', v_produce_found
          )
        ];
        
        -- Create match event for each listing
        FOR i IN 0..COALESCE(jsonb_array_length(v_produce_found), 0) - 1 LOOP
          v_matches := array_append(v_matches,
            jsonb_build_object(
              'entity_type', 'produce_listing',
              'entity_id', v_produce_found->i->>'id',
              'match_score', 0.8,
              'metadata', jsonb_build_object(
                'produce', v_produce_found->i->>'produce',
                'price', v_produce_found->i->>'price'
              )
            )
          );
        END LOOP;
      END;
    
    -- UPDATE LISTING
    WHEN 'update_listing' THEN
      DECLARE
        v_listing_id uuid;
        v_quantity numeric;
        v_price numeric;
        v_status text;
      BEGIN
        v_listing_id := (payload->>'listing_id')::uuid;
        v_quantity := (payload->>'quantity')::numeric;
        v_price := (payload->>'price_per_unit')::numeric;
        v_status := payload->>'status';
        
        -- Update listing (only if user owns it)
        UPDATE produce_listings
        SET
          quantity = COALESCE(v_quantity, quantity),
          price_per_unit = COALESCE(v_price, price_per_unit),
          status = COALESCE(v_status, status),
          updated_at = NOW()
        WHERE id = v_listing_id
          AND seller_id = v_user_id;
        
        v_next_action := format('Listing %s updated successfully.', v_listing_id);
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'produce_listing',
            'action', 'updated',
            'listing_id', v_listing_id
          )
        ];
      END;
    
    -- CREATE/REGISTER FARM
    WHEN 'create_farm', 'register_farm' THEN
      DECLARE
        v_farm_id uuid;
        v_farm_name text;
        v_region text;
        v_acreage numeric;
      BEGIN
        v_farm_name := payload->>'name';
        v_region := payload->>'region';
        v_acreage := (payload->>'acreage')::numeric;
        
        -- Get or create tenant_id from user profile
        DECLARE
          v_tenant_id uuid;
        BEGIN
          SELECT tenant_id INTO v_tenant_id
          FROM profiles
          WHERE user_id = v_user_id;
          
          IF v_tenant_id IS NULL THEN
            v_tenant_id := gen_random_uuid();
          END IF;
          
          -- Create farm
          INSERT INTO farms (
            tenant_id,
            owner_profile_id,
            name,
            slug,
            region,
            acreage
          )
          VALUES (
            v_tenant_id,
            v_user_id,
            v_farm_name,
            lower(regexp_replace(v_farm_name, '[^a-zA-Z0-9]+', '-', 'g')),
            v_region,
            v_acreage
          )
          RETURNING id INTO v_farm_id;
          
          v_next_action := format('Farm "%s" registered with ID: %s', v_farm_name, v_farm_id);
          
          v_updated_entities := ARRAY[
            jsonb_build_object(
              'type', 'farm',
              'action', 'created',
              'farm_id', v_farm_id,
              'name', v_farm_name
            )
          ];
        END;
      END;
    
    -- GENERAL INQUIRY / HELP
    WHEN 'general_inquiry', 'help' THEN
      v_next_action := 'Show Farmer Agent help menu: 1️⃣ List Produce 2️⃣ Find Buyers 3️⃣ My Listings 4️⃣ Search Produce 5️⃣ Register Farm';
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
GRANT EXECUTE ON FUNCTION public.apply_intent_farmer(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.apply_intent_farmer IS
'Apply farmer agent intents: create listings, find buyers, search produce, manage farms';

COMMIT;
