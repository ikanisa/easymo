-- Admin Panel Core Fixtures
-- ---------------------------------------------------------------------------
-- This script seeds the minimal data required for the admin panel to show
-- meaningful content (Dashboard KPIs, Users table, Simulator lookups,
-- Subscriptions list).  It is safe to run multiple times; inserts use
-- `ON CONFLICT DO NOTHING` or update existing rows.
--
-- Usage:
--   supabase db connect            # optional: open psql shell
--   \i supabase/seed/fixtures/admin_panel_core.sql
-- or paste into the Supabase SQL editor for project lhbowpbcpwoiparwnwgt.
--
-- All secrets / credentials remain placeholders.  Replace the fixture emails,
-- tokens, and WhatsApp numbers with anonymised staging-only values if needed.
--
-- NOTE: This script creates auth users with confirmed email/password so they
-- can satisfy the foreign key on `public.profiles`.  Passwords are random and
-- meant only for local/staging.
-- ---------------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------------
-- auth.users (three fixture accounts: two riders, one driver)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fixture_users constant jsonb := '[
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "email": "fixture.rider.one@example.com",
      "display_name": "Fixture Rider One"
    },
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "email": "fixture.rider.two@example.com",
      "display_name": "Fixture Rider Two"
    },
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "email": "fixture.driver.one@example.com",
      "display_name": "Fixture Driver One"
    }
  ]'::jsonb;
  record jsonb;
BEGIN
  FOR record IN SELECT * FROM jsonb_array_elements(fixture_users)
  LOOP
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      invited_at,
      last_sign_in_at,
      role,
      aud,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      (record->>'id')::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid,
      record->>'email',
      crypt('StagingPassw0rd!', gen_salt('bf')),
      now(),
      now(),
      now(),
      'authenticated',
      'authenticated',
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      jsonb_build_object('display_name', record->>'display_name'),
      now(),
      now()
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- public.profiles (attach ref codes & balances)
-- ---------------------------------------------------------------------------
INSERT INTO public.profiles (
  user_id,
  whatsapp_e164,
  ref_code,
  credits_balance,
  created_at
)
VALUES
  ('11111111-1111-4111-8111-111111111111', '+250780010001', 'RIDER001', 1200, now() - interval '21 days'),
  ('22222222-2222-4222-8222-222222222222', '+250780010002', 'RIDER002', 800, now() - interval '14 days'),
  ('33333333-3333-4333-8333-333333333333', '+250780020001', 'DRIVER001', 3500, now() - interval '28 days')
ON CONFLICT (whatsapp_e164) DO UPDATE
  SET ref_code = EXCLUDED.ref_code,
      credits_balance = EXCLUDED.credits_balance;

-- ---------------------------------------------------------------------------
-- public.settings (single global row)
-- ---------------------------------------------------------------------------
INSERT INTO public.settings (
  id,
  subscription_price,
  search_radius_km,
  max_results,
  momo_payee_number,
  support_phone_e164,
  admin_whatsapp_numbers,
  created_at,
  updated_at
)
VALUES (
  1,
  2500,
  5,
  10,
  '+250788000010',
  '+250788000011',
  ARRAY['+250788000012', '+250788000013'],
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE
  SET subscription_price = EXCLUDED.subscription_price,
      search_radius_km = EXCLUDED.search_radius_km,
      max_results = EXCLUDED.max_results,
      momo_payee_number = EXCLUDED.momo_payee_number,
      support_phone_e164 = EXCLUDED.support_phone_e164,
      admin_whatsapp_numbers = EXCLUDED.admin_whatsapp_numbers,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- public.driver_presence (two active drivers)
-- ---------------------------------------------------------------------------
INSERT INTO public.driver_presence (
  user_id,
  vehicle_type,
  lat,
  lng,
  last_seen,
  ref_code,
  whatsapp_e164
)
VALUES
  ('33333333-3333-4333-8333-333333333333', 'moto', -1.9445, 30.0610, now() - interval '2 minutes', 'DRIVER001', '+250780020001'),
  ('11111111-1111-4111-8111-111111111111', 'moto', -1.9503, 30.0587, now() - interval '8 minutes', 'RIDER001', '+250780010001')
ON CONFLICT (user_id, vehicle_type) DO UPDATE
  SET lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      last_seen = EXCLUDED.last_seen,
      ref_code = EXCLUDED.ref_code,
      whatsapp_e164 = EXCLUDED.whatsapp_e164;

-- ---------------------------------------------------------------------------
-- public.trips (sample open passenger request + historical driver trip)
-- ---------------------------------------------------------------------------
INSERT INTO public.trips (
  id,
  creator_user_id,
  role,
  vehicle_type,
  status,
  pickup,
  dropoff,
  pickup_lat,
  pickup_lng,
  dropoff_lat,
  dropoff_lng,
  pickup_text,
  dropoff_text,
  created_at
)
VALUES
  (
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-4111-8111-111111111111',
    'passenger',
    'moto',
    'open',
    ST_SetSRID(ST_MakePoint(30.0602, -1.9441), 4326)::geography,
    ST_SetSRID(ST_MakePoint(30.0625, -1.9488), 4326),
    -1.9441,
    30.0602,
    -1.9488,
    30.0625,
    'Downtown pickup',
    'Remera dropoff',
    now() - interval '5 minutes'
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    '33333333-3333-4333-8333-333333333333',
    'driver',
    'moto',
    'matched',
    ST_SetSRID(ST_MakePoint(30.0581, -1.9503), 4326)::geography,
    ST_SetSRID(ST_MakePoint(30.0650, -1.9490), 4326),
    -1.9503,
    30.0581,
    -1.9490,
    30.0650,
    'Kacyiru pickup',
    'Kimironko dropoff',
    now() - interval '1 hour'
  )
ON CONFLICT (id) DO UPDATE
  SET status = excluded.status,
      pickup = excluded.pickup,
      dropoff = excluded.dropoff,
      pickup_lat = excluded.pickup_lat,
      pickup_lng = excluded.pickup_lng,
      dropoff_lat = excluded.dropoff_lat,
      dropoff_lng = excluded.dropoff_lng,
      pickup_text = excluded.pickup_text,
      dropoff_text = excluded.dropoff_text,
      created_at = excluded.created_at;

-- ---------------------------------------------------------------------------
-- public.subscriptions (active + expired)
-- ---------------------------------------------------------------------------
INSERT INTO public.subscriptions (
  user_id,
  status,
  started_at,
  expires_at,
  amount,
  proof_url,
  txn_id
)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'active', now() - interval '2 days', now() + interval '28 days', 3000, 'https://example.com/receipts/rider-one.png', 'TXN-RIDER-001'),
  ('22222222-2222-4222-8222-222222222222', 'expired', now() - interval '40 days', now() - interval '10 days', 3000, null, 'TXN-RIDER-002')
ON CONFLICT DO NOTHING;

COMMIT;
