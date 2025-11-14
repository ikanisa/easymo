BEGIN;

-- Migration: Add essential missing functions
-- Date: 2025-11-12
-- Description: Implement core business logic functions for wallet, trips, and user management

-- Function: Handle new user creation (onboarding)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile for new user
  INSERT INTO public.profiles (user_id, created_at, updated_at)
  VALUES (NEW.id::TEXT, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Log user creation event
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    NEW.id::TEXT,
    'user.created',
    'user',
    NEW.id::TEXT,
    jsonb_build_object(
      'email', NEW.email,
      'phone', NEW.phone
    ),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: Get user wallet balance
CREATE OR REPLACE FUNCTION public.get_user_wallet(p_user_id TEXT)
RETURNS TABLE (
  wallet_id UUID,
  balance NUMERIC,
  currency TEXT,
  status TEXT,
  last_transaction_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id,
    w.balance,
    w.currency,
    w.status,
    (
      SELECT MAX(wt.created_at)
      FROM public.wallet_transactions wt
      WHERE wt.wallet_id = w.id
    ) as last_transaction_at
  FROM public.wallet_accounts w
  WHERE w.user_id = p_user_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update wallet balance with transaction recording
CREATE OR REPLACE FUNCTION public.update_wallet_balance(
  p_user_id TEXT,
  p_amount NUMERIC,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_wallet_id UUID;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Get or create wallet
  SELECT id INTO v_wallet_id
  FROM public.wallet_accounts
  WHERE user_id = p_user_id
  LIMIT 1;
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallet_accounts (user_id, balance, currency, status, created_at, updated_at)
    VALUES (p_user_id, 0, 'RWF', 'active', NOW(), NOW())
    RETURNING id INTO v_wallet_id;
  END IF;
  
  -- Update balance atomically
  UPDATE public.wallet_accounts
  SET 
    balance = balance + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_new_balance;
  
  -- Record transaction
  INSERT INTO public.wallet_transactions (
    wallet_id,
    amount,
    transaction_type,
    status,
    description,
    reference,
    metadata,
    created_at
  ) VALUES (
    v_wallet_id,
    p_amount,
    p_transaction_type,
    'completed',
    p_description,
    p_reference,
    p_metadata,
    NOW()
  ) RETURNING id INTO v_transaction_id;
  
  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet_id,
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance,
    'amount', p_amount
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Record trip with full details
CREATE OR REPLACE FUNCTION public.record_trip(
  p_creator_user_id TEXT,
  p_pickup_lat DOUBLE PRECISION,
  p_pickup_lng DOUBLE PRECISION,
  p_dropoff_lat DOUBLE PRECISION,
  p_dropoff_lng DOUBLE PRECISION,
  p_pickup_address TEXT DEFAULT NULL,
  p_dropoff_address TEXT DEFAULT NULL,
  p_vehicle_type TEXT DEFAULT 'Moto',
  p_fare_amount NUMERIC DEFAULT NULL,
  p_distance_km NUMERIC DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
  v_trip_id UUID;
  v_pickup_point GEOGRAPHY;
  v_dropoff_point GEOGRAPHY;
BEGIN
  -- Create geography points
  v_pickup_point := ST_SetSRID(ST_MakePoint(p_pickup_lng, p_pickup_lat), 4326)::GEOGRAPHY;
  v_dropoff_point := ST_SetSRID(ST_MakePoint(p_dropoff_lng, p_dropoff_lat), 4326)::GEOGRAPHY;
  
  -- Insert trip
  INSERT INTO public.trips (
    creator_user_id,
    pickup_location,
    dropoff_location,
    pickup_address,
    dropoff_address,
    vehicle_type,
    fare_amount,
    distance_km,
    status,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    p_creator_user_id,
    v_pickup_point,
    v_dropoff_point,
    p_pickup_address,
    p_dropoff_address,
    p_vehicle_type,
    p_fare_amount,
    p_distance_km,
    'pending',
    p_metadata,
    NOW(),
    NOW()
  ) RETURNING id INTO v_trip_id;
  
  -- Record metric
  PERFORM public.record_metric('trip.created', 1, jsonb_build_object(
    'vehicle_type', p_vehicle_type,
    'user_id', p_creator_user_id
  ));
  
  RETURN v_trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Match drivers to trip request
CREATE OR REPLACE FUNCTION public.match_drivers(
  p_pickup_lat DOUBLE PRECISION,
  p_pickup_lng DOUBLE PRECISION,
  p_vehicle_type TEXT DEFAULT 'Moto',
  p_radius_km DOUBLE PRECISION DEFAULT 5.0,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  driver_user_id TEXT,
  driver_name TEXT,
  vehicle_type TEXT,
  rating NUMERIC,
  distance_km DOUBLE PRECISION,
  is_available BOOLEAN
) AS $$
DECLARE
  v_pickup_point GEOGRAPHY;
BEGIN
  v_pickup_point := ST_SetSRID(ST_MakePoint(p_pickup_lng, p_pickup_lat), 4326)::GEOGRAPHY;
  
  RETURN QUERY
  SELECT 
    ds.user_id,
    COALESCE(p.display_name, p.name) as driver_name,
    ds.vehicle_type,
    COALESCE(ds.rating, 0) as rating,
    ST_Distance(ds.current_location::GEOGRAPHY, v_pickup_point) / 1000.0 as distance_km,
    ds.is_available
  FROM public.driver_status ds
  JOIN public.profiles p ON p.user_id = ds.user_id
  WHERE 
    ds.is_available = true
    AND ds.is_online = true
    AND (p_vehicle_type IS NULL OR ds.vehicle_type = p_vehicle_type)
    AND ST_DWithin(
      ds.current_location::GEOGRAPHY,
      v_pickup_point,
      p_radius_km * 1000
    )
  ORDER BY 
    distance_km ASC,
    rating DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_wallet(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_wallet_balance(TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_trip(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_drivers(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, DOUBLE PRECISION, INTEGER) TO authenticated, service_role;

COMMIT;
