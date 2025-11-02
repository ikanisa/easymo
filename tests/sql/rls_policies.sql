-- RLS Policy Tests
-- Tests row-level security policies for user data isolation
-- Run with: pg_prove tests/sql/rls_policies.sql

BEGIN;

-- Load pgTAP extension
SELECT plan(25);

-- ============================================================================
-- Test Setup: Create test users
-- ============================================================================

-- Create test roles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END$$;

-- Create test users
INSERT INTO public.profiles (id, msisdn, name, role) VALUES
  ('00000000-0000-0000-0000-000000000001', '+250788000001', 'User One', 'passenger'),
  ('00000000-0000-0000-0000-000000000002', '+250788000002', 'User Two', 'passenger'),
  ('00000000-0000-0000-0000-000000000003', '+250788000003', 'Driver One', 'driver')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Test 1-5: user_favorites RLS
-- ============================================================================

-- Test 1: Table has RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'user_favorites'),
  'user_favorites has RLS enabled'
);

-- Test 2: User can insert own favorites
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text;

INSERT INTO public.user_favorites (user_id, label, location) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Home', ST_SetSRID(ST_MakePoint(30.0, -2.0), 4326));

SELECT ok(
  EXISTS(
    SELECT 1 FROM public.user_favorites 
    WHERE user_id = '00000000-0000-0000-0000-000000000001' 
    AND label = 'Home'
  ),
  'User can insert own favorites'
);

-- Test 3: User cannot insert favorites for another user
SELECT throws_ok(
  $$INSERT INTO public.user_favorites (user_id, label, location) VALUES
    ('00000000-0000-0000-0000-000000000002', 'Work', ST_SetSRID(ST_MakePoint(30.0, -2.0), 4326))$$,
  'User cannot insert favorites for another user'
);

-- Test 4: User can only read own favorites
INSERT INTO public.user_favorites (user_id, label, location) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Office', ST_SetSRID(ST_MakePoint(30.1, -2.1), 4326));

SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text;

SELECT results_eq(
  $$SELECT user_id::text FROM public.user_favorites WHERE user_id IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
  )$$,
  ARRAY['00000000-0000-0000-0000-000000000001']::text[],
  'User can only read own favorites'
);

-- Test 5: Service role can read all favorites
RESET role;
SET LOCAL role = service_role;

SELECT ok(
  (SELECT COUNT(*) FROM public.user_favorites) >= 2,
  'Service role can read all favorites'
);

RESET role;

-- ============================================================================
-- Test 6-10: driver_parking RLS
-- ============================================================================

-- Test 6: Table has RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'driver_parking'),
  'driver_parking has RLS enabled'
);

-- Test 7: Driver can insert own parking
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000003')::text;

INSERT INTO public.driver_parking (driver_id, location, notes) VALUES
  ('00000000-0000-0000-0000-000000000003', ST_SetSRID(ST_MakePoint(30.2, -2.2), 4326), 'Parking spot A');

SELECT ok(
  EXISTS(
    SELECT 1 FROM public.driver_parking 
    WHERE driver_id = '00000000-0000-0000-0000-000000000003'
  ),
  'Driver can insert own parking'
);

-- Test 8: Driver cannot insert parking for another driver
SELECT throws_ok(
  $$INSERT INTO public.driver_parking (driver_id, location, notes) VALUES
    ('00000000-0000-0000-0000-000000000001', ST_SetSRID(ST_MakePoint(30.3, -2.3), 4326), 'Fake parking')$$,
  'Driver cannot insert parking for another driver'
);

-- Test 9: Driver can only read own parking
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000003')::text;

SELECT results_eq(
  $$SELECT driver_id::text FROM public.driver_parking$$,
  ARRAY['00000000-0000-0000-0000-000000000003']::text[],
  'Driver can only read own parking'
);

-- Test 10: Service role can read all parking
RESET role;
SET LOCAL role = service_role;

SELECT ok(
  (SELECT COUNT(*) FROM public.driver_parking) >= 1,
  'Service role can read all parking'
);

