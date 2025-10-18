-- Phase-2 seed fixture for the EasyMO admin panel.
-- Adds representative data across vouchers, campaigns, orders, and reminders.
-- Run via: `pnpm seed:remote` (which pipes this file through psql).

begin;

-- Settings ---------------------------------------------------------------
insert into public.settings (id, subscription_price, search_radius_km, max_results, momo_payee_number, support_phone_e164, admin_whatsapp_numbers)
values
  (1, 5000, 6, 12, '0788000111', '+250780000444', '250780000111,250780000222')
on conflict (id) do update
set subscription_price = excluded.subscription_price,
    search_radius_km = excluded.search_radius_km,
    max_results = excluded.max_results,
    momo_payee_number = excluded.momo_payee_number,
    support_phone_e164 = excluded.support_phone_e164,
    admin_whatsapp_numbers = excluded.admin_whatsapp_numbers;

-- Stations --------------------------------------------------------------
insert into public.stations (id, name, engencode, owner_contact, location_point, status)
values
  ('11111111-1111-1111-1111-111111111111', 'Kimironko Station', 'KIMI-001', '+250780010010', ST_SetSRID(ST_MakePoint(30.1051, -1.9392), 4326), 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Downtown Station', 'DT-002', '+250780020020', ST_SetSRID(ST_MakePoint(30.0604, -1.9463), 4326), 'active')
on conflict (engencode) do update set
  name = excluded.name,
  owner_contact = excluded.owner_contact,
  location_point = excluded.location_point,
  status = excluded.status;

-- Profiles --------------------------------------------------------------
insert into public.profiles (user_id, whatsapp_e164, ref_code, credits_balance, display_name, locale)
values
  ('00000000-0000-0000-0000-000000000001', '+250780001001', 'EMO101', 10, 'Imena Passenger', 'en'),
  ('00000000-0000-0000-0000-000000000002', '+250780001002', 'EMO102', 20, 'Claude Driver', 'fr'),
  ('00000000-0000-0000-0000-000000000003', '+250780001003', 'EMO103', 0, 'Ops Admin', 'en')
on conflict (user_id) do update set
  whatsapp_e164 = excluded.whatsapp_e164,
  ref_code = excluded.ref_code,
  credits_balance = excluded.credits_balance,
  display_name = excluded.display_name,
  locale = excluded.locale;

-- Driver presence -------------------------------------------------------
insert into public.driver_presence (user_id, vehicle_type, lat, lng, last_seen, ref_code, whatsapp_e164)
values
  ('00000000-0000-0000-0000-000000000002', 'moto', -1.9535, 30.0921, now(), 'EMO102', '+250780001002'),
  ('00000000-0000-0000-0000-000000000002', 'cab', -1.9522, 30.0650, now() - interval '30 minutes', 'EMO102', '+250780001002')
on conflict (user_id, vehicle_type) do update set
  lat = excluded.lat,
  lng = excluded.lng,
  last_seen = excluded.last_seen,
  ref_code = excluded.ref_code,
  whatsapp_e164 = excluded.whatsapp_e164;

-- Trips -----------------------------------------------------------------
insert into public.trips (id, creator_user_id, role, vehicle_type, lat, lng, status, created_at)
values
  ('00000000-0000-0000-0000-0000000T1001', '00000000-0000-0000-0000-000000000001', 'passenger', 'moto', -1.9510, 30.0607, 'open', now() - interval '10 minutes'),
  ('00000000-0000-0000-0000-0000000T1002', '00000000-0000-0000-0000-000000000002', 'driver', 'cab', -1.9550, 30.0700, 'completed', now() - interval '3 hours')
on conflict (id) do update set
  role = excluded.role,
  vehicle_type = excluded.vehicle_type,
  lat = excluded.lat,
  lng = excluded.lng,
  status = excluded.status,
  created_at = excluded.created_at;

-- Subscriptions ---------------------------------------------------------
insert into public.subscriptions (id, user_id, status, started_at, expires_at, amount, proof_url, created_at)
values
  (5001, '00000000-0000-0000-0000-000000000001', 'active', now() - interval '20 days', now() + interval '10 days', 5000, 'https://example.com/proofs/5001', now() - interval '20 days'),
  (5002, '00000000-0000-0000-0000-000000000002', 'pending_review', null, null, 5000, 'https://example.com/proofs/5002', now() - interval '2 days'),
  (5003, '00000000-0000-0000-0000-000000000003', 'expired', now() - interval '60 days', now() - interval '30 days', 5000, null, now() - interval '60 days')
on conflict (id) do update set
  status = excluded.status,
  started_at = excluded.started_at,
  expires_at = excluded.expires_at,
  amount = excluded.amount,
  proof_url = excluded.proof_url,
  created_at = excluded.created_at;

-- Campaigns & targets ---------------------------------------------------
insert into public.campaigns (id, name, type, status, template_id, metadata)
values
  ('33333333-3333-3333-3333-333333333333', 'Loyalty Revival', 'whatsapp', 'running', 'promo_template', '{"channel":"whatsapp"}'::jsonb),
  ('44444444-4444-4444-4444-444444444444', 'Weekend Promo', 'sms', 'draft', 'promo_template', '{"channel":"sms"}'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  status = excluded.status,
  template_id = excluded.template_id,
  metadata = excluded.metadata;

insert into public.campaign_targets (id, campaign_id, msisdn, personalized_vars, status)
values
  ('77777777-7777-7777-7777-777777777771', '33333333-3333-3333-3333-333333333333', '+250780001001', '{"first_name":"Imena"}'::jsonb, 'sent'),
  ('77777777-7777-7777-7777-777777777772', '33333333-3333-3333-3333-333333333333', '+250780001002', '{"first_name":"Claude"}'::jsonb, 'queued'),
  ('77777777-7777-7777-7777-777777777773', '44444444-4444-4444-4444-444444444444', '+250780001003', '{"first_name":"Ops"}'::jsonb, 'queued')
on conflict (id) do update set
  campaign_id = excluded.campaign_id,
  msisdn = excluded.msisdn,
  personalized_vars = excluded.personalized_vars,
  status = excluded.status,
  last_update_at = now();

-- Vouchers --------------------------------------------------------------
insert into public.vouchers (id, amount, currency, code5, station_scope, status, issued_at, metadata)
values
  ('88888888-8888-8888-8888-888888888881', 5000, 'RWF', 'KIMI5', '11111111-1111-1111-1111-111111111111', 'issued', now() - interval '1 day', '{"campaign":"Loyalty Revival"}'::jsonb),
  ('88888888-8888-8888-8888-888888888882', 7500, 'RWF', 'DT5', '22222222-2222-2222-2222-222222222222', 'redeemed', now() - interval '3 days', '{"campaign":"Weekend Promo"}'::jsonb)
on conflict (id) do update set
  amount = excluded.amount,
  currency = excluded.currency,
  station_scope = excluded.station_scope,
  status = excluded.status,
  issued_at = excluded.issued_at,
  metadata = excluded.metadata;

insert into public.voucher_events (id, voucher_id, type, status, note)
values
  ('99999999-9999-9999-9999-999999999991', '88888888-8888-8888-8888-888888888881', 'issued', 'success', 'Voucher created for Moto rider'),
  ('99999999-9999-9999-9999-999999999992', '88888888-8888-8888-8888-888888888882', 'redeemed', 'success', 'Voucher redeemed at Downtown station')
on conflict (id) do update set
  voucher_id = excluded.voucher_id,
  type = excluded.type,
  status = excluded.status,
  note = excluded.note;

-- Notifications ---------------------------------------------------------
insert into public.notifications (id, to_role, type, status, msisdn, metadata)
values
  ('55555555-5555-5555-5555-555555555551', 'admin', 'campaign_dispatch', 'sent', '+250780001001', '{"campaign":"Loyalty Revival"}'::jsonb),
  ('55555555-5555-5555-5555-555555555552', 'ops', 'reminder', 'queued', '+250780001002', '{"type":"order_pending"}'::jsonb)
on conflict (id) do update set
  to_role = excluded.to_role,
  type = excluded.type,
  status = excluded.status,
  msisdn = excluded.msisdn,
  metadata = excluded.metadata;

-- Orders & events -------------------------------------------------------
insert into public.orders (id, bar_id, bar_name, table_label, status, total, created_at, updated_at, staff_number)
values
  ('ORD-1001', '11111111-1111-1111-1111-111111111111', 'Kimironko Station', 'T1', 'open', 12000, now() - interval '5 minutes', now() - interval '5 minutes', 'SN-01'),
  ('ORD-1002', '22222222-2222-2222-2222-222222222222', 'Downtown Station', 'T3', 'completed', 18500, now() - interval '1 hour', now() - interval '30 minutes', 'SN-02')
on conflict (id) do update set
  bar_id = excluded.bar_id,
  bar_name = excluded.bar_name,
  table_label = excluded.table_label,
  status = excluded.status,
  total = excluded.total,
  updated_at = excluded.updated_at;

insert into public.order_events (id, order_id, type, status, note)
values
  ('OE-1001-1', 'ORD-1001', 'created', 'success', 'Order created from WA bot'),
  ('OE-1002-1', 'ORD-1002', 'created', 'success', 'Order created from admin panel'),
  ('OE-1002-2', 'ORD-1002', 'closed', 'success', 'Order closed after successful payment')
on conflict (id) do update set
  order_id = excluded.order_id,
  type = excluded.type,
  status = excluded.status,
  note = excluded.note;

commit;
