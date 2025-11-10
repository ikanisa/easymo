-- Minimal Phase-2 seed fixture.
-- Seeds settings, profiles, driver presence, trips, and subscriptions, matching the current schema.

begin;

insert into public.settings (id, subscription_price, search_radius_km, max_results, momo_payee_number, support_phone_e164, admin_whatsapp_numbers)
values
  (1, 5000, 6, 12, '0788000111', '+250780000444', '250780000111,250780000222')
on conflict (id) do update set
  subscription_price = excluded.subscription_price,
  search_radius_km = excluded.search_radius_km,
  max_results = excluded.max_results,
  momo_payee_number = excluded.momo_payee_number,
  support_phone_e164 = excluded.support_phone_e164,
  admin_whatsapp_numbers = excluded.admin_whatsapp_numbers;

insert into public.profiles (user_id, whatsapp_e164, metadata, locale, ref_code, credits_balance)
values
  ('00000000-0000-0000-0000-000000000001', '+250780001001', '{"role":"passenger"}'::jsonb, 'en', 'EMO101', 10),
  ('00000000-0000-0000-0000-000000000002', '+250780001002', '{"role":"driver"}'::jsonb, 'fr', 'EMO102', 5),
  ('00000000-0000-0000-0000-000000000003', '+250780001003', '{"role":"admin"}'::jsonb, 'en', 'OPS001', 0)
on conflict (user_id) do update set
  whatsapp_e164 = excluded.whatsapp_e164,
  metadata = excluded.metadata,
  locale = excluded.locale,
  ref_code = excluded.ref_code,
  credits_balance = excluded.credits_balance;

insert into public.driver_presence (user_id, vehicle_type, lat, lng, last_seen, ref_code, whatsapp_e164)
values
  ('00000000-0000-0000-0000-000000000002', 'moto', -1.9535, 30.0921, now(), 'EMO102', '+250780001002')
on conflict (user_id, vehicle_type) do update set
  lat = excluded.lat,
  lng = excluded.lng,
  last_seen = excluded.last_seen,
  ref_code = excluded.ref_code,
  whatsapp_e164 = excluded.whatsapp_e164;

insert into public.trips (id, creator_user_id, role, vehicle_type, pickup_lat, pickup_lng, status, created_at)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'passenger', 'moto', -1.9510, 30.0607, 'open', now() - interval '10 minutes'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000002', 'driver', 'cab', -1.9550, 30.0700, 'matched', now() - interval '3 hours')
on conflict (id) do update set
  creator_user_id = excluded.creator_user_id,
  role = excluded.role,
  vehicle_type = excluded.vehicle_type,
  pickup_lat = excluded.pickup_lat,
  pickup_lng = excluded.pickup_lng,
  status = excluded.status,
  created_at = excluded.created_at;

insert into public.subscriptions (id, user_id, status, started_at, expires_at, amount, proof_url, created_at)
values
  (5001, '00000000-0000-0000-0000-000000000001', 'active', now() - interval '20 days', now() + interval '10 days', 5000, 'https://example.com/proofs/5001', now() - interval '20 days'),
  (5002, '00000000-0000-0000-0000-000000000002', 'pending_review', null, null, 5000, 'https://example.com/proofs/5002', now() - interval '2 days')
on conflict (id) do update set
  user_id = excluded.user_id,
  status = excluded.status,
  started_at = excluded.started_at,
  expires_at = excluded.expires_at,
  amount = excluded.amount,
  proof_url = excluded.proof_url,
  created_at = excluded.created_at;

-- Minimal station data for downstream tests
do $seed$
declare
  station_kimironko uuid := '33333333-3333-3333-3333-333333333333';
begin
  insert into public.petrol_stations (id, name, city, owner_contact, status)
  values (station_kimironko, 'Kimironko Station', 'Kigali', '+250780010010', 'active')
  on conflict (id) do update set
    name = excluded.name,
    city = excluded.city,
    owner_contact = excluded.owner_contact,
    status = excluded.status;

  insert into public.station_numbers (station_id, wa_e164, role, active)
  values (station_kimironko, '+250780010011', 'manager', true)
  on conflict (station_id, wa_e164) do update set
    role = excluded.role,
    active = excluded.active;
end;
$seed$;

commit;
