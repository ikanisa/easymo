-- ============================================================================
-- V2 MIGRATION VERIFICATION TESTS
-- ============================================================================
-- Purpose: Validate optimistic locking, audit logging, and data integrity
-- Run against production database to verify V2 migration success
-- ============================================================================

-- ============================================================================
-- TEST 1: Optimistic Locking Verification
-- ============================================================================

-- Create a test trip match
DO $$
DECLARE
  test_trip_id uuid;
  test_driver_id uuid;
  test_passenger_id uuid;
  initial_version integer;
  update1_result integer;
  update2_result integer;
BEGIN
  -- Get test user IDs (use existing users or create test users)
  SELECT user_id INTO test_driver_id FROM profiles WHERE role = 'driver' LIMIT 1;
  SELECT user_id INTO test_passenger_id FROM profiles WHERE role = 'passenger' LIMIT 1;
  
  IF test_driver_id IS NULL OR test_passenger_id IS NULL THEN
    RAISE NOTICE 'Skipping optimistic locking test - no test users available';
    RETURN;
  END IF;
  
  -- Create test trip match
  INSERT INTO mobility_trip_matches (
    driver_user_id,
    passenger_user_id,
    vehicle_type,
    pickup_location,
    status,
    estimated_fare,
    currency
  ) VALUES (
    test_driver_id,
    test_passenger_id,
    'moto',
    ST_SetSRID(ST_MakePoint(30.06, -1.95), 4326)::geography,
    'pending',
    2000,
    'RWF'
  ) RETURNING id, version INTO test_trip_id, initial_version;
  
  RAISE NOTICE 'Created test trip: %, initial version: %', test_trip_id, initial_version;
  
  -- Simulate concurrent update 1 (should succeed)
  UPDATE mobility_trip_matches
  SET status = 'accepted'
  WHERE id = test_trip_id AND version = initial_version;
  
  GET DIAGNOSTICS update1_result = ROW_COUNT;
  
  -- Simulate concurrent update 2 with same version (should fail - 0 rows updated)
  UPDATE mobility_trip_matches
  SET status = 'in_progress'
  WHERE id = test_trip_id AND version = initial_version;
  
  GET DIAGNOSTICS update2_result = ROW_COUNT;
  
  -- Verify results
  IF update1_result = 1 AND update2_result = 0 THEN
    RAISE NOTICE '✅ TEST 1 PASSED: Optimistic locking working correctly';
    RAISE NOTICE '   - First update succeeded (% rows)', update1_result;
    RAISE NOTICE '   - Second update blocked (% rows)', update2_result;
  ELSE
    RAISE WARNING '❌ TEST 1 FAILED: Optimistic locking not working';
    RAISE WARNING '   - First update: % rows', update1_result;
    RAISE WARNING '   - Second update: % rows (expected 0)', update2_result;
  END IF;
  
  -- Verify version incremented
  DECLARE
    current_version integer;
  BEGIN
    SELECT version INTO current_version FROM mobility_trip_matches WHERE id = test_trip_id;
    IF current_version = initial_version + 1 THEN
      RAISE NOTICE '✅ Version incremented correctly: % -> %', initial_version, current_version;
    ELSE
      RAISE WARNING '❌ Version not incremented: % (expected %)', current_version, initial_version + 1;
    END IF;
  END;
  
  -- Cleanup
  DELETE FROM mobility_trip_matches WHERE id = test_trip_id;
  RAISE NOTICE 'Test trip cleaned up';
  
END;
$$;

-- ============================================================================
-- TEST 2: Audit Logging Verification
-- ============================================================================

DO $$
DECLARE
  test_trip_id uuid;
  test_driver_id uuid;
  test_passenger_id uuid;
  audit_count integer;
