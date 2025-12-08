-- Mobility accept-match transactional function and uniqueness guard
-- Ensures driver/passenger pair is unique and status updates are atomic

begin;

-- Core table for mobility matches (creates if missing)
create table if not exists public.mobility_trip_matches (
  id uuid primary key default gen_random_uuid(),
  driver_trip_id uuid not null references public.trips(id) on delete cascade,
  passenger_trip_id uuid not null references public.trips(id) on delete cascade,
  driver_user_id uuid not null references public.profiles(user_id) on delete cascade,
  passenger_user_id uuid not null references public.profiles(user_id) on delete cascade,
  vehicle_type text,
  pickup_location geography(Point, 4326),
  dropoff_location geography(Point, 4326),
  pickup_address text,
  dropoff_address text,
  driver_phone text,
  passenger_phone text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_mobility_trip_matches_updated_at
  before update on public.mobility_trip_matches
  for each row
  execute procedure public.set_updated_at();

-- Enforce uniqueness at the database layer
create unique index if not exists uq_mobility_trip_matches_pair
  on public.mobility_trip_matches (driver_trip_id, passenger_trip_id);

-- Transactional accept-match helper
create or replace function public.accept_mobility_match(
  p_driver_trip_id uuid,
  p_passenger_trip_id uuid,
  p_driver_user_id uuid,
  p_passenger_user_id uuid
)
returns public.mobility_trip_matches
language plpgsql
as $$
declare
  v_driver_trip public.trips%rowtype;
  v_passenger_trip public.trips%rowtype;
  v_driver_profile record;
  v_passenger_profile record;
  v_match public.mobility_trip_matches%rowtype;
begin
  -- Return existing match if already created (idempotency)
  select * into v_match
  from public.mobility_trip_matches
  where driver_trip_id = p_driver_trip_id
    and passenger_trip_id = p_passenger_trip_id
  limit 1;

  if found then
    return v_match;
  end if;

  -- Fetch trips
  select * into v_driver_trip from public.trips where id = p_driver_trip_id for update;
  select * into v_passenger_trip from public.trips where id = p_passenger_trip_id for update;

  if v_driver_trip is null or v_passenger_trip is null then
    raise exception 'trip_not_found';
  end if;

  -- Fetch phone/contact info
  select whatsapp_e164, wa_id into v_driver_profile
  from public.profiles where user_id = p_driver_user_id;

  select whatsapp_e164, wa_id into v_passenger_profile
  from public.profiles where user_id = p_passenger_user_id;

  -- Insert match
  insert into public.mobility_trip_matches (
    driver_trip_id,
    passenger_trip_id,
    driver_user_id,
    passenger_user_id,
    vehicle_type,
    pickup_location,
    dropoff_location,
    pickup_address,
    dropoff_address,
    driver_phone,
    passenger_phone,
    status
  )
  values (
    p_driver_trip_id,
    p_passenger_trip_id,
    p_driver_user_id,
    p_passenger_user_id,
    v_driver_trip.vehicle_type,
    st_setsrid(st_makepoint(v_passenger_trip.pickup_lng, v_passenger_trip.pickup_lat), 4326)::geography,
    case 
      when v_passenger_trip.dropoff_lat is null then null
      else st_setsrid(st_makepoint(v_passenger_trip.dropoff_lng, v_passenger_trip.dropoff_lat), 4326)::geography
    end,
    v_passenger_trip.pickup_text,
    v_passenger_trip.dropoff_text,
    coalesce(v_driver_profile.whatsapp_e164, v_driver_profile.wa_id, ''),
    coalesce(v_passenger_profile.whatsapp_e164, v_passenger_profile.wa_id, ''),
    'pending'
  )
  returning * into v_match;

  return v_match;
end;
$$;

commit;
