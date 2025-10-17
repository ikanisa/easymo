-- Seed data for Phase-2 development environment.  These inserts provide
-- a basic set of rows so that the admin panel and simulator can be
-- exercised locally.  Do not run this in production.

-- Populate settings
insert into public.settings
  (subscription_price, search_radius_km, max_results, momo_payee_number, support_phone_e164, admin_whatsapp_numbers)
values
  (5000, 5, 10, '0780000000', '+250780000000', '250780000001,250780000002')
on conflict do nothing;

-- Create example profiles
insert into public.profiles (user_id, whatsapp_e164, ref_code, credits_balance)
values
  ('00000000-0000-0000-0000-000000000001', '+250780001001', '100001', 10),
  ('00000000-0000-0000-0000-000000000002', '+250780001002', '100002', 20),
  ('00000000-0000-0000-0000-000000000003', '+250780001003', '100003', 0)
on conflict (user_id) do nothing;

-- Add driver presence rows
insert into public.driver_presence (user_id, vehicle_type, lat, lng, last_seen, ref_code, whatsapp_e164)
values
  ('00000000-0000-0000-0000-000000000001', 'moto', -1.9511, 30.0589, now(), '100001', '+250780001001'),
  ('00000000-0000-0000-0000-000000000002', 'cab', -1.9522, 30.0650, now(), '100002', '+250780001002')
on conflict do nothing;

-- Sample trips
insert into public.trips (creator_user_id, role, vehicle_type, lat, lng, status)
values
  ('00000000-0000-0000-0000-000000000003', 'passenger', 'moto', -1.9500, 30.0600, null),
  ('00000000-0000-0000-0000-000000000002', 'driver', 'cab', -1.9550, 30.0700, null)
on conflict do nothing;

-- Sample subscriptions
insert into public.subscriptions (user_id, status, started_at, expires_at, amount, proof_url, created_at)
values
  ('00000000-0000-0000-0000-000000000001', 'active', now() - interval '5 days', now() + interval '25 days', 5000, null, now() - interval '5 days'),
  ('00000000-0000-0000-0000-000000000002', 'expired', now() - interval '40 days', now() - interval '10 days', 5000, null, now() - interval '40 days'),
  ('00000000-0000-0000-0000-000000000003', 'pending_review', null, null, 5000, null, now())
on conflict do nothing;
