-- SQL assertions for search_live_market_candidates()
BEGIN;
SET LOCAL search_path TO public;

DO $$
DECLARE
  driver_profile uuid := gen_random_uuid();
  passenger_a uuid := gen_random_uuid();
  passenger_b uuid := gen_random_uuid();
  passenger_c uuid := gen_random_uuid();
  trip_a uuid := gen_random_uuid();
  trip_b uuid := gen_random_uuid();
  trip_c uuid := gen_random_uuid();
  dual_matches int;
  pickup_lat double precision := -1.9445;
  pickup_lng double precision := 30.0610;
  drop_lat double precision := -1.9490;
  drop_lng double precision := 30.0640;
BEGIN
  INSERT INTO public.profiles (user_id, whatsapp_e164)
  VALUES
    (driver_profile, '+250780020001'),
    (passenger_a, '+250780020002'),
    (passenger_b, '+250780020003'),
    (passenger_c, '+250780020004');

  -- Candidate A within 10 km for both pickup and dropoff
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
    ST_SetSRID(ST_MakePoint(30.0620, -1.9450), 4326)::geography,
    ST_SetSRID(ST_MakePoint(30.0635, -1.9485), 4326)::geography,
    'open',
    timezone('utc', now()) - interval '1 minute'
  );

  -- Candidate B: pickup close but dropoff outside drop radius
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
    ST_SetSRID(ST_MakePoint(30.0605, -1.9460), 4326)::geography,
    ST_SetSRID(ST_MakePoint(30.1200, -1.9100), 4326)::geography,
    'open',
    timezone('utc', now()) - interval '5 minute'
  );

  -- Candidate C: dropoff near but pickup outside radius
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
    ST_SetSRID(ST_MakePoint(30.1800, -1.9300), 4326)::geography,
    ST_SetSRID(ST_MakePoint(30.0630, -1.9480), 4326)::geography,
    'open',
    timezone('utc', now()) - interval '2 minute'
  );

  BEGIN
    PERFORM public.refresh_live_market_mv();
  EXCEPTION
    WHEN undefined_function THEN
      NULL;
  END;

  SELECT count(*)
    INTO dual_matches
    FROM public.search_live_market_candidates(
      'driver',
      pickup_lat,
      pickup_lng,
      drop_lat,
      drop_lng,
      10,
      10
    )
    WHERE candidate_id = trip_a;

  IF dual_matches <> 1 THEN
    RAISE EXCEPTION 'Expected candidate A to match dual constraint';
  END IF;

  SELECT count(*)
    INTO dual_matches
    FROM public.search_live_market_candidates(
      'driver',
      pickup_lat,
      pickup_lng,
      drop_lat,
      drop_lng,
      10,
      10
    );

  IF dual_matches <> 1 THEN
    RAISE EXCEPTION 'Expected only one candidate to satisfy both constraints, found %', dual_matches;
  END IF;

  -- Without dropoff only pickup radius should include candidate B
  SELECT count(*)
    INTO dual_matches
    FROM public.search_live_market_candidates(
      'driver',
      pickup_lat,
      pickup_lng,
      NULL,
      NULL,
      10,
      10
    );

  IF dual_matches < 2 THEN
    RAISE EXCEPTION 'Pickup-only search should include additional candidates';
  END IF;

  DELETE FROM public.trips WHERE id IN (trip_a, trip_b, trip_c);
  DELETE FROM public.profiles WHERE user_id IN (driver_profile, passenger_a, passenger_b, passenger_c);
END;
$$;

ROLLBACK;
