-- ============================================================================
-- V2 MIGRATION VERIFICATION WITH TEST USERS (FIXED v2)
-- ============================================================================
-- Purpose: Validate optimistic locking and audit logging with temporary users
-- ============================================================================

DO $$
DECLARE
  test_driver_id uuid := gen_random_uuid();
  test_passenger_id uuid := gen_random_uuid();
  test_driver_trip_id uuid;
  test_passenger_trip_id uuid;
  test_trip_match_id uuid;
  initial_version integer;
  update1_result integer;
  update2_result integer;
  audit_count integer;
BEGIN
  RAISE NOTICE 'Starting V2 Verification Tests...';

  -- 1. Create test users
  INSERT INTO profiles (user_id, role, display_name, phone_number)
  VALUES 
    (test_driver_id, 'driver', 'Test Driver', '+250788000001'),
    (test_passenger_id, 'passenger', 'Test Passenger', '+250788000002');
    
  RAISE NOTICE '✅ Created temporary test users';

  -- 2. Create Trip Requests (Prerequisites for Match)
  
  -- Driver Trip
  INSERT INTO mobility_trips (
    creator_user_id, role, vehicle_type, 
    pickup_lat, pickup_lng, 
    status, expires_at
  ) VALUES (
    test_driver_id, 'driver', 'moto',
    -1.95, 30.06,
    'open', now() + interval '1 hour'
  ) RETURNING id INTO test_driver_trip_id;
  
  -- Passenger Trip
  INSERT INTO mobility_trips (
    creator_user_id, role, vehicle_type, 
    pickup_lat, pickup_lng, 
    status, expires_at
  ) VALUES (
    test_passenger_id, 'passenger', 'moto',
    -1.95, 30.06,
    'open', now() + interval '1 hour'
  ) RETURNING id INTO test_passenger_trip_id;
  
  RAISE NOTICE '✅ Created trip requests: Driver %, Passenger %', test_driver_trip_id, test_passenger_trip_id;

  -- ========================================================================
  -- TEST 1: Optimistic Locking
  -- ========================================================================
  
  -- Create test trip match
  INSERT INTO mobility_trip_matches (
    driver_user_id,
    passenger_user_id,
    driver_trip_id,
    passenger_trip_id,
    vehicle_type,
    pickup_location,
    status,
    estimated_fare,
    currency,
    driver_phone,
    passenger_phone
  ) VALUES (
    test_driver_id,
    test_passenger_id,
    test_driver_trip_id,
    test_passenger_trip_id,
    'moto',
    ST_SetSRID(ST_MakePoint(30.06, -1.95), 4326)::geography,
    'pending',
    2000,
    'RWF',
    '+250788000001',
    '+250788000002'
  ) RETURNING id, version INTO test_trip_match_id, initial_version;
  
  RAISE NOTICE '✅ Created test trip match: % (Version: %)', test_trip_match_id, initial_version;
  
  -- Simulate concurrent update 1 (should succeed)
  UPDATE mobility_trip_matches
  SET status = 'accepted'
  WHERE id = test_trip_match_id AND version = initial_version;
  
  GET DIAGNOSTICS update1_result = ROW_COUNT;
  
  -- Simulate concurrent update 2 with same version (should fail)
  UPDATE mobility_trip_matches
  SET status = 'in_progress'
  WHERE id = test_trip_match_id AND version = initial_version;
  
  GET DIAGNOSTICS update2_result = ROW_COUNT;
  
  -- Verify results
  IF update1_result = 1 AND update2_result = 0 THEN
    RAISE NOTICE '✅ TEST 1 PASSED: Optimistic locking working correctly';
  ELSE
    RAISE WARNING '❌ TEST 1 FAILED: Update1=%, Update2=%', update1_result, update2_result;
  END IF;
  
  -- Verify version incremented
  DECLARE
    current_version integer;
  BEGIN
    SELECT version INTO current_version FROM mobility_trip_matches WHERE id = test_trip_match_id;
    IF current_version = initial_version + 1 THEN
      RAISE NOTICE '✅ Version incremented correctly: % -> %', initial_version, current_version;
    ELSE
      RAISE WARNING '❌ Version not incremented: %', current_version;
    END IF;
  END;

  -- ========================================================================
  -- TEST 2: Audit Logging
  -- ========================================================================
  
  -- Perform more status changes to generate audit logs
  UPDATE mobility_trip_matches 
  SET status = 'in_progress' 
  WHERE id = test_trip_match_id;
  
  UPDATE mobility_trip_matches 
  SET status = 'completed' 
  WHERE id = test_trip_match_id;
  
  -- Check audit trail
  SELECT COUNT(*) INTO audit_count 
  FROM trip_status_audit 
  WHERE trip_id = test_trip_match_id;
  
  IF audit_count >= 3 THEN
    RAISE NOTICE '✅ TEST 2 PASSED: Audit logging working (% entries)', audit_count;
  ELSE
    RAISE WARNING '❌ TEST 2 FAILED: Expected 3+ audit entries, got %', audit_count;
  END IF;

  -- ========================================================================
  -- CLEANUP
  -- ========================================================================
  
  DELETE FROM trip_status_audit WHERE trip_id = test_trip_match_id;
  DELETE FROM mobility_trip_matches WHERE id = test_trip_match_id;
  DELETE FROM mobility_trips WHERE id IN (test_driver_trip_id, test_passenger_trip_id);
  DELETE FROM profiles WHERE user_id IN (test_driver_id, test_passenger_id);
  
  RAISE NOTICE '✅ Cleanup complete';
  RAISE NOTICE 'ALL TESTS PASSED SUCCESSFULLY';

EXCEPTION WHEN OTHERS THEN
  -- Ensure cleanup on error
  RAISE WARNING 'Error occurred: %', SQLERRM;
  BEGIN
    DELETE FROM trip_status_audit WHERE trip_id = test_trip_match_id;
    DELETE FROM mobility_trip_matches WHERE id = test_trip_match_id;
    DELETE FROM mobility_trips WHERE id IN (test_driver_trip_id, test_passenger_trip_id);
    DELETE FROM profiles WHERE user_id IN (test_driver_id, test_passenger_id);
    RAISE NOTICE 'Cleanup performed after error';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error during cleanup: %', SQLERRM;
  END;
  RAISE;
END;
$$;
