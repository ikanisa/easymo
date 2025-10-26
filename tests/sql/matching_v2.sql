\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;
SET LOCAL search_path TO public;

SELECT plan(3);

CREATE TEMP TABLE matching_ids(key text PRIMARY KEY, id uuid);

INSERT INTO matching_ids(key, id) VALUES
  ('passenger_profile', gen_random_uuid()),
  ('driver_profile', gen_random_uuid()),
  ('driver_far_profile', gen_random_uuid()),
  ('driver_base_profile', gen_random_uuid()),
  ('passenger_candidate_profile', gen_random_uuid()),
  ('base_passenger_trip', gen_random_uuid()),
  ('nearby_driver_trip', gen_random_uuid()),
  ('far_driver_trip', gen_random_uuid()),
  ('base_driver_trip', gen_random_uuid()),
  ('nearby_passenger_trip', gen_random_uuid());

INSERT INTO public.profiles (user_id, whatsapp_e164)
VALUES
  ((SELECT id FROM matching_ids WHERE key = 'passenger_profile'), '+250780010001'),
  ((SELECT id FROM matching_ids WHERE key = 'driver_profile'), '+250780010002'),
  ((SELECT id FROM matching_ids WHERE key = 'driver_far_profile'), '+250780010003'),
  ((SELECT id FROM matching_ids WHERE key = 'driver_base_profile'), '+250780010004'),
  ((SELECT id FROM matching_ids WHERE key = 'passenger_candidate_profile'), '+250780010005');

INSERT INTO public.trips (
  id,
  creator_user_id,
  role,
  vehicle_type,
  pickup,
  dropoff,
  pickup_text,
  dropoff_text,
  status,
  created_at,
  updated_at
)
VALUES (
  (SELECT id FROM matching_ids WHERE key = 'base_passenger_trip'),
  (SELECT id FROM matching_ids WHERE key = 'passenger_profile'),
  'passenger',
  'moto',
  ST_SetSRID(ST_MakePoint(30.0580, -1.9500), 4326)::geography,
  ST_SetSRID(ST_MakePoint(30.0600, -1.9490), 4326)::geography,
  'Kigali Convention Centre',
  'UTC Mall',
  'open',
  timezone('utc', now()),
  timezone('utc', now())
), (
  (SELECT id FROM matching_ids WHERE key = 'nearby_driver_trip'),
  (SELECT id FROM matching_ids WHERE key = 'driver_profile'),
  'driver',
  'moto',
  ST_SetSRID(ST_MakePoint(30.0585, -1.9501), 4326)::geography,
  ST_SetSRID(ST_MakePoint(30.0605, -1.9495), 4326)::geography,
  'KCC Entrance',
  'UTC Mall',
  'open',
  timezone('utc', now()) - interval '2 minutes',
  timezone('utc', now()) - interval '2 minutes'
), (
  (SELECT id FROM matching_ids WHERE key = 'far_driver_trip'),
  (SELECT id FROM matching_ids WHERE key = 'driver_far_profile'),
  'driver',
  'moto',
  ST_SetSRID(ST_MakePoint(30.1000, -1.9400), 4326)::geography,
  ST_SetSRID(ST_MakePoint(30.1100, -1.9300), 4326)::geography,
  'Airport',
  'Downtown',
  'open',
  timezone('utc', now()) - interval '1 hour',
  timezone('utc', now()) - interval '1 hour'
);

SELECT is(
  (
    SELECT count(*)
      FROM public.match_drivers_for_trip_v2(
        (SELECT id FROM matching_ids WHERE key = 'base_passenger_trip'),
        5,
        false,
        5000,
        30
      )
  ),
  1::bigint,
  'returns exactly one nearby driver match within the radius'
);

WITH preferred AS (
  SELECT drop_bonus_m
    FROM public.match_drivers_for_trip_v2(
      (SELECT id FROM matching_ids WHERE key = 'base_passenger_trip'),
      1,
      true,
      5000,
      30
    )
    LIMIT 1
)
SELECT isnt_null(
  (SELECT drop_bonus_m FROM preferred),
  'includes drop_bonus_m when drop-off preference is requested'
);

INSERT INTO public.trips (
  id,
  creator_user_id,
  role,
  vehicle_type,
  pickup,
  dropoff,
  pickup_text,
  dropoff_text,
  status,
  created_at,
  updated_at
)
VALUES (
  (SELECT id FROM matching_ids WHERE key = 'base_driver_trip'),
  (SELECT id FROM matching_ids WHERE key = 'driver_base_profile'),
  'driver',
  'moto',
  ST_SetSRID(ST_MakePoint(30.0575, -1.9498), 4326)::geography,
  ST_SetSRID(ST_MakePoint(30.0610, -1.9485), 4326)::geography,
  'Kigali Heights',
  'City Tower',
  'open',
  timezone('utc', now()),
  timezone('utc', now())
), (
  (SELECT id FROM matching_ids WHERE key = 'nearby_passenger_trip'),
  (SELECT id FROM matching_ids WHERE key = 'passenger_candidate_profile'),
  'passenger',
  'moto',
  ST_SetSRID(ST_MakePoint(30.0578, -1.9496), 4326)::geography,
  ST_SetSRID(ST_MakePoint(30.0612, -1.9486), 4326)::geography,
  'Kigali Heights',
  'City Tower',
  'open',
  timezone('utc', now()) - interval '3 minutes',
  timezone('utc', now()) - interval '3 minutes'
);

SELECT is(
  (
    SELECT count(*)
      FROM public.match_passengers_for_trip_v2(
        (SELECT id FROM matching_ids WHERE key = 'base_driver_trip'),
        5,
        false,
        5000,
        30
      )
  ),
  1::bigint,
  'returns exactly one nearby passenger match for the driver'
);

SELECT * FROM finish();

ROLLBACK;
