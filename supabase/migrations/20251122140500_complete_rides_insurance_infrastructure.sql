-- =====================================================================
-- COMPLETE RIDES & INSURANCE INFRASTRUCTURE
-- =====================================================================
-- Migration: Complete infrastructure for Rides and Insurance AI agents
-- Adds missing tables, RPC functions for agent logic, and indexes
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. INSURANCE DOMAIN TABLES (MISSING)
-- =====================================================================

-- Insurance profiles (per user and per vehicle)
CREATE TABLE IF NOT EXISTS public.insurance_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  vehicle_identifier text,
  vehicle_metadata jsonb,
  owner_name text,
  owner_id_number text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_profiles_user_id 
  ON public.insurance_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_profiles_vehicle 
  ON public.insurance_profiles(vehicle_identifier) 
  WHERE vehicle_identifier IS NOT NULL;

-- Insurance documents
CREATE TABLE IF NOT EXISTS public.insurance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.insurance_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
  document_type text,
  file_url text,
  wa_message_id text,
  metadata jsonb,
  uploaded_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_documents_profile_id 
  ON public.insurance_documents(profile_id);
CREATE INDEX IF NOT EXISTS idx_insurance_documents_type 
  ON public.insurance_documents(document_type);

-- Insurance quote requests
CREATE TABLE IF NOT EXISTS public.insurance_quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.insurance_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  intent_id uuid REFERENCES public.ai_agent_intents(id) ON UPDATE CASCADE ON DELETE SET NULL,
  request_type text,
  status text DEFAULT 'pending',
  requested_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  quote_details jsonb,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_quote_requests_profile_id 
  ON public.insurance_quote_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_insurance_quote_requests_status 
  ON public.insurance_quote_requests(status) 
  WHERE status IN ('pending', 'in_review');
CREATE INDEX IF NOT EXISTS idx_insurance_quote_requests_intent_id 
  ON public.insurance_quote_requests(intent_id) 
  WHERE intent_id IS NOT NULL;

-- =====================================================================
-- 2. ENHANCED INDEXES FOR EXISTING TABLES
-- =====================================================================

-- Rides tables indexes
CREATE INDEX IF NOT EXISTS idx_rides_trips_rider 
  ON public.rides_trips(rider_user_id);
CREATE INDEX IF NOT EXISTS idx_rides_trips_driver 
  ON public.rides_trips(driver_user_id) 
  WHERE driver_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rides_trips_status 
  ON public.rides_trips(status, scheduled_at) 
  WHERE status IN ('pending', 'matched');
CREATE INDEX IF NOT EXISTS idx_rides_trips_scheduled 
  ON public.rides_trips(scheduled_at) 
  WHERE scheduled_at IS NOT NULL AND status = 'pending';

CREATE INDEX IF NOT EXISTS idx_rides_driver_status_online 
  ON public.rides_driver_status(is_online, last_seen_at) 
  WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_rides_driver_status_user 
  ON public.rides_driver_status(user_id);

CREATE INDEX IF NOT EXISTS idx_rides_saved_locations_user 
  ON public.rides_saved_locations(user_id);

