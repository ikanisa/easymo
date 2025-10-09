-- SQL assertions for match_drivers_for_trip_v2() and match_passengers_for_trip_v2()
BEGIN;
SET LOCAL search_path TO public;

DO $$
DECLARE
  passenger_profile uuid := gen_random_uuid();
  driver_profile uuid := gen_random_uuid();
  driver_far_profile uuid := gen_random_uuid();
  driver_base_profile uuid := gen_random_uuid();
  passenger_candidate_profile uuid := gen_random_uuid();
  base_passenger_trip uuid := gen_random_uuid();
  nearby_driver_trip uuid := gen_random_uuid();
  far_driver_trip uuid := gen_random_uuid();
  base_driver_trip uuid := gen_random_uuid();
  nearby_passenger_trip uuid := gen_random_uuid();
  drivers_count int;
  passengers_count int;
  preferred RECORD;
BEGIN
  INSERT INTO public.profiles (user_id, whatsapp_e164)
  VALUES
    (passenger_profile, '+250780010001'),
    (driver_profile, '+250780010002'),
    (driver_far_profile, '+250780010003'),
    (driver_base_profile, '+250780010004'),
    (passenger_candidate_profile, '+250780010005');

  -- Base passenger requesting a moto trip
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
    base_passenger_trip,
    passenger_profile,
    'passenger',
    'moto',
    ST_SetSRID(ST_MakePoint(30.0580, -1.9500), 4326)::geography,
    ST_SetSRID(ST_MakePoint(30.0600, -1.9490), 4326)::geography,
    'Kigali Convention Centre',
    'UTC Mall',
    'open',
    timezone('utc', now()),
    timezone('utc', now())
  );

  -- Nearby driver offering same vehicle type inside radius
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
    nearby_driver_trip,
    driver_profile,
    'driver',
    'moto',
    ST_SetSRID(ST_MakePoint(30.0585, -1.9501), 4326)::geography,
    ST_SetSRID(ST_MakePoint(30.0605, -1.9495), 4326)::geography,
    'KCC Entrance',
    'UTC Mall',
    'open',
    timezone('utc', now()) - interval '2 minutes',
    timezone('utc', now()) - interval '2 minutes'
  );

  -- Far driver outside custom radius
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
    far_driver_trip,
    driver_far_profile,
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

  SELECT count(*)
    INTO drivers_count
    FROM public.match_drivers_for_trip_v2(base_passenger_trip, 5, false, 5000, 30);
  IF drivers_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one nearby driver match, found %', drivers_count;
  END IF;

  -- Drop-off preference should emit non-null bonus when both dropoffs provided
  SELECT * INTO preferred
  FROM public.match_drivers_for_trip_v2(base_passenger_trip, 1, true, 5000, 30);
  IF preferred.drop_bonus_m IS NULL THEN
    RAISE EXCEPTION 'Expected drop_bonus_m when _prefer_dropoff is true';
  END IF;

  -- Base driver searching for passengers
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
    base_driver_trip,
    driver_base_profile,
    'driver',
    'moto',
    ST_SetSRID(ST_MakePoint(30.0575, -1.9498), 4326)::geography,
    ST_SetSRID(ST_MakePoint(30.0610, -1.9485), 4326)::geography,
    'Kigali Heights',
    'City Tower',
    'open',
    timezone('utc', now()),
    timezone('utc', now())
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
    nearby_passenger_trip,
    passenger_candidate_profile,
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

  SELECT count(*)
    INTO passengers_count
    FROM public.match_passengers_for_trip_v2(base_driver_trip, 5, false, 5000, 30);
  IF passengers_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one nearby passenger match, found %', passengers_count;
  END IF;

  -- Cleanup inserted entities
  DELETE FROM public.trips WHERE id IN (base_passenger_trip, nearby_driver_trip, far_driver_trip, base_driver_trip, nearby_passenger_trip);
  DELETE FROM public.profiles WHERE user_id IN (passenger_profile, driver_profile, driver_far_profile, driver_base_profile, passenger_candidate_profile);
END;
$$;

ROLLBACK;