RESET role;

-- ============================================================================
-- Test 11-15: driver_availability RLS
-- ============================================================================

-- Test 11: Table has RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'driver_availability'),
  'driver_availability has RLS enabled'
);

-- Test 12: Driver can insert own availability
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000003')::text;

INSERT INTO public.driver_availability (driver_id, available_from, available_to) VALUES
  ('00000000-0000-0000-0000-000000000003', NOW(), NOW() + INTERVAL '8 hours');

SELECT ok(
  EXISTS(
    SELECT 1 FROM public.driver_availability 
    WHERE driver_id = '00000000-0000-0000-0000-000000000003'
  ),
  'Driver can insert own availability'
);

-- Test 13: Driver cannot insert availability for another driver
SELECT throws_ok(
  $$INSERT INTO public.driver_availability (driver_id, available_from, available_to) VALUES
    ('00000000-0000-0000-0000-000000000001', NOW(), NOW() + INTERVAL '8 hours')$$,
  'Driver cannot insert availability for another driver'
);

-- Test 14: Driver can only read own availability
SELECT results_eq(
  $$SELECT driver_id::text FROM public.driver_availability$$,
  ARRAY['00000000-0000-0000-0000-000000000003']::text[],
  'Driver can only read own availability'
);

-- Test 15: Service role can read all availability
RESET role;
SET LOCAL role = service_role;

SELECT ok(
  (SELECT COUNT(*) FROM public.driver_availability) >= 1,
  'Service role can read all availability'
);

RESET role;

-- ============================================================================
-- Test 16-20: recurring_trips RLS
-- ============================================================================

-- Test 16: Table has RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'recurring_trips'),
  'recurring_trips has RLS enabled'
);

-- Test 17: User can insert own recurring trips
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text;

INSERT INTO public.recurring_trips (user_id, origin, destination, schedule) VALUES
  ('00000000-0000-0000-0000-000000000001', 
   ST_SetSRID(ST_MakePoint(30.0, -2.0), 4326),
   ST_SetSRID(ST_MakePoint(30.1, -2.1), 4326),
   '{"days": ["monday", "friday"], "time": "08:00"}'::jsonb);

SELECT ok(
  EXISTS(
    SELECT 1 FROM public.recurring_trips 
    WHERE user_id = '00000000-0000-0000-0000-000000000001'
  ),
  'User can insert own recurring trips'
);

-- Test 18: User cannot insert recurring trips for another user
SELECT throws_ok(
  $$INSERT INTO public.recurring_trips (user_id, origin, destination, schedule) VALUES
    ('00000000-0000-0000-0000-000000000002',
     ST_SetSRID(ST_MakePoint(30.0, -2.0), 4326),
     ST_SetSRID(ST_MakePoint(30.1, -2.1), 4326),
     '{}'::jsonb)$$,
  'User cannot insert recurring trips for another user'
);

-- Test 19: User can only read own recurring trips
SELECT results_eq(
  $$SELECT user_id::text FROM public.recurring_trips$$,
  ARRAY['00000000-0000-0000-0000-000000000001']::text[],
  'User can only read own recurring trips'
);

-- Test 20: Service role can read all recurring trips
RESET role;
SET LOCAL role = service_role;

SELECT ok(
  (SELECT COUNT(*) FROM public.recurring_trips) >= 1,
  'Service role can read all recurring trips'
);

RESET role;

-- ============================================================================
-- Test 21-25: router_logs and router_keyword_map RLS
-- ============================================================================

-- Test 21: router_logs has RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'router_logs'),
  'router_logs has RLS enabled'
);

-- Test 22: Service role can insert router logs
SET LOCAL role = service_role;

INSERT INTO public.router_logs (message_id, text_snippet, route_key, status_code) VALUES
  ('wamid.test123', 'test message', 'insurance', 'routed');

SELECT ok(
  EXISTS(SELECT 1 FROM public.router_logs WHERE message_id = 'wamid.test123'),
  'Service role can insert router logs'
);

RESET role;

-- Test 23: Authenticated users can read router logs
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text;

