-- =====================================================================
-- APPLY INTENT: WAITER AGENT (ENHANCED)
-- =====================================================================
-- Domain-specific intent application for Waiter Agent
-- Called by agent framework after intent is parsed
--
-- FEATURES:
-- - Real bar search with location filtering
-- - Bar details and menu viewing
-- - Order creation with items
-- - Favorite bars management
-- - Order history lookup
-- - Customer phone tracking
--
-- INTENT TYPES SUPPORTED:
-- - search_bars, search: Find bars near user
-- - view_menu, view_bar, bar_details: Show bar information
-- - place_order, order: Create new order
-- - save_favorite, favorite_bar: Save bar to favorites
-- - order_history, my_orders: View past orders
-- - general_inquiry, help: Show help information
--
-- Updated: 2025-11-22 (Phase 2 - 100%)
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_intent_waiter(
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
    
    -- SEARCH FOR BARS
    WHEN 'search_bars', 'search' THEN
      DECLARE
        v_location text;
        v_city_area text;
        v_bars_found jsonb;
      BEGIN
        v_location := payload->>'location';
        v_city_area := payload->>'city_area';
        
        -- Search for active bars (filtered by location if provided)
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', b.id,
            'name', b.name,
            'location', b.location_text,
            'city_area', b.city_area,
            'slug', b.slug
          )
        )
        INTO v_bars_found
        FROM bars b
        WHERE b.is_active = true
          AND (v_city_area IS NULL OR b.city_area ILIKE '%' || v_city_area || '%')
        ORDER BY b.created_at DESC
        LIMIT 5;
        
        IF v_bars_found IS NOT NULL AND jsonb_array_length(v_bars_found) > 0 THEN
          v_next_action := format('Found %s bars. Show list with emoji numbers.', 
            jsonb_array_length(v_bars_found));
        ELSE
          v_next_action := 'No bars found nearby. Ask for different location or suggest popular areas.';
        END IF;
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'bar_search',
            'action', 'searched',
            'location', COALESCE(v_city_area, v_location, 'general'),
            'results_count', COALESCE(jsonb_array_length(v_bars_found), 0),
            'bars', v_bars_found
          )
        ];
      END;
    
    -- VIEW MENU / BAR DETAILS
    WHEN 'view_menu', 'view_bar', 'bar_details' THEN
      DECLARE
        v_bar_id uuid;
        v_bar_slug text;
        v_bar_info jsonb;
      BEGIN
        v_bar_id := (payload->>'bar_id')::uuid;
        v_bar_slug := payload->>'bar_slug';
        
        -- Get bar info
        SELECT jsonb_build_object(
          'id', b.id,
          'name', b.name,
          'location', b.location_text,
          'city_area', b.city_area,
          'momo_code', b.momo_code
        )
        INTO v_bar_info
        FROM bars b
        WHERE (b.id = v_bar_id OR b.slug = v_bar_slug)
          AND b.is_active = true;
        
        IF v_bar_info IS NOT NULL THEN
          v_next_action := 'Show bar details and menu options (order, view menu, get directions)';
          v_updated_entities := ARRAY[
            jsonb_build_object(
              'type', 'bar_view',
              'action', 'viewed',
              'bar', v_bar_info
            )
          ];
        ELSE
          v_next_action := 'Bar not found. Ask user to search again.';
        END IF;
      END;
    
    -- PLACE ORDER
    WHEN 'place_order', 'order' THEN
      DECLARE
        v_bar_id uuid;
        v_items jsonb;
        v_order_id uuid;
        v_order_code text;
        v_total integer;
        v_customer_phone text;
      BEGIN
        v_bar_id := (payload->>'bar_id')::uuid;
        v_items := payload->'items';
        v_total := COALESCE((payload->>'total')::integer, 0);
        
        SELECT phone_number INTO v_customer_phone
        FROM whatsapp_users WHERE id = v_user_id;
        
        IF v_bar_id IS NOT NULL AND v_items IS NOT NULL THEN
          -- Generate order code
          v_order_code := 'ORD-' || to_char(now(), 'YYMMDD') || '-' || 
            lpad(floor(random() * 10000)::text, 4, '0');
          
          -- Create order
          INSERT INTO orders (
            id, bar_id, order_code, status, total_minor, 
            metadata, created_at
          )
          VALUES (
            gen_random_uuid(),
            v_bar_id,
            v_order_code,
            'pending',
            v_total,
            jsonb_build_object(
              'customer_phone', v_customer_phone,
              'items', v_items,
              'source', 'whatsapp_agent'
            ),
            now()
          )
          RETURNING id INTO v_order_id;
          
          -- Create order items
          INSERT INTO order_items (order_id, item_name, qty, price_minor)
          SELECT 
            v_order_id,
            item->>'name',
            COALESCE((item->>'qty')::integer, 1),
            COALESCE((item->>'price')::integer, 0)
          FROM jsonb_array_elements(v_items) item;
          
          v_next_action := format('Order %s created! Show payment QR code and confirmation.', 
            v_order_code);
          v_updated_entities := ARRAY[
            jsonb_build_object(
              'type', 'order',
              'id', v_order_id::text,
              'order_code', v_order_code,
              'action', 'created',
              'total', v_total
            )
          ];
        ELSE
          v_next_action := 'Missing order details. Ask for bar and items.';
        END IF;
      END;
    
    -- GENERAL INQUIRY
    WHEN 'general_inquiry', 'help' THEN
      v_next_action := 'Provide helpful information about bars, menus, ordering';
    
    -- SAVE FAVORITE BAR
    WHEN 'save_favorite', 'favorite_bar' THEN
      DECLARE
        v_bar_id uuid;
      BEGIN
        v_bar_id := (payload->>'bar_id')::uuid;
        
        IF v_bar_id IS NOT NULL THEN
          -- Store in user metadata or create favorites table
          UPDATE whatsapp_users
          SET metadata = COALESCE(metadata, '{}'::jsonb) || 
            jsonb_build_object(
              'favorite_bars', 
              COALESCE(metadata->'favorite_bars', '[]'::jsonb) || 
              jsonb_build_array(v_bar_id::text)
            )
          WHERE id = v_user_id;
          
          v_next_action := 'Bar saved to favorites! You can access it quickly next time.';
        END IF;
      END;
    
    -- VIEW ORDER HISTORY
    WHEN 'order_history', 'my_orders' THEN
      DECLARE
        v_recent_orders jsonb;
      BEGIN
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', o.id,
            'order_code', o.order_code,
            'bar_name', b.name,
            'status', o.status,
            'total', o.total_minor,
            'created_at', o.created_at
          )
        )
        INTO v_recent_orders
        FROM orders o
        JOIN bars b ON b.id = o.bar_id
        WHERE o.metadata->>'customer_phone' = (
          SELECT phone_number FROM whatsapp_users WHERE id = v_user_id
        )
        ORDER BY o.created_at DESC
        LIMIT 5;
        
        v_next_action := 'Show recent order history with status';
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'order_history',
            'action', 'viewed',
            'orders', v_recent_orders
          )
        ];
      END;
    
    -- UNKNOWN INTENT
    ELSE
      v_next_action := 'Ask clarifying question or show main menu options';
  END CASE;

  -- 3. Build result
  v_result := jsonb_build_object(
    'success', true,
    'updated_entities', array_to_json(v_updated_entities),
    'matches', array_to_json(v_matches),
    'next_action', v_next_action
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.apply_intent_waiter IS
'Applies Waiter Agent intents to domain tables (bars, menus, orders, tips)';

COMMIT;

-- =====================================================================
-- EXAMPLE USAGE
-- =====================================================================
/*
-- Test the function
SELECT apply_intent_waiter(
  'some-intent-uuid'::uuid,
  '{"bar_id": "some-bar-uuid", "items": [{"id": "item-1", "qty": 2}]}'::jsonb
);
*/