BEGIN
  -- Get test user IDs
  SELECT user_id INTO test_driver_id FROM profiles WHERE role = 'driver' LIMIT 1;
  SELECT user_id INTO test_passenger_id FROM profiles WHERE role = 'passenger' LIMIT 1;
  
  IF test_driver_id IS NULL OR test_passenger_id IS NULL THEN
    RAISE NOTICE 'Skipping audit logging test - no test users available';
    RETURN;
  END IF;
  
  -- Create test trip match
  INSERT INTO mobility_trip_matches (
    driver_user_id,
    passenger_user_id,
    vehicle_type,
    pickup_location,
    status,
    estimated_fare,
    currency
  ) VALUES (
    test_driver_id,
    test_passenger_id,
    'moto',
    ST_SetSRID(ST_MakePoint(30.06, -1.95), 4326)::geography,
    'pending',
    2000,
    'RWF'
  ) RETURNING id INTO test_trip_id;
  
  RAISE NOTICE 'Created test trip for audit logging: %', test_trip_id;
  
  -- Perform status changes
  UPDATE mobility_trip_matches SET status = 'accepted' WHERE id = test_trip_id;
  UPDATE mobility_trip_matches SET status = 'in_progress' WHERE id = test_trip_id;
  UPDATE mobility_trip_matches SET status = 'completed' WHERE id = test_trip_id;
  
  -- Wait a moment for triggers to fire
  PERFORM pg_sleep(0.5);
  
  -- Check audit trail
  SELECT COUNT(*) INTO audit_count 
  FROM trip_status_audit 
  WHERE trip_id = test_trip_id;
  
  IF audit_count = 3 THEN
    RAISE NOTICE '✅ TEST 2 PASSED: Audit logging working correctly';
    RAISE NOTICE '   - % status changes logged', audit_count;
    
    -- Show audit trail
    RAISE NOTICE 'Audit trail:';
    FOR rec IN 
      SELECT old_status, new_status, changed_at 
      FROM trip_status_audit 
      WHERE trip_id = test_trip_id 
      ORDER BY changed_at
    LOOP
      RAISE NOTICE '   % -> % at %', rec.old_status, rec.new_status, rec.changed_at;
    END LOOP;
  ELSE
    RAISE WARNING '❌ TEST 2 FAILED: Expected 3 audit entries, got %', audit_count;
  END IF;
  
  -- Cleanup
  DELETE FROM trip_status_audit WHERE trip_id = test_trip_id;
  DELETE FROM mobility_trip_matches WHERE id = test_trip_id;
  RAISE NOTICE 'Test data cleaned up';
  
END;
$$;

-- ============================================================================
-- TEST 3: Data Integrity Verification
-- ============================================================================

DO $$
DECLARE
  v1_count integer;
  v2_count integer;
  mismatch_count integer;
BEGIN
  -- Compare trip counts
  SELECT COUNT(*) INTO v1_count FROM rides_trips;
  SELECT COUNT(*) INTO v2_count FROM mobility_trips;
  
  RAISE NOTICE 'TEST 3: Data Integrity';
  RAISE NOTICE '  V1 trips: %', v1_count;
  RAISE NOTICE '  V2 trips: %', v2_count;
  
  IF v1_count = v2_count THEN
    RAISE NOTICE '✅ Trip counts match';
  ELSE
    RAISE WARNING '❌ Trip count mismatch: V1=%, V2=%', v1_count, v2_count;
  END IF;
  
  -- Check for data mismatches
  SELECT COUNT(*) INTO mismatch_count
  FROM rides_trips rt
  JOIN mobility_trips mt ON rt.id = mt.id
  WHERE rt.creator_user_id != mt.creator_user_id 
     OR rt.pickup_latitude != mt.pickup_lat
     OR rt.pickup_longitude != mt.pickup_lng;
  
  IF mismatch_count = 0 THEN
    RAISE NOTICE '✅ All migrated data matches V1 source';
  ELSE
    RAISE WARNING '❌ Found % rows with data mismatches', mismatch_count;
  END IF;
  
END;
$$;

-- ============================================================================
-- TEST 4: Trigger Verification
-- ============================================================================

SELECT 
  'TEST 4: Trigger Verification' as test,
  tgname as trigger_name,
  CASE 
    WHEN tgname = 'trg_increment_version' THEN '✅ Optimistic locking trigger active'
    WHEN tgname = 'trg_log_trip_status_change' THEN '✅ Audit logging trigger active'
    WHEN tgname = 'trg_mobility_trip_matches_updated_at' THEN '✅ Timestamp trigger active'
    ELSE 'Other trigger'
  END as status
FROM pg_trigger 
WHERE tgrelid = 'mobility_trip_matches'::regclass
  AND tgname IN ('trg_increment_version', 'trg_log_trip_status_change', 'trg_mobility_trip_matches_updated_at')
ORDER BY tgname;

-- ============================================================================
-- TEST 5: Index Verification
-- ============================================================================

SELECT 
  'TEST 5: Index Verification' as test,
  indexname,
  '✅ Index exists' as status
FROM pg_indexes 
WHERE tablename = 'mobility_trip_matches' 
  AND indexname LIKE 'idx_%'
ORDER BY indexname;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'V2 MIGRATION VERIFICATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Review the test results above.';
  RAISE NOTICE 'All tests should show ✅ for successful migration.';
  RAISE NOTICE '';
END;
$$;
