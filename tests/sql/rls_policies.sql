-- RLS Policy Tests
-- Validates row-level security isolation for user-owned data and service role bypasses.
-- Run with: pg_prove tests/sql/rls_policies.sql

BEGIN;

-- Load pgTAP extension
SELECT plan(32);

-- ============================================================================
-- Test Setup: Create test roles and seed users
-- ============================================================================

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

INSERT INTO public.profiles (id, msisdn, name, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', '+250788000001', 'User One', 'passenger'),
  ('00000000-0000-0000-0000-000000000002', '+250788000002', 'User Two', 'passenger'),
  ('00000000-0000-0000-0000-000000000003', '+250788000003', 'Driver One', 'driver')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Tests 1-5: user_favorites owner isolation
-- ============================================================================

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'user_favorites'),
  'user_favorites has RLS enabled'
);

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text;

INSERT INTO public.user_favorites (user_id, kind, label, geog, is_default)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'home',
  'Home Base',
  ST_SetSRID(ST_MakePoint(30.0, -2.0), 4326),
  true
);

SELECT ok(
  EXISTS(
    SELECT 1 FROM public.user_favorites
    WHERE user_id = '00000000-0000-0000-0000-000000000001'
    AND label = 'Home Base'
  ),
  'User can insert own favorites'
);

SELECT throws_ok(
  $$INSERT INTO public.user_favorites (user_id, kind, label, geog)
    VALUES ('00000000-0000-0000-0000-000000000002', 'work', 'Other user', ST_SetSRID(ST_MakePoint(30.2, -2.2), 4326))$$,
  'User cannot insert favorites for another user'
);

RESET role;
SET LOCAL role = service_role;

INSERT INTO public.user_favorites (user_id, kind, label, geog)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'work',
  'Office',
  ST_SetSRID(ST_MakePoint(30.1, -2.1), 4326)
);

RESET role;
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text;

SELECT results_eq(
  $$SELECT user_id::text FROM public.user_favorites ORDER BY user_id$$,
  ARRAY['00000000-0000-0000-0000-000000000001']::text[],
  'User can only read own favorites'
);

RESET role;
SET LOCAL role = service_role;

SELECT ok(
  (SELECT COUNT(*) FROM public.user_favorites) >= 2,
  'Service role can read all favorites'
);

RESET role;

-- ============================================================================
-- Tests 6-10: driver_parking owner isolation
-- ============================================================================

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'driver_parking'),
  'driver_parking has RLS enabled'
);

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000003')::text;

INSERT INTO public.driver_parking (driver_id, label, geog)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'Downtown Stand',
  ST_SetSRID(ST_MakePoint(30.3, -2.3), 4326)
);

SELECT ok(
  EXISTS(
    SELECT 1 FROM public.driver_parking
    WHERE driver_id = '00000000-0000-0000-0000-000000000003'
  ),
  'Driver can insert own parking'
);

SELECT throws_ok(
  $$INSERT INTO public.driver_parking (driver_id, label, geog)
    VALUES ('00000000-0000-0000-0000-000000000001', 'Fake', ST_SetSRID(ST_MakePoint(30.4, -2.4), 4326))$$,
  'Driver cannot insert parking for another driver'
);

SELECT results_eq(
  $$SELECT driver_id::text FROM public.driver_parking$$,
  ARRAY['00000000-0000-0000-0000-000000000003']::text[],
  'Driver can only read own parking'
);

RESET role;
SET LOCAL role = service_role;

SELECT ok(
  (SELECT COUNT(*) FROM public.driver_parking) = 1,
  'Service role can read all parking rows'
);

RESET role;

-- ============================================================================
-- Tests 11-15: driver_availability owner isolation
-- ============================================================================

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'driver_availability'),
  'driver_availability has RLS enabled'
);

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000003')::text;

INSERT INTO public.driver_availability (
  driver_id,
  parking_id,
  days_of_week,
  start_time_local,
  end_time_local,
  timezone
) VALUES (
  '00000000-0000-0000-0000-000000000003',
  (SELECT id FROM public.driver_parking LIMIT 1),
  ARRAY[1,3,5],
  '07:00',
  '09:00',
  'Africa/Kigali'
);

SELECT ok(
  EXISTS(
    SELECT 1 FROM public.driver_availability
    WHERE driver_id = '00000000-0000-0000-0000-000000000003'
  ),
  'Driver can insert own availability'
);

SELECT throws_ok(
  $$INSERT INTO public.driver_availability (
      driver_id, days_of_week, start_time_local, end_time_local, timezone
    ) VALUES (
      '00000000-0000-0000-0000-000000000001',
      ARRAY[1,2],
      '12:00',
      '14:00',
      'Africa/Kigali'
    )$$,
  'Driver cannot insert availability for another driver'
);

SELECT results_eq(
  $$SELECT driver_id::text FROM public.driver_availability$$,
  ARRAY['00000000-0000-0000-0000-000000000003']::text[],
  'Driver can only read own availability'
);

RESET role;
SET LOCAL role = service_role;

SELECT ok(
  (SELECT COUNT(*) FROM public.driver_availability) = 1,
  'Service role can read all availability rows'
);

RESET role;

-- ============================================================================
-- Tests 16-20: recurring_trips owner isolation
-- ============================================================================

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'recurring_trips'),
  'recurring_trips has RLS enabled'
);

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text;

