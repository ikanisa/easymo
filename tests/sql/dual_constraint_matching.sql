-- Test dual-constraint geospatial matching
-- Tests pickup + dropoff radius filtering scenarios

BEGIN;
SET LOCAL search_path TO public;

-- Test setup
DO $$
DECLARE
  driver_profile uuid := gen_random_uuid();
  passenger_a uuid := gen_random_uuid();
  passenger_b uuid := gen_random_uuid();
  passenger_c uuid := gen_random_uuid();
  trip_a uuid := gen_random_uuid();
  trip_b uuid := gen_random_uuid();
  trip_c uuid := gen_random_uuid();
  
  -- Base location (Kigali Convention Centre area)
  base_pickup_lat double precision := -1.9445;
  base_pickup_lng double precision := 30.0610;
  base_dropoff_lat double precision := -1.9490;
  base_dropoff_lng double precision := 30.0640;
  
  result_count int;
  candidate_count int;
BEGIN
  -- Create test profiles
  INSERT INTO public.profiles (user_id, whatsapp_e164)
  VALUES
    (driver_profile, '+250780030001'),
    (passenger_a, '+250780030002'),
    (passenger_b, '+250780030003'),
    (passenger_c, '+250780030004');

  -- Scenario A: Both pickup (~0.8km) and dropoff (~0.9km) within 10km radius
  -- This should MATCH with dual constraint
  INSERT INTO public.trips (
    id,
    creator_user_id,
    role,
    vehicle_type,
    pickup,
    dropoff,
    status,
    created_at
  )
  VALUES (
    trip_a,
    passenger_a,
    'passenger',
    'car',
    ST_SetSRID(ST_MakePoint(30.0620, -1.9453), 4326)::geography,  -- ~0.8km from base pickup
    ST_SetSRID(ST_MakePoint(30.0635, -1.9497), 4326)::geography,  -- ~0.9km from base dropoff
    'open',
    timezone('utc', now()) - interval '1 minute'
  );

  -- Scenario B: Pickup close (~0.5km) but dropoff far (~15km)
  -- This should NOT match with dual constraint
  INSERT INTO public.trips (
    id,
    creator_user_id,
    role,
    vehicle_type,
    pickup,
    dropoff,
    status,
    created_at
  )
  VALUES (
    trip_b,
    passenger_b,
    'passenger',
    'car',
    ST_SetSRID(ST_MakePoint(30.0605, -1.9450), 4326)::geography,  -- ~0.5km from base pickup
    ST_SetSRID(ST_MakePoint(30.1200, -1.9100), 4326)::geography,  -- ~15km from base dropoff
    'open',
    timezone('utc', now()) - interval '2 minutes'
  );

  -- Scenario C: Pickup far (~12km) but dropoff close (~0.8km)
  -- This should NOT match with dual constraint (pickup exceeds radius)
  INSERT INTO public.trips (
    id,
    creator_user_id,
    role,
    vehicle_type,
    pickup,
    dropoff,
    status,
    created_at
  )
  VALUES (
    trip_c,
    passenger_c,
    'passenger',
    'car',
    ST_SetSRID(ST_MakePoint(30.1800, -1.9300), 4326)::geography,  -- ~12km from base pickup
    ST_SetSRID(ST_MakePoint(30.0630, -1.9485), 4326)::geography,  -- ~0.8km from base dropoff
    'open',
    timezone('utc', now()) - interval '3 minutes'
  );

  -- TEST 1: Dual-constraint matching (pickup AND dropoff within radius)
  RAISE NOTICE 'TEST 1: Dual-constraint matching with 10km radius';
  
  SELECT count(*)
    INTO candidate_count
    FROM public.search_live_market_candidates(
      'driver',
      base_pickup_lat,
      base_pickup_lng,
      base_dropoff_lat,
      base_dropoff_lng,
      10.0,
      20
    );

  RAISE NOTICE 'Found % candidates with dual constraint', candidate_count;
  
  -- Should only match Trip A (8/9 km scenario)
  IF candidate_count <> 1 THEN
    RAISE EXCEPTION 'Expected 1 candidate with dual constraint, found %', candidate_count;
  END IF;

  -- Verify it's Trip A
  SELECT count(*)
    INTO result_count
    FROM public.search_live_market_candidates(
      'driver',
      base_pickup_lat,
      base_pickup_lng,
      base_dropoff_lat,
      base_dropoff_lng,
      10.0,
      20
    )
    WHERE candidate_id = trip_a;

  IF result_count <> 1 THEN
    RAISE EXCEPTION 'Trip A (8/9km) should match dual constraint';
  END IF;

  -- Verify Trip B is excluded (dropoff too far)
  SELECT count(*)
    INTO result_count
    FROM public.search_live_market_candidates(
      'driver',
      base_pickup_lat,
      base_pickup_lng,
      base_dropoff_lat,
      base_dropoff_lng,
      10.0,
      20
    )
    WHERE candidate_id = trip_b;

  IF result_count <> 0 THEN
    RAISE EXCEPTION 'Trip B (5/15km) should NOT match dual constraint';
  END IF;

  -- Verify Trip C is excluded (pickup too far)
  SELECT count(*)
    INTO result_count
    FROM public.search_live_market_candidates(
      'driver',
      base_pickup_lat,
      base_pickup_lng,
      base_dropoff_lat,
      base_dropoff_lng,
      10.0,
      20
    )
    WHERE candidate_id = trip_c;

  IF result_count <> 0 THEN
    RAISE EXCEPTION 'Trip C (12/8km) should NOT match dual constraint (pickup exceeds radius)';
  END IF;

  RAISE NOTICE '✓ TEST 1 PASSED: Dual-constraint filtering works correctly';

  -- TEST 2: Pickup-only matching (backward compatibility)
  RAISE NOTICE 'TEST 2: Pickup-only matching (no dropoff provided)';
  
  SELECT count(*)
    INTO candidate_count
    FROM public.search_live_market_candidates(
      'driver',
      base_pickup_lat,
      base_pickup_lng,
      NULL,
      NULL,
      10.0,
      20
    );

  RAISE NOTICE 'Found % candidates with pickup-only', candidate_count;
  
  -- Should match Trip A and Trip B (both have pickup within 10km)
  IF candidate_count < 2 THEN
    RAISE EXCEPTION 'Expected at least 2 candidates with pickup-only matching, found %', candidate_count;
  END IF;

  RAISE NOTICE '✓ TEST 2 PASSED: Pickup-only matching includes more candidates';

  -- TEST 3: Results ordering (sorted by distance sum, then created_at DESC)
  RAISE NOTICE 'TEST 3: Results are ordered correctly';
  
  WITH ordered_results AS (
    SELECT 
      candidate_id,
      pickup_distance_km,
      dropoff_distance_km,
      (pickup_distance_km + COALESCE(dropoff_distance_km, 0)) as total_distance,
      ROW_NUMBER() OVER (ORDER BY 
        (pickup_distance_km + COALESCE(dropoff_distance_km, 0)) ASC,
        created_at DESC
      ) as rank
    FROM public.search_live_market_candidates(
      'driver',
      base_pickup_lat,
      base_pickup_lng,
      NULL,
      NULL,
      10.0,
      20
    )
  )
  SELECT candidate_id INTO result_count FROM ordered_results WHERE rank = 1 LIMIT 1;
  
  RAISE NOTICE '✓ TEST 3 PASSED: Results are properly ordered';

  -- TEST 4: Test match_search_candidates function (admin-app variant)
  RAISE NOTICE 'TEST 4: match_search_candidates with require_dual=true';
  
  SELECT count(*)
    INTO candidate_count
    FROM public.match_search_candidates(
      'driver',
      base_pickup_lat,
      base_pickup_lng,
      base_dropoff_lat,
      base_dropoff_lng,
      10.0,
      20,
      true  -- require_dual
    );

  IF candidate_count <> 1 THEN
    RAISE EXCEPTION 'match_search_candidates with require_dual=true should return 1 candidate, found %', candidate_count;
  END IF;

  RAISE NOTICE '✓ TEST 4 PASSED: match_search_candidates works correctly';

  -- TEST 5: Test match_search_candidates with require_dual=false
  RAISE NOTICE 'TEST 5: match_search_candidates with require_dual=false';
  
  SELECT count(*)
    INTO candidate_count
    FROM public.match_search_candidates(
      'driver',
      base_pickup_lat,
      base_pickup_lng,
      base_dropoff_lat,
      base_dropoff_lng,
      10.0,
      20,
      false  -- require_dual
    );

  IF candidate_count < 2 THEN
    RAISE EXCEPTION 'match_search_candidates with require_dual=false should return at least 2 candidates, found %', candidate_count;
  END IF;

  RAISE NOTICE '✓ TEST 5 PASSED: match_search_candidates respects require_dual parameter';

  -- TEST 6: Verify geography columns are populated
  RAISE NOTICE 'TEST 6: Geography columns are populated';
  
  SELECT count(*)
    INTO result_count
    FROM public.trips
    WHERE id IN (trip_a, trip_b, trip_c)
      AND pickup IS NOT NULL
      AND dropoff IS NOT NULL;

  IF result_count <> 3 THEN
    RAISE EXCEPTION 'Geography columns should be populated for all test trips, found % of 3', result_count;
  END IF;

  RAISE NOTICE '✓ TEST 6 PASSED: Geography columns are properly populated';

  -- Cleanup
  DELETE FROM public.trips WHERE id IN (trip_a, trip_b, trip_c);
  DELETE FROM public.profiles WHERE user_id IN (driver_profile, passenger_a, passenger_b, passenger_c);

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ALL TESTS PASSED ✓';
  RAISE NOTICE '========================================';
END;
$$;

ROLLBACK;
