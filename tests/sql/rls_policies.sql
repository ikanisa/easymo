-- RLS Policy Tests
-- Tests row-level security policies for user data isolation
-- Run with: pg_prove tests/sql/rls_policies.sql

BEGIN;

-- Load pgTAP extension
SELECT plan(40);

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
-- Test 1-6: user_favorites RLS
-- ============================================================================

-- Test 1: Table forces RLS
SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'user_favorites'),
  'user_favorites has FORCE RLS enabled'
);

-- Test 2: Table has RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'user_favorites'),
  'user_favorites has RLS enabled'
);

-- Test 3: User can insert own favorites
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text;

INSERT INTO public.user_favorites (user_id, kind, label, geog)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'home',
  'Home',
  ST_SetSRID(ST_MakePoint(30.0, -2.0), 4326)
)
ON CONFLICT (user_id, label) DO NOTHING;

SELECT ok(
  EXISTS(
    SELECT 1 FROM public.user_favorites
    WHERE user_id = '00000000-0000-0000-0000-000000000001'
    AND label = 'Home'
  ),
  'User can insert own favorites'
);

-- Test 4: User cannot insert favorites for another user
SELECT throws_ok(
  $$INSERT INTO public.user_favorites (user_id, kind, label, geog) VALUES
    ('00000000-0000-0000-0000-000000000002', 'work', 'Work', ST_SetSRID(ST_MakePoint(30.0, -2.0), 4326))$$,
  'User cannot insert favorites for another user'
);

-- Test 5: User can only read own favorites
INSERT INTO public.user_favorites (user_id, kind, label, geog) VALUES
  ('00000000-0000-0000-0000-000000000002', 'work', 'Office', ST_SetSRID(ST_MakePoint(30.1, -2.1), 4326))
ON CONFLICT (user_id, label) DO NOTHING;

SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text;

SELECT results_eq(
  $$SELECT user_id::text FROM public.user_favorites WHERE user_id IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
  )$$,
  ARRAY['00000000-0000-0000-0000-000000000001']::text[],
  'User can only read own favorites'
);

-- Test 6: Service role can read all favorites
RESET role;
SET LOCAL role = service_role;

SELECT ok(
  (SELECT COUNT(*) FROM public.user_favorites) >= 2,
  'Service role can read all favorites'
);

RESET role;

-- ============================================================================
-- Test 7-12: driver_parking RLS
-- ============================================================================

-- Test 7: Table forces RLS
SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'driver_parking'),
  'driver_parking has FORCE RLS enabled'
);

-- Test 8: Table has RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'driver_parking'),
  'driver_parking has RLS enabled'
);

-- Test 9: Driver can insert own parking
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000003')::text;

INSERT INTO public.driver_parking (driver_id, label, geog, notes) VALUES
  ('00000000-0000-0000-0000-000000000003', 'Parking spot A', ST_SetSRID(ST_MakePoint(30.2, -2.2), 4326), 'Primary stand');

SELECT ok(
  EXISTS(
    SELECT 1 FROM public.driver_parking
    WHERE driver_id = '00000000-0000-0000-0000-000000000003'
  ),
  'Driver can insert own parking'
);

-- Test 10: Driver cannot insert parking for another driver
SELECT throws_ok(
  $$INSERT INTO public.driver_parking (driver_id, label, geog) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Fake parking', ST_SetSRID(ST_MakePoint(30.3, -2.3), 4326))$$,
  'Driver cannot insert parking for another driver'
);

-- Test 11: Driver can only read own parking
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000003')::text;

SELECT results_eq(
  $$SELECT driver_id::text FROM public.driver_parking$$,
  ARRAY['00000000-0000-0000-0000-000000000003']::text[],
  'Driver can only read own parking'
);

-- Test 12: Service role can read all parking
RESET role;
SET LOCAL role = service_role;

SELECT ok(
  (SELECT COUNT(*) FROM public.driver_parking) >= 1,
  'Service role can read all parking'
);

RESET role;

-- ============================================================================
-- Test 13-18: driver_availability RLS
-- ============================================================================

-- Test 13: Table forces RLS
SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'driver_availability'),
  'driver_availability has FORCE RLS enabled'
);

-- Test 14: Table has RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'driver_availability'),
  'driver_availability has RLS enabled'
);

-- Test 15: Driver can insert own availability
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000003')::text;

INSERT INTO public.driver_availability (
  driver_id,
  days_of_week,
  start_time_local,
  end_time_local
) VALUES (
  '00000000-0000-0000-0000-000000000003',
  ARRAY[1,3,5],
  TIME '08:00',
  TIME '17:00'
);