INSERT INTO public.recurring_trips (
  user_id,
  origin_favorite_id,
  dest_favorite_id,
  days_of_week,
  time_local,
  timezone,
  radius_km
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  (SELECT id FROM public.user_favorites WHERE user_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
  (SELECT id FROM public.user_favorites WHERE user_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
  ARRAY[1,5],
  '08:00',
  'Africa/Kigali',
  10.0
);

SELECT ok(
  EXISTS(
    SELECT 1 FROM public.recurring_trips
    WHERE user_id = '00000000-0000-0000-0000-000000000001'
  ),
  'User can insert own recurring trips'
);

SELECT throws_ok(
  $$INSERT INTO public.recurring_trips (
      user_id, origin_favorite_id, dest_favorite_id, days_of_week, time_local, timezone
    ) VALUES (
      '00000000-0000-0000-0000-000000000002',
      (SELECT id FROM public.user_favorites WHERE user_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
      (SELECT id FROM public.user_favorites WHERE user_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
      ARRAY[2,4],
      '09:00',
      'Africa/Kigali'
    )$$,
  'User cannot insert recurring trips for another user'
);

SELECT results_eq(
  $$SELECT user_id::text FROM public.recurring_trips$$,
  ARRAY['00000000-0000-0000-0000-000000000001']::text[],
  'User can only read own recurring trips'
);

RESET role;
SET LOCAL role = service_role;

SELECT ok(
  (SELECT COUNT(*) FROM public.recurring_trips) = 1,
  'Service role can read all recurring trips'
);

RESET role;

-- ============================================================================
-- Tests 21-27: deeplink tokens and events isolation
-- ============================================================================

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'deeplink_tokens'),
  'deeplink_tokens has RLS enabled'
);

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text;

INSERT INTO public.deeplink_tokens (
  token,
  flow,
  msisdn,
  max_uses,
  remaining_uses,
  expires_at,
  created_by
) VALUES (
  'token-user-one',
  'insurance',
  '+250788000001',
  3,
  3,
  timezone('utc', now()) + INTERVAL '7 days',
  '00000000-0000-0000-0000-000000000001'
);

SELECT ok(
  EXISTS(
    SELECT 1 FROM public.deeplink_tokens
    WHERE created_by = '00000000-0000-0000-0000-000000000001'
    AND token = 'token-user-one'
  ),
  'User can manage own deeplink tokens'
);

SELECT throws_ok(
  $$INSERT INTO public.deeplink_tokens (
      token, flow, msisdn, max_uses, remaining_uses, expires_at, created_by
    ) VALUES (
      'token-other-user',
      'insurance',
      '+250788000002',
      1,
      1,
      timezone('utc', now()) + INTERVAL '7 days',
      '00000000-0000-0000-0000-000000000002'
    )$$,
  'User cannot create tokens for another user'
);

SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000002')::text;

SELECT results_eq(
  $$SELECT token FROM public.deeplink_tokens ORDER BY token$$,
  ARRAY[]::text[],
  'Users cannot read deeplink tokens owned by others'
);

RESET role;
SET LOCAL role = service_role;

SELECT ok(
  (SELECT COUNT(*) FROM public.deeplink_tokens) = 1,
  'Service role can read all deeplink tokens'
);

INSERT INTO public.deeplink_events (token_id, event)
SELECT id, 'redeemed'
FROM public.deeplink_tokens
WHERE token = 'token-user-one';

RESET role;
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text;

SELECT ok(
  (SELECT COUNT(*) FROM public.my_deeplink_events WHERE token = 'token-user-one') = 1,
  'Owner can see own deeplink events via helper view'
);

RESET role;
SET LOCAL role = service_role;

SELECT ok(
  (SELECT COUNT(*) FROM public.deeplink_events) = 1,
  'Service role can manage deeplink events'
);

RESET role;

-- ============================================================================
-- Tests 28-32: router_logs tenant isolation
-- ============================================================================

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'router_logs'),
  'router_logs has RLS enabled'
);

SET LOCAL role = service_role;

INSERT INTO public.router_logs (
  tenant_id,
  message_id,
  text_snippet,
  route_key,
  status_code
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'wamid.test123',
  'test message',
  'insurance',
  'routed'
);

SELECT ok(
  EXISTS(SELECT 1 FROM public.router_logs WHERE message_id = 'wamid.test123'),
  'Service role can insert router logs'
);

RESET role;
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000002')::text;

SELECT results_eq(
  $$SELECT message_id FROM public.router_logs$$,
  ARRAY[]::text[],
  'User cannot read router logs for other tenants'
);

SET LOCAL request.jwt.claims = json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text;

SELECT ok(
  (SELECT COUNT(*) FROM public.router_logs WHERE tenant_id = '00000000-0000-0000-0000-000000000001') = 1,
  'Tenant owner can read their router logs'
);

RESET role;
SET LOCAL role = service_role;

SELECT ok(
  (SELECT COUNT(*) FROM public.router_logs) = 1,
  'Service role can read all router logs'
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

DELETE FROM public.router_logs WHERE message_id = 'wamid.test123';
DELETE FROM public.deeplink_events WHERE TRUE;
DELETE FROM public.deeplink_tokens WHERE token = 'token-user-one';
DELETE FROM public.recurring_trips WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.driver_availability WHERE driver_id = '00000000-0000-0000-0000-000000000003';
DELETE FROM public.driver_parking WHERE driver_id = '00000000-0000-0000-0000-000000000003';
DELETE FROM public.user_favorites WHERE user_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);
DELETE FROM public.profiles WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
);

SELECT * FROM finish();

ROLLBACK;
