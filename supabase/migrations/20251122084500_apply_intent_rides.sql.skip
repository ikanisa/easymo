-- =====================================================================
-- APPLY INTENT: RIDES AGENT (ENHANCED)
-- =====================================================================
-- Domain-specific intent application for Rides Agent
-- Called by agent framework after intent is parsed
--
-- FEATURES:
-- - Search for available drivers
-- - Search for passengers (driver mode)
-- - Create trips with pickup/dropoff
-- - Use saved locations (Home, Work, etc.)
-- - Update driver status (online/offline)
-- - View trip history
-- - Match riders with drivers
--
-- INTENT TYPES SUPPORTED:
-- - find_ride, book_ride: Find driver for passenger
-- - find_passenger, go_online: Find passengers for driver
-- - save_location: Save favorite address
-- - view_trips, trip_history: View past trips
-- - driver_online, driver_offline: Update driver availability
-- - cancel_trip: Cancel pending trip
--
-- Updated: 2025-11-22 (Phase 3 - Rides Agent)
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_intent_rides(
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
    
    -- FIND RIDE (Passenger requests ride)
    WHEN 'find_ride', 'book_ride', 'need_ride' THEN
      DECLARE
        v_pickup_text text;
        v_dropoff_text text;
        v_pickup_location_id uuid;
        v_dropoff_location_id uuid;
        v_pickup_lat double precision;
        v_pickup_lng double precision;
        v_dropoff_lat double precision;
        v_dropoff_lng double precision;
        v_trip_id uuid;
        v_available_drivers jsonb;
      BEGIN
        v_pickup_text := payload->>'pickup';
        v_dropoff_text := payload->>'dropoff';
        v_pickup_location_id := (payload->>'pickup_location_id')::uuid;
        v_dropoff_location_id := (payload->>'dropoff_location_id')::uuid;
        
        -- Try to use saved locations if provided
        IF v_pickup_location_id IS NOT NULL THEN
          SELECT address_text, lat, lng
          INTO v_pickup_text, v_pickup_lat, v_pickup_lng
          FROM rides_saved_locations
          WHERE id = v_pickup_location_id AND user_id = v_user_id;
        END IF;
        
        IF v_dropoff_location_id IS NOT NULL THEN
          SELECT address_text, lat, lng
          INTO v_dropoff_text, v_dropoff_lat, v_dropoff_lng
          FROM rides_saved_locations
          WHERE id = v_dropoff_location_id AND user_id = v_user_id;
        END IF;
        
        -- Create trip
        IF v_pickup_text IS NOT NULL AND v_dropoff_text IS NOT NULL THEN
          INSERT INTO rides_trips (
            rider_user_id, pickup_address, pickup_lat, pickup_lng,
            dropoff_address, dropoff_lat, dropoff_lng,
            status, metadata
          )
          VALUES (
            v_user_id, v_pickup_text, v_pickup_lat, v_pickup_lng,
            v_dropoff_text, v_dropoff_lat, v_dropoff_lng,
            'pending',
            jsonb_build_object('source', 'whatsapp_agent')
          )
          RETURNING id INTO v_trip_id;
          
          -- Find available drivers (simplified - production would use geo queries)
          SELECT jsonb_agg(
            jsonb_build_object(
              'user_id', ds.user_id,
              'phone', wu.phone_number,
              'last_seen', ds.last_seen_at
            )
          )
          INTO v_available_drivers
          FROM rides_driver_status ds
          JOIN whatsapp_users wu ON wu.id = ds.user_id
          WHERE ds.is_online = true
          LIMIT 5;
          
          v_next_action := format('Trip created! Found %s drivers nearby. Sending match requests.',
            COALESCE(jsonb_array_length(v_available_drivers), 0));
          
          v_updated_entities := ARRAY[
            jsonb_build_object(
              'type', 'trip',
              'id', v_trip_id::text,
              'action', 'created',
              'pickup', v_pickup_text,
              'dropoff', v_dropoff_text,
              'available_drivers', v_available_drivers
            )
          ];
          
          -- Create matches
          IF v_available_drivers IS NOT NULL THEN
            v_matches := ARRAY[
              jsonb_build_object(
                'type', 'ride_request',
                'trip_id', v_trip_id::text,
                'drivers', v_available_drivers
              )
            ];
          END IF;
        ELSE
          v_next_action := 'Need pickup and dropoff. Ask for locations or suggest saved ones.';
        END IF;
      END;
    
    -- FIND PASSENGER (Driver looking for rides)
    WHEN 'find_passenger', 'go_online', 'start_driving' THEN
      DECLARE
        v_driver_status_id uuid;
        v_current_lat double precision;
        v_current_lng double precision;
        v_available_trips jsonb;
      BEGIN
        v_current_lat := (payload->>'lat')::double precision;
        v_current_lng := (payload->>'lng')::double precision;
        
        -- Update/create driver status
        INSERT INTO rides_driver_status (user_id, is_online, current_lat, current_lng, last_seen_at)
        VALUES (v_user_id, true, v_current_lat, v_current_lng, now())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          is_online = true,
          current_lat = COALESCE(EXCLUDED.current_lat, rides_driver_status.current_lat),
          current_lng = COALESCE(EXCLUDED.current_lng, rides_driver_status.current_lng),
          last_seen_at = now()
        RETURNING id INTO v_driver_status_id;
        
        -- Find pending trips
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'pickup', t.pickup_address,
            'dropoff', t.dropoff_address,
            'scheduled_at', t.scheduled_at,
            'price_estimate', t.price_estimate
          )
        )
        INTO v_available_trips
        FROM rides_trips t
        WHERE t.status = 'pending'
          AND t.driver_user_id IS NULL
        ORDER BY t.created_at DESC
        LIMIT 5;
        
        IF v_available_trips IS NOT NULL AND jsonb_array_length(v_available_trips) > 0 THEN
          v_next_action := format('You''re online! Found %s ride requests nearby.',
            jsonb_array_length(v_available_trips));
        ELSE
          v_next_action := 'You''re online! No ride requests yet. We''ll notify you when someone needs a ride.';
        END IF;
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'driver_status',
            'action', 'online',
            'trips', v_available_trips
          )
        ];
      END;
    
    -- SAVE LOCATION
    WHEN 'save_location', 'add_location' THEN
      DECLARE
        v_label text;
        v_address text;
        v_lat double precision;
        v_lng double precision;
        v_location_id uuid;
      BEGIN
        v_label := payload->>'label';
        v_address := payload->>'address';
        v_lat := (payload->>'lat')::double precision;
        v_lng := (payload->>'lng')::double precision;
        
        IF v_label IS NOT NULL AND v_address IS NOT NULL THEN
          INSERT INTO rides_saved_locations (user_id, label, address_text, lat, lng)
          VALUES (v_user_id, v_label, v_address, v_lat, v_lng)
          RETURNING id INTO v_location_id;
          
          v_next_action := format('"%s" saved! Next time just say "Take me to %s"',
            v_label, v_label);
          
          v_updated_entities := ARRAY[
            jsonb_build_object(
              'type', 'saved_location',
              'id', v_location_id::text,
              'label', v_label,
              'action', 'created'
            )
          ];
        ELSE
          v_next_action := 'Need a name and address to save location.';
        END IF;
      END;
    
    -- VIEW TRIPS / HISTORY
    WHEN 'view_trips', 'trip_history', 'my_trips' THEN
      DECLARE
        v_trips jsonb;
      BEGIN
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'pickup', t.pickup_address,
            'dropoff', t.dropoff_address,
            'status', t.status,
            'price', t.price_estimate,
            'created_at', t.created_at,
            'completed_at', t.completed_at
          )
        )
        INTO v_trips
        FROM rides_trips t
        WHERE t.rider_user_id = v_user_id OR t.driver_user_id = v_user_id
        ORDER BY t.created_at DESC
        LIMIT 10;
        
        v_next_action := 'Show trip history with emoji numbers';
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'trip_history',
            'action', 'viewed',
            'trips', v_trips
          )
        ];
      END;
    
    -- DRIVER OFFLINE
    WHEN 'driver_offline', 'go_offline', 'stop_driving' THEN
      BEGIN
        UPDATE rides_driver_status
        SET is_online = false, last_seen_at = now()
        WHERE user_id = v_user_id;
        
        v_next_action := 'You''re offline. See you later!';
      END;
    
    -- CANCEL TRIP
    WHEN 'cancel_trip' THEN
      DECLARE
        v_trip_id uuid;
      BEGIN
        v_trip_id := (payload->>'trip_id')::uuid;
        
        IF v_trip_id IS NOT NULL THEN
          UPDATE rides_trips
          SET status = 'cancelled', updated_at = now()
          WHERE id = v_trip_id
            AND (rider_user_id = v_user_id OR driver_user_id = v_user_id)
            AND status IN ('pending', 'matched');
          
          IF FOUND THEN
            v_next_action := 'Trip cancelled.';
          ELSE
            v_next_action := 'Could not cancel trip (already started or completed).';
          END IF;
        END IF;
      END;
    
    -- GENERAL INQUIRY
    WHEN 'general_inquiry', 'help' THEN
      v_next_action := 'Provide help about rides, drivers, saved locations';
    
    -- UNKNOWN INTENT
    ELSE
      v_next_action := 'Ask clarifying question or show ride options';
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

COMMENT ON FUNCTION public.apply_intent_rides IS
'Applies Rides Agent intents to domain tables (trips, drivers, saved locations)';

COMMIT;

-- =====================================================================
-- EXAMPLE USAGE
-- =====================================================================
/*
-- Test: Passenger finding ride
SELECT apply_intent_rides(
  'some-intent-uuid'::uuid,
  '{"pickup": "Kigali Heights", "dropoff": "Airport"}'::jsonb
);

-- Test: Driver going online
SELECT apply_intent_rides(
  'some-intent-uuid'::uuid,
  '{"lat": -1.9403, "lng": 29.8739}'::jsonb
);

-- Test: Save favorite location
SELECT apply_intent_rides(
  'some-intent-uuid'::uuid,
  '{"label": "Home", "address": "Kimironko, Kigali", "lat": -1.9500, "lng": 30.1200}'::jsonb
);
*/