SELECT ok(
  EXISTS(
    SELECT 1 FROM public.driver_availability
    WHERE driver_id = '00000000-0000-0000-0000-000000000003'
  ),
  'Driver can insert own availability'
);

-- Test 16: Driver cannot insert availability for another driver
SELECT throws_ok(
  $$INSERT INTO public.driver_availability (driver_id, days_of_week, start_time_local, end_time_local) VALUES
    ('00000000-0000-0000-0000-000000000001', ARRAY[2,4], TIME '09:00', TIME '18:00')$$,
  'Driver cannot insert availability for another driver'
);

-- Test 17: Driver can only read own availability
SELECT results_eq(
  $$SELECT driver_id::text FROM public.driver_availability$$,
  ARRAY['00000000-0000-0000-0000-000000000003']::text[],
  'Driver can only read own availability'
);

-- Test 18: Service role can read all availability
RESET role;
SET LOCAL role = service_role;

SELECT ok(
  (SELECT COUNT(*) FROM public.driver_availability) >= 1,
  'Service role can read all availability'
);

RESET role;

-- ============================================================================
-- Test 19-24: recurring_trips RLS
-- ============================================================================

-- Prepare destination favorite for recurring trip tests
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text;

INSERT INTO public.user_favorites (user_id, kind, label, geog)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'work',
  'Work',
  ST_SetSRID(ST_MakePoint(30.05, -2.02), 4326)
)
ON CONFLICT (user_id, label) DO NOTHING;

RESET role;

-- Test 19: Table forces RLS
SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'recurring_trips'),
  'recurring_trips has FORCE RLS enabled'
);

-- Test 20: Table has RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'recurring_trips'),
  'recurring_trips has RLS enabled'
);

-- Test 21: User can insert own recurring trips
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text;

INSERT INTO public.recurring_trips (
  user_id,
  origin_favorite_id,
  dest_favorite_id,
  days_of_week,
  time_local
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  (SELECT id FROM public.user_favorites WHERE user_id = '00000000-0000-0000-0000-000000000001' AND label = 'Home'),
  (SELECT id FROM public.user_favorites WHERE user_id = '00000000-0000-0000-0000-000000000001' AND label = 'Work'),
  ARRAY[1,5],
  TIME '08:00'
);

SELECT ok(
  EXISTS(
    SELECT 1 FROM public.recurring_trips
    WHERE user_id = '00000000-0000-0000-0000-000000000001'
  ),
  'User can insert own recurring trips'
);

-- Test 22: User cannot insert recurring trips for another user
SELECT throws_ok(
  $$INSERT INTO public.recurring_trips (user_id, origin_favorite_id, dest_favorite_id, days_of_week, time_local) VALUES
    ('00000000-0000-0000-0000-000000000002',
     (SELECT id FROM public.user_favorites WHERE user_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
     (SELECT id FROM public.user_favorites WHERE user_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
     ARRAY[2,4],
     TIME '09:00')$$,
  'User cannot insert recurring trips for another user'
);

-- Test 23: User can only read own recurring trips
SELECT results_eq(
  $$SELECT user_id::text FROM public.recurring_trips$$,
  ARRAY['00000000-0000-0000-0000-000000000001']::text[],
  'User can only read own recurring trips'
);

-- Test 24: Service role can read all recurring trips
RESET role;
SET LOCAL role = service_role;

SELECT ok(
  (SELECT COUNT(*) FROM public.recurring_trips) >= 1,
  'Service role can read all recurring trips'
);

RESET role;

-- ============================================================================
-- Test 25-34: deeplink tokens & events RLS
-- ============================================================================

-- Test 25: deeplink_tokens forces RLS
SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'deeplink_tokens'),
  'deeplink_tokens has FORCE RLS enabled'
);

-- Test 26: deeplink_tokens has RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'deeplink_tokens'),
  'deeplink_tokens has RLS enabled'
);

-- Test 27: deeplink_events forces RLS
SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'deeplink_events'),
  'deeplink_events has FORCE RLS enabled'
);

-- Test 28: deeplink_events has RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'deeplink_events'),
  'deeplink_events has RLS enabled'
);

-- Test 29: Service role can insert deeplink tokens
SET LOCAL role = service_role;