-- WhatsApp tables indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_user_agent 
  ON public.whatsapp_conversations(user_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_status 
  ON public.whatsapp_conversations(status, last_message_at) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation 
  ON public.whatsapp_messages(conversation_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction 
  ON public.whatsapp_messages(conversation_id, direction);

CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_conversation 
  ON public.ai_agent_intents(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_status_type 
  ON public.ai_agent_intents(status, intent_type) 
  WHERE status = 'pending';

-- =====================================================================
-- 3. RPC FUNCTIONS FOR RIDES AGENT LOGIC
-- =====================================================================

-- Function: Search for nearby drivers
CREATE OR REPLACE FUNCTION public.rides_search_nearby_drivers(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision DEFAULT 10,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  user_id uuid,
  distance_km double precision,
  current_lat double precision,
  current_lng double precision,
  last_seen_at timestamptz,
  metadata jsonb
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ds.user_id,
    -- Haversine distance approximation
    (
      6371 * acos(
        cos(radians(p_lat)) * cos(radians(ds.current_lat)) *
        cos(radians(ds.current_lng) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(ds.current_lat))
      )
    ) AS distance_km,
    ds.current_lat,
    ds.current_lng,
    ds.last_seen_at,
    ds.metadata
  FROM public.rides_driver_status ds
  WHERE 
    ds.is_online = true
    AND ds.current_lat IS NOT NULL
    AND ds.current_lng IS NOT NULL
    AND ds.last_seen_at > (now() - interval '30 minutes')
    -- Basic bounding box filter for performance
    AND ds.current_lat BETWEEN (p_lat - (p_radius_km / 111.0)) AND (p_lat + (p_radius_km / 111.0))
    AND ds.current_lng BETWEEN (p_lng - (p_radius_km / (111.0 * cos(radians(p_lat))))) 
                           AND (p_lng + (p_radius_km / (111.0 * cos(radians(p_lat)))))
  ORDER BY distance_km ASC
  LIMIT p_limit;
END;
$$;

-- Function: Search for nearby passengers (for drivers looking for riders)
CREATE OR REPLACE FUNCTION public.rides_search_nearby_passengers(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision DEFAULT 10,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  trip_id uuid,
  rider_user_id uuid,
  distance_km double precision,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_address text,
  scheduled_at timestamptz,
  metadata jsonb
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.rider_user_id,
    (
      6371 * acos(
        cos(radians(p_lat)) * cos(radians(t.pickup_lat)) *
        cos(radians(t.pickup_lng) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(t.pickup_lat))
      )
    ) AS distance_km,
    t.pickup_lat,
    t.pickup_lng,
    t.dropoff_address,
    t.scheduled_at,
    t.metadata
  FROM public.rides_trips t
  WHERE 
    t.status = 'pending'
    AND t.driver_user_id IS NULL
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
    -- Basic bounding box filter
    AND t.pickup_lat BETWEEN (p_lat - (p_radius_km / 111.0)) AND (p_lat + (p_radius_km / 111.0))
    AND t.pickup_lng BETWEEN (p_lng - (p_radius_km / (111.0 * cos(radians(p_lat))))) 
                         AND (p_lng + (p_radius_km / (111.0 * cos(radians(p_lat)))))
  ORDER BY distance_km ASC
  LIMIT p_limit;
END;
$$;

-- Function: Update driver location
CREATE OR REPLACE FUNCTION public.rides_update_driver_location(
  p_user_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_is_online boolean DEFAULT true,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_status_id uuid;
BEGIN
  INSERT INTO public.rides_driver_status (
    user_id,
    is_online,
    current_lat,
    current_lng,
    last_seen_at,
    metadata
  ) VALUES (
    p_user_id,
    p_is_online,
    p_lat,
    p_lng,
    now(),
    p_metadata
  )
  ON CONFLICT (user_id) DO UPDATE SET
    is_online = EXCLUDED.is_online,
    current_lat = EXCLUDED.current_lat,
    current_lng = EXCLUDED.current_lng,
    last_seen_at = EXCLUDED.last_seen_at,
    metadata = COALESCE(EXCLUDED.metadata, rides_driver_status.metadata),
    updated_at = now()
  RETURNING id INTO v_status_id;
  
  RETURN v_status_id;
END;
$$;

-- Add unique constraint for driver status if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rides_driver_status_user_id_key'
  ) THEN
    ALTER TABLE public.rides_driver_status 
      ADD CONSTRAINT rides_driver_status_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- =====================================================================
-- 4. RPC FUNCTIONS FOR INSURANCE AGENT LOGIC
-- =====================================================================

-- Function: Upsert insurance profile
CREATE OR REPLACE FUNCTION public.insurance_upsert_profile(
  p_user_id uuid,
  p_vehicle_identifier text DEFAULT NULL,
  p_vehicle_metadata jsonb DEFAULT NULL,
  p_owner_name text DEFAULT NULL,
  p_owner_id_number text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  INSERT INTO public.insurance_profiles (
    user_id,
    vehicle_identifier,
    vehicle_metadata,
    owner_name,
    owner_id_number,
    metadata
  ) VALUES (
    p_user_id,
    p_vehicle_identifier,
    p_vehicle_metadata,
    p_owner_name,
    p_owner_id_number,
    p_metadata
  )
  ON CONFLICT (user_id, COALESCE(vehicle_identifier, ''))
  WHERE vehicle_identifier IS NOT NULL
  DO UPDATE SET
    vehicle_metadata = COALESCE(EXCLUDED.vehicle_metadata, insurance_profiles.vehicle_metadata),
    owner_name = COALESCE(EXCLUDED.owner_name, insurance_profiles.owner_name),
    owner_id_number = COALESCE(EXCLUDED.owner_id_number, insurance_profiles.owner_id_number),
    metadata = COALESCE(EXCLUDED.metadata, insurance_profiles.metadata),
    updated_at = now()
  RETURNING id INTO v_profile_id;
  
  RETURN v_profile_id;
END;
$$;

-- Function: Store insurance document
CREATE OR REPLACE FUNCTION public.insurance_store_document(
  p_profile_id uuid,
  p_document_type text,
  p_file_url text,
  p_wa_message_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_document_id uuid;
BEGIN
  INSERT INTO public.insurance_documents (
    profile_id,
    document_type,
    file_url,
    wa_message_id,
    metadata
  ) VALUES (
    p_profile_id,
    p_document_type,
    p_file_url,
    p_wa_message_id,
    p_metadata
  )
  RETURNING id INTO v_document_id;
  
  RETURN v_document_id;
END;
$$;

-- Function: Create insurance quote request
CREATE OR REPLACE FUNCTION public.insurance_create_quote_request(
  p_profile_id uuid,
  p_agent_id uuid,
  p_intent_id uuid DEFAULT NULL,
  p_request_type text DEFAULT 'new',
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_request_id uuid;
BEGIN
  INSERT INTO public.insurance_quote_requests (
    profile_id,
    agent_id,
    intent_id,
    request_type,
    status,
    metadata
  ) VALUES (
    p_profile_id,
    p_agent_id,
    p_intent_id,
    p_request_type,
    'pending',
    p_metadata
  )
  RETURNING id INTO v_request_id;
  
  RETURN v_request_id;
END;
$$;

-- Function: List user's insurance policies/requests
CREATE OR REPLACE FUNCTION public.insurance_list_user_requests(
  p_user_id uuid,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  request_id uuid,
  profile_id uuid,
  vehicle_identifier text,
  request_type text,
  status text,
  requested_at timestamptz,
  quote_details jsonb
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qr.id AS request_id,
    qr.profile_id,
    ip.vehicle_identifier,
    qr.request_type,
    qr.status,
    qr.requested_at,
    qr.quote_details
  FROM public.insurance_quote_requests qr
  JOIN public.insurance_profiles ip ON ip.id = qr.profile_id
  WHERE ip.user_id = p_user_id
  ORDER BY qr.requested_at DESC
  LIMIT p_limit;
END;
$$;

-- =====================================================================
-- 5. GENERIC APPLY INTENT FUNCTIONS
-- =====================================================================

-- Function: Apply Rides intent (create trip, update status, etc.)
CREATE OR REPLACE FUNCTION public.apply_intent_rides(
  p_intent_id uuid
)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_intent record;
  v_result jsonb;
  v_trip_id uuid;
  v_payload jsonb;
BEGIN
  -- Get the intent
  SELECT * INTO v_intent
  FROM public.ai_agent_intents
  WHERE id = p_intent_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Intent not found');
  END IF;
  
  v_payload := v_intent.structured_payload;
  
  -- Handle different intent types
  CASE v_intent.intent_type
    WHEN 'create_ride_request' THEN
      -- Create a new trip
      INSERT INTO public.rides_trips (
        rider_user_id,
        pickup_address,
        pickup_lat,
        pickup_lng,
        dropoff_address,
        dropoff_lat,
        dropoff_lng,
        scheduled_at,
        metadata
      ) VALUES (
        (SELECT user_id FROM public.whatsapp_conversations WHERE id = v_intent.conversation_id),
        v_payload->>'pickup_address',
        (v_payload->>'pickup_lat')::double precision,
        (v_payload->>'pickup_lng')::double precision,
        v_payload->>'dropoff_address',
        (v_payload->>'dropoff_lat')::double precision,
        (v_payload->>'dropoff_lng')::double precision,
        (v_payload->>'scheduled_at')::timestamptz,
        v_payload->'metadata'
      )
      RETURNING id INTO v_trip_id;
      
      v_result := jsonb_build_object(
        'success', true,
        'trip_id', v_trip_id,
        'action', 'trip_created'
      );
      
    WHEN 'update_driver_location' THEN
      -- Update driver location
      PERFORM public.rides_update_driver_location(
        (SELECT user_id FROM public.whatsapp_conversations WHERE id = v_intent.conversation_id),
        (v_payload->>'lat')::double precision,
        (v_payload->>'lng')::double precision,
        COALESCE((v_payload->>'is_online')::boolean, true),
        v_payload->'metadata'
      );
      
      v_result := jsonb_build_object(
        'success', true,
        'action', 'location_updated'
      );
      
    WHEN 'cancel_trip' THEN
      -- Cancel trip
      UPDATE public.rides_trips
      SET 
        status = 'cancelled',
        updated_at = now()
      WHERE id = (v_payload->>'trip_id')::uuid
      RETURNING id INTO v_trip_id;
      
      v_result := jsonb_build_object(
        'success', true,
        'trip_id', v_trip_id,
        'action', 'trip_cancelled'
      );
      
    ELSE
      v_result := jsonb_build_object(
        'success', false,
        'error', 'Unknown intent type: ' || v_intent.intent_type
      );
  END CASE;
  
  -- Mark intent as applied
  UPDATE public.ai_agent_intents
  SET 
    status = 'applied',
    applied_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || v_result
  WHERE id = p_intent_id;
  
  RETURN v_result;
END;
$$;

-- Function: Apply Insurance intent
CREATE OR REPLACE FUNCTION public.apply_intent_insurance(
  p_intent_id uuid
)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_intent record;
  v_result jsonb;
  v_profile_id uuid;
  v_document_id uuid;
  v_request_id uuid;
  v_payload jsonb;
  v_user_id uuid;
BEGIN
  -- Get the intent
  SELECT i.*, c.user_id INTO v_intent
  FROM public.ai_agent_intents i
  JOIN public.whatsapp_conversations c ON c.id = i.conversation_id
  WHERE i.id = p_intent_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Intent not found');
  END IF;
  
  v_payload := v_intent.structured_payload;
  v_user_id := v_intent.user_id;
  
  -- Handle different intent types
  CASE v_intent.intent_type
    WHEN 'create_insurance_profile' THEN
      -- Create or update profile
      v_profile_id := public.insurance_upsert_profile(
        v_user_id,
        v_payload->>'vehicle_identifier',
        v_payload->'vehicle_metadata',
        v_payload->>'owner_name',
        v_payload->>'owner_id_number',
        v_payload->'metadata'
      );
      
      v_result := jsonb_build_object(
        'success', true,
        'profile_id', v_profile_id,
        'action', 'profile_created'
      );
      
    WHEN 'submit_insurance_document' THEN
      -- Store document
      v_document_id := public.insurance_store_document(
        (v_payload->>'profile_id')::uuid,
        v_payload->>'document_type',
        v_payload->>'file_url',
        v_payload->>'wa_message_id',
        v_payload->'metadata'
      );
      
      v_result := jsonb_build_object(
        'success', true,
        'document_id', v_document_id,
        'action', 'document_stored'
      );
      
    WHEN 'request_insurance_quote' THEN
      -- Create quote request
      v_request_id := public.insurance_create_quote_request(
        (v_payload->>'profile_id')::uuid,
        v_intent.agent_id,
        p_intent_id,
        COALESCE(v_payload->>'request_type', 'new'),
        v_payload->'metadata'
      );
      
      v_result := jsonb_build_object(
        'success', true,
        'request_id', v_request_id,
        'action', 'quote_requested'
      );
      
    ELSE
      v_result := jsonb_build_object(
        'success', false,
        'error', 'Unknown intent type: ' || v_intent.intent_type
      );
  END CASE;
  
  -- Mark intent as applied
  UPDATE public.ai_agent_intents
  SET 
    status = 'applied',
    applied_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || v_result
  WHERE id = p_intent_id;
  
  RETURN v_result;
END;
$$;

-- =====================================================================
-- 6. COMMENTS
-- =====================================================================

COMMENT ON TABLE public.insurance_profiles IS 'Insurance profiles linking users to vehicles with owner details';
COMMENT ON TABLE public.insurance_documents IS 'Uploaded insurance documents (certificates, carte jaune, etc.)';
COMMENT ON TABLE public.insurance_quote_requests IS 'Insurance quote/renewal requests submitted by users via WhatsApp';

COMMENT ON FUNCTION public.rides_search_nearby_drivers IS 'Find online drivers within radius using Haversine distance';
COMMENT ON FUNCTION public.rides_search_nearby_passengers IS 'Find pending trip requests within radius for drivers';
COMMENT ON FUNCTION public.rides_update_driver_location IS 'Upsert driver location and online status';
COMMENT ON FUNCTION public.insurance_upsert_profile IS 'Create or update insurance profile for user/vehicle';
COMMENT ON FUNCTION public.apply_intent_rides IS 'Process Rides agent intents and create/update trips';
COMMENT ON FUNCTION public.apply_intent_insurance IS 'Process Insurance agent intents and create quotes/profiles';

COMMIT;