SELECT ok(
  (SELECT COUNT(*) FROM public.router_logs) >= 1,
  'Authenticated users can read router logs'
);

RESET role;

-- Test 24: router_keyword_map has RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'router_keyword_map'),
  'router_keyword_map has RLS enabled'
);

-- Test 25: Authenticated users can read active keywords
SET LOCAL role = authenticated;

SELECT ok(
  (SELECT COUNT(*) FROM public.router_keyword_map WHERE is_active = true) >= 1,
  'Authenticated users can read active keywords'
);

RESET role;

-- Test 26: router_destinations has RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'router_destinations'),
  'router_destinations has RLS enabled'
);

-- Test 27: Service role can upsert destinations
SET LOCAL role = service_role;

INSERT INTO public.router_destinations (slug, route_key, url)
VALUES ('test-destination', 'insurance', 'https://example.test/router')
ON CONFLICT (slug) DO UPDATE SET url = EXCLUDED.url;

SELECT ok(
  EXISTS(
    SELECT 1 FROM public.router_destinations WHERE slug = 'test-destination'
  ),
  'Service role can upsert router destinations'
);

RESET role;

-- Test 28: Authenticated users can read active destinations
SET LOCAL role = authenticated;

SELECT ok(
  (SELECT COUNT(*) FROM public.router_destinations WHERE is_active = true) >= 1,
  'Authenticated users can read active router destinations'
);

RESET role;

-- Test 29: router_idempotency has RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'router_idempotency'),
  'router_idempotency has RLS enabled'
);

-- Test 30: Service role can insert idempotency records
SET LOCAL role = service_role;

INSERT INTO public.router_idempotency (message_id, from_number)
VALUES ('wamid.sqltest', '+250700000000')
ON CONFLICT (message_id) DO NOTHING;

SELECT ok(
  EXISTS(SELECT 1 FROM public.router_idempotency WHERE message_id = 'wamid.sqltest'),
  'Service role can insert router idempotency records'
);

RESET role;

-- Test 31: router_rate_limits has RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'router_rate_limits'),
  'router_rate_limits has RLS enabled'
);

-- Test 32: Service role can insert rate limit records
SET LOCAL role = service_role;

INSERT INTO public.router_rate_limits (sender, window_start, count)
VALUES ('250788000000', timezone('utc', now()), 1)
ON CONFLICT (sender, window_start) DO UPDATE SET count = EXCLUDED.count;

SELECT ok(
  EXISTS(SELECT 1 FROM public.router_rate_limits WHERE sender = '250788000000'),
  'Service role can insert router rate limit records'
);

RESET role;

-- Test 33: router_telemetry has RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'router_telemetry'),
  'router_telemetry has RLS enabled'
);

-- Test 34: Service role can insert telemetry events
SET LOCAL role = service_role;

INSERT INTO public.router_telemetry (event, message_id, keyword)
VALUES ('message_routed', 'wamid.sqltest', 'insurance');

SELECT ok(
  EXISTS(SELECT 1 FROM public.router_telemetry WHERE message_id = 'wamid.sqltest'),
  'Service role can insert router telemetry events'
);

RESET role;

-- ============================================================================
-- Cleanup
-- ============================================================================

-- Clean up test data
DELETE FROM public.user_favorites WHERE user_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);

DELETE FROM public.driver_parking WHERE driver_id = '00000000-0000-0000-0000-000000000003';
DELETE FROM public.driver_availability WHERE driver_id = '00000000-0000-0000-0000-000000000003';
DELETE FROM public.recurring_trips WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.router_logs WHERE message_id = 'wamid.test123';
DELETE FROM public.router_destinations WHERE slug = 'test-destination';
DELETE FROM public.router_idempotency WHERE message_id = 'wamid.sqltest';
DELETE FROM public.router_rate_limits WHERE sender = '250788000000';
DELETE FROM public.router_telemetry WHERE message_id = 'wamid.sqltest';

DELETE FROM public.profiles WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
);

SELECT * FROM finish();

ROLLBACK;