INSERT INTO public.deeplink_tokens (
  flow,
  token,
  payload,
  msisdn_e164,
  expires_at,
  created_by
) VALUES (
  'insurance_attach',
  'tok-test-service',
  '{"request_id":"req-1"}',
  '+250788000001',
  timezone('utc', now()) + INTERVAL '1 day',
  '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (token) DO NOTHING;

SELECT ok(
  EXISTS(SELECT 1 FROM public.deeplink_tokens WHERE token = 'tok-test-service'),
  'Service role can insert deeplink tokens'
);

RESET role;

-- Test 30: Authenticated user can read own deeplink tokens
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text;

SELECT results_eq(
  $$SELECT token FROM public.deeplink_tokens WHERE created_by = '00000000-0000-0000-0000-000000000001'$$,
  ARRAY['tok-test-service']::text[],
  'Creator can read own deeplink tokens'
);

-- Test 31: Authenticated user cannot read another user token
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000002')::text;

SELECT results_eq(
  $$SELECT token FROM public.deeplink_tokens WHERE token = 'tok-test-service'$$,
  ARRAY[]::text[],
  'Other users cannot read foreign deeplink tokens'
);

-- Test 32: Authenticated user cannot insert deeplink tokens
SELECT throws_ok(
  $$INSERT INTO public.deeplink_tokens (flow, token, payload, msisdn_e164, expires_at) VALUES
    ('basket_open', 'tok-user-fail', '{"basket_id":"b1"}', '+250788000002', timezone('utc', now()) + INTERVAL '1 day')$$,
  'Authenticated user cannot insert deeplink tokens'
);

RESET role;

-- Test 33: Service role can insert deeplink events
SET LOCAL role = service_role;

INSERT INTO public.deeplink_events (token_id, event, actor_msisdn)
SELECT id, 'opened', '+250788000001'
FROM public.deeplink_tokens
WHERE token = 'tok-test-service'
LIMIT 1;

SELECT ok(
  EXISTS(SELECT 1 FROM public.deeplink_events WHERE token_id = (SELECT id FROM public.deeplink_tokens WHERE token = 'tok-test-service')),
  'Service role can insert deeplink events'
);

RESET role;

-- Test 34: Service role can read deeplink events
SET LOCAL role = service_role;

SELECT ok(
  (SELECT COUNT(*) FROM public.deeplink_events WHERE token_id = (SELECT id FROM public.deeplink_tokens WHERE token = 'tok-test-service')) >= 1,
  'Service role can read deeplink events'
);

RESET role;

-- ============================================================================
-- Test 35-40: router_logs and router_keyword_map RLS
-- ============================================================================

-- Test 35: router_logs forces RLS
SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'router_logs'),
  'router_logs has FORCE RLS enabled'
);

-- Test 36: router_logs has RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'router_logs'),
  'router_logs has RLS enabled'
);

-- Test 37: Service role can insert router logs
SET LOCAL role = service_role;

INSERT INTO public.router_logs (message_id, text_snippet, route_key, status_code) VALUES
  ('wamid.test123', 'test message', 'insurance', 'routed');

SELECT ok(
  EXISTS(SELECT 1 FROM public.router_logs WHERE message_id = 'wamid.test123'),
  'Service role can insert router logs'
);

RESET role;

-- Test 38: Authenticated users can read router logs
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text;

SELECT ok(
  (SELECT COUNT(*) FROM public.router_logs) >= 1,
  'Authenticated users can read router logs'
);

RESET role;

-- Test 39: router_keyword_map has RLS enabled
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'router_keyword_map'),
  'router_keyword_map has RLS enabled'
);

-- Test 40: Authenticated users can read active keywords
SET LOCAL role = authenticated;

SELECT ok(
  (SELECT COUNT(*) FROM public.router_keyword_map WHERE is_active = true) >= 1,
  'Authenticated users can read active keywords'
);

RESET role;

-- ============================================================================
-- Cleanup
-- ============================================================================

-- Clean up test data
DELETE FROM public.deeplink_events WHERE token_id IN (
  SELECT id FROM public.deeplink_tokens WHERE token = 'tok-test-service'
);
DELETE FROM public.deeplink_tokens WHERE token IN ('tok-test-service', 'tok-user-fail');

DELETE FROM public.user_favorites WHERE user_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);

DELETE FROM public.driver_parking WHERE driver_id = '00000000-0000-0000-0000-000000000003';
DELETE FROM public.driver_availability WHERE driver_id = '00000000-0000-0000-0000-000000000003';
DELETE FROM public.recurring_trips WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.router_logs WHERE message_id = 'wamid.test123';

DELETE FROM public.profiles WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
);

SELECT * FROM finish();

ROLLBACK;
