-- =====================================================
-- PHASE 3: BUSINESS LOGIC (Medium-High Risk)
-- Purpose: Business Functions, Security Policies, Feature Tables
-- Duration: ~5-7 minutes
-- Risk: MEDIUM-HIGH - Complex business logic, may affect operations
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 3.1: Essential Business Functions
-- =====================================================

-- Function: Handle new user creation (onboarding)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, created_at, updated_at)
  VALUES (NEW.id::TEXT, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO public.audit_logs (
    user_id, action, resource_type, resource_id, metadata, created_at
  ) VALUES (
    NEW.id::TEXT, 'user.created', 'user', NEW.id::TEXT,
    jsonb_build_object('email', NEW.email, 'phone', NEW.phone),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    w.id, w.balance, w.currency, w.status,
    (SELECT MAX(wt.created_at) FROM public.wallet_transactions wt WHERE wt.wallet_id = w.id) as last_transaction_at
  FROM public.wallet_accounts w
  WHERE w.user_id = p_user_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update wallet balance
CREATE OR REPLACE FUNCTION public.update_wallet_balance(
  p_user_id TEXT, p_amount NUMERIC, p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL, p_reference TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_wallet_id UUID; v_new_balance NUMERIC; v_transaction_id UUID;
BEGIN
  SELECT id INTO v_wallet_id FROM public.wallet_accounts WHERE user_id = p_user_id LIMIT 1;
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallet_accounts (user_id, balance, currency, status, created_at, updated_at)
    VALUES (p_user_id, 0, 'RWF', 'active', NOW(), NOW()) RETURNING id INTO v_wallet_id;
  END IF;
  
  UPDATE public.wallet_accounts SET balance = balance + p_amount, updated_at = NOW()
  WHERE id = v_wallet_id RETURNING balance INTO v_new_balance;
  
  INSERT INTO public.wallet_transactions (wallet_id, amount, transaction_type, status, description, reference, metadata, created_at)
  VALUES (v_wallet_id, p_amount, p_transaction_type, 'completed', p_description, p_reference, p_metadata, NOW())
  RETURNING id INTO v_transaction_id;
  
  RETURN jsonb_build_object('success', true, 'wallet_id', v_wallet_id, 'transaction_id', v_transaction_id, 'new_balance', v_new_balance, 'amount', p_amount);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Record trip
CREATE OR REPLACE FUNCTION public.record_trip(
  p_creator_user_id TEXT, p_pickup_lat DOUBLE PRECISION, p_pickup_lng DOUBLE PRECISION,
  p_dropoff_lat DOUBLE PRECISION, p_dropoff_lng DOUBLE PRECISION,
  p_pickup_address TEXT DEFAULT NULL, p_dropoff_address TEXT DEFAULT NULL,
  p_vehicle_type TEXT DEFAULT 'Moto', p_fare_amount NUMERIC DEFAULT NULL,
  p_distance_km NUMERIC DEFAULT NULL, p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
  v_trip_id UUID; v_pickup_point GEOGRAPHY; v_dropoff_point GEOGRAPHY;
BEGIN
  v_pickup_point := ST_SetSRID(ST_MakePoint(p_pickup_lng, p_pickup_lat), 4326)::GEOGRAPHY;
  v_dropoff_point := ST_SetSRID(ST_MakePoint(p_dropoff_lng, p_dropoff_lat), 4326)::GEOGRAPHY;
  
  INSERT INTO public.trips (creator_user_id, pickup_location, dropoff_location, pickup_address, dropoff_address,
    vehicle_type, fare_amount, distance_km, status, metadata, created_at, updated_at)
  VALUES (p_creator_user_id, v_pickup_point, v_dropoff_point, p_pickup_address, p_dropoff_address,
    p_vehicle_type, p_fare_amount, p_distance_km, 'pending', p_metadata, NOW(), NOW())
  RETURNING id INTO v_trip_id;
  
  PERFORM public.record_metric('trip.created', 1, jsonb_build_object('vehicle_type', p_vehicle_type, 'user_id', p_creator_user_id));
  
  RETURN v_trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Match drivers
CREATE OR REPLACE FUNCTION public.match_drivers(
  p_pickup_lat DOUBLE PRECISION, p_pickup_lng DOUBLE PRECISION,
  p_vehicle_type TEXT DEFAULT 'Moto', p_radius_km DOUBLE PRECISION DEFAULT 5.0, p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (driver_user_id TEXT, driver_name TEXT, vehicle_type TEXT, rating NUMERIC, distance_km DOUBLE PRECISION, is_available BOOLEAN) AS $$
DECLARE v_pickup_point GEOGRAPHY;
BEGIN
  v_pickup_point := ST_SetSRID(ST_MakePoint(p_pickup_lng, p_pickup_lat), 4326)::GEOGRAPHY;
  
  RETURN QUERY
  SELECT ds.user_id, COALESCE(p.display_name, p.name) as driver_name, ds.vehicle_type, 
    COALESCE(ds.rating, 0) as rating, ST_Distance(ds.current_location::GEOGRAPHY, v_pickup_point) / 1000.0 as distance_km, ds.is_available
  FROM public.driver_status ds
  JOIN public.profiles p ON p.user_id = ds.user_id
  WHERE ds.is_available = true AND ds.is_online = true
    AND (p_vehicle_type IS NULL OR ds.vehicle_type = p_vehicle_type)
    AND ST_DWithin(ds.current_location::GEOGRAPHY, v_pickup_point, p_radius_km * 1000)
  ORDER BY distance_km ASC, rating DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_wallet(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_wallet_balance(TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_trip(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_drivers(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, DOUBLE PRECISION, INTEGER) TO authenticated, service_role;

-- =====================================================
-- STEP 3.2: Observability Functions (Ground Rules Compliant)
-- =====================================================

-- Function: Log structured event
CREATE OR REPLACE FUNCTION public.log_structured_event(
  p_event_type TEXT, p_event_data JSONB DEFAULT '{}'::JSONB,
  p_user_id TEXT DEFAULT NULL, p_correlation_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE v_event_id UUID; v_correlation_id TEXT;
BEGIN
  v_correlation_id := COALESCE(p_correlation_id, gen_random_uuid()::TEXT);
  
  INSERT INTO public.event_store (event_type, event_data, user_id, correlation_id, created_at)
  VALUES (p_event_type, p_event_data || jsonb_build_object('timestamp', NOW()::TEXT, 'source', 'database'),
    p_user_id, v_correlation_id, NOW())
  RETURNING id INTO v_event_id;
  
  PERFORM public.record_metric('event.' || p_event_type, 1, jsonb_build_object('correlation_id', v_correlation_id, 'user_id', p_user_id));
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get events by correlation
CREATE OR REPLACE FUNCTION public.get_events_by_correlation(p_correlation_id TEXT, p_limit INTEGER DEFAULT 100)
RETURNS TABLE (id UUID, event_type TEXT, event_data JSONB, user_id TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.event_type, e.event_data, e.user_id, e.created_at
  FROM public.event_store e WHERE e.correlation_id = p_correlation_id ORDER BY e.created_at ASC LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Enhanced audit logging with PII masking
CREATE OR REPLACE FUNCTION public.log_audit_event_enhanced(
  p_user_id TEXT, p_action TEXT, p_resource_type TEXT, p_resource_id TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB, p_correlation_id TEXT DEFAULT NULL, p_mask_pii BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE v_audit_id UUID; v_masked_metadata JSONB;
BEGIN
  IF p_mask_pii THEN
    v_masked_metadata := p_metadata;
    IF v_masked_metadata ? 'phone' THEN v_masked_metadata := v_masked_metadata || jsonb_build_object('phone', '***MASKED***'); END IF;
    IF v_masked_metadata ? 'email' THEN v_masked_metadata := v_masked_metadata || jsonb_build_object('email', '***MASKED***'); END IF;
    IF v_masked_metadata ? 'password' THEN v_masked_metadata := v_masked_metadata || jsonb_build_object('password', '***MASKED***'); END IF;
  ELSE
    v_masked_metadata := p_metadata;
  END IF;
  
  INSERT INTO public.system_audit_logs (user_id, action, resource_type, resource_id, metadata, correlation_id, created_at)
  VALUES (p_user_id, p_action, p_resource_type, p_resource_id,
    v_masked_metadata || jsonb_build_object('timestamp', NOW()::TEXT, 'pii_masked', p_mask_pii),
    COALESCE(p_correlation_id, gen_random_uuid()::TEXT), NOW())
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get audit trail
CREATE OR REPLACE FUNCTION public.get_audit_trail(p_resource_type TEXT, p_resource_id TEXT, p_limit INTEGER DEFAULT 50)
RETURNS TABLE (id UUID, user_id TEXT, action TEXT, metadata JSONB, correlation_id TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.user_id, a.action, a.metadata, a.correlation_id, a.created_at
  FROM public.system_audit_logs a
  WHERE a.resource_type = p_resource_type AND a.resource_id = p_resource_id
  ORDER BY a.created_at DESC LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.log_structured_event(TEXT, JSONB, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_events_by_correlation(TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_audit_event_enhanced(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_audit_trail(TEXT, TEXT, INTEGER) TO authenticated, service_role;

-- =====================================================
-- STEP 3.3: Security Policy Refinements
-- =====================================================

-- Profiles: Restrict to own profile + admin
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
CREATE POLICY "profiles_read_own" ON public.profiles FOR SELECT
  USING (user_id = (auth.jwt() ->> 'sub')::UUID OR public.is_admin() OR auth.role() = 'service_role');

-- Trips: Users can only see their own trips
DROP POLICY IF EXISTS "trips_read_all" ON public.trips;
CREATE POLICY "trips_read_own" ON public.trips FOR SELECT
  USING (creator_user_id = (auth.jwt() ->> 'sub')::UUID OR public.is_admin() OR auth.role() = 'service_role');

-- Orders: Users can only see their own orders
DROP POLICY IF EXISTS "orders_read_all" ON public.orders;
CREATE POLICY "orders_read_own" ON public.orders FOR SELECT
  USING (profile_id = (auth.jwt() ->> 'sub')::UUID OR public.is_admin() OR auth.role() = 'service_role');

-- Driver presence: Service role and own data only
DROP POLICY IF EXISTS "driver_presence_read_all" ON public.driver_presence;
CREATE POLICY "driver_presence_read_limited" ON public.driver_presence FOR SELECT
  USING (user_id = (auth.jwt() ->> 'sub')::UUID OR public.is_admin() OR auth.role() = 'service_role');

-- Subscriptions: Users can only see their own
DROP POLICY IF EXISTS "subscriptions_read_all" ON public.subscriptions;
CREATE POLICY "subscriptions_read_own" ON public.subscriptions FOR SELECT
  USING (user_id = (auth.jwt() ->> 'sub')::UUID OR public.is_admin() OR auth.role() = 'service_role');

-- Order events: Restrict to order owner
DROP POLICY IF EXISTS "order_events_read_all" ON public.order_events;
CREATE POLICY "order_events_read_own" ON public.order_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_events.order_id 
    AND (o.profile_id = (auth.jwt() ->> 'sub')::UUID OR public.is_admin())) OR auth.role() = 'service_role');

-- Campaigns: Admin and service role only
DROP POLICY IF EXISTS "campaigns_read_all" ON public.campaigns;
CREATE POLICY "campaigns_admin_only" ON public.campaigns FOR SELECT
  USING (public.is_admin() OR auth.role() = 'service_role');

-- Campaign targets: Admin and service role only
DROP POLICY IF EXISTS "campaign_targets_read_all" ON public.campaign_targets;
CREATE POLICY "campaign_targets_admin_only" ON public.campaign_targets FOR SELECT
  USING (public.is_admin() OR auth.role() = 'service_role');

-- Add missing wallet policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_earn_actions' AND policyname = 'wallet_earn_actions_service') THEN
    CREATE POLICY "wallet_earn_actions_service" ON public.wallet_earn_actions FOR ALL
      USING (public.is_admin() OR auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_promoters' AND policyname = 'wallet_promoters_service') THEN
    CREATE POLICY "wallet_promoters_service" ON public.wallet_promoters FOR ALL
      USING (public.is_admin() OR auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_redeem_options' AND policyname = 'wallet_redeem_options_read') THEN
    CREATE POLICY "wallet_redeem_options_read" ON public.wallet_redeem_options FOR SELECT
      USING (auth.role() IN ('authenticated', 'service_role'));
  END IF;
END $$;

COMMIT;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Phase 3 Complete: Business Logic & Security';
  RAISE NOTICE '   - Essential business functions deployed';
  RAISE NOTICE '   - Observability functions (Ground Rules compliant)';
  RAISE NOTICE '   - Security policies refined (least privilege)';
  RAISE NOTICE '   - Wallet, trip, and audit functions ready';
END $$;
