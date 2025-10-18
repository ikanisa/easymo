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

-- Extended domain data (bars, campaigns, vouchers, notifications)
do $seed$
declare
  bar_kimironko uuid;
  bar_downtown uuid;
  template_loyalty bigint;
  campaign_loyalty bigint;
  contact_passenger bigint;
  station_kimironko uuid := '33333333-3333-3333-3333-333333333333';
  order_seed uuid;
begin
  insert into public.bars (slug, name, location_text, country, city_area, currency, is_active)
  values ('sunset-bar', 'Sunset Bar', 'Kigali City Tower', 'RW', 'Nyarugenge', 'RWF', true)
  on conflict (slug) do update set
    name = excluded.name,
    location_text = excluded.location_text,
    country = excluded.country,
    city_area = excluded.city_area,
    currency = excluded.currency,
    is_active = excluded.is_active
  returning id into bar_kimironko;

  insert into public.bars (slug, name, location_text, country, city_area, currency, is_active)
  values ('downtown-hub', 'Downtown Hub', 'KN 5 Ave', 'RW', 'Gasabo', 'RWF', true)
  on conflict (slug) do update set
    name = excluded.name,
    location_text = excluded.location_text,
    country = excluded.country,
    city_area = excluded.city_area,
    currency = excluded.currency,
    is_active = excluded.is_active
  returning id into bar_downtown;

  insert into public.bar_numbers (bar_id, number_e164, role, is_active)
  values
    (bar_kimironko, '+250780000010', 'manager', true),
    (bar_downtown, '+250780000020', 'manager', true)
  on conflict (bar_id, number_e164) do update set
    role = excluded.role,
    is_active = excluded.is_active;

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

  select id into template_loyalty from public.templates where name = 'loyalty_template';
  if template_loyalty is null then
    insert into public.templates (name, language_code, category, status, components)
    values ('loyalty_template', 'en', 'MARKETING', 'APPROVED', '{"body":{"text":"Thanks {{name}} for supporting EasyMO!"}}'::jsonb)
    returning id into template_loyalty;
  else
    update public.templates
      set language_code = 'en',
          category = 'MARKETING',
          status = 'APPROVED',
          components = '{"body":{"text":"Thanks {{name}} for supporting EasyMO!"}}'::jsonb
    where id = template_loyalty;
  end if;

  select id into campaign_loyalty from public.campaigns where title = 'Loyalty Revival';
  if campaign_loyalty is null then
    insert into public.campaigns (title, template_id, message_kind, payload, target_audience, status, time_zone)
    values ('Loyalty Revival', template_loyalty, 'TEMPLATE', '{"button":"Join now"}'::jsonb, '{"segment":"loyal"}'::jsonb, 'SENDING', 'Africa/Kigali')
    returning id into campaign_loyalty;
  else
    update public.campaigns
      set template_id = template_loyalty,
          message_kind = 'TEMPLATE',
          payload = '{"button":"Join now"}'::jsonb,
          target_audience = '{"segment":"loyal"}'::jsonb,
          status = 'SENDING',
          time_zone = 'Africa/Kigali'
    where id = campaign_loyalty;
  end if;

  insert into public.contacts (msisdn_e164, full_name, attributes, opted_in, opt_in_source)
  values ('+250780001001', 'Imena Passenger', '{"segment":"loyal"}'::jsonb, true, 'seed-data')
  on conflict (msisdn_e164) do update set
    full_name = excluded.full_name,
    attributes = excluded.attributes,
    opted_in = excluded.opted_in,
    opt_in_source = excluded.opt_in_source
  returning id into contact_passenger;

  insert into public.campaign_recipients (campaign_id, contact_id, msisdn_e164, send_allowed, window_24h_open)
  values (campaign_loyalty, contact_passenger, '+250780001001', true, true)
  on conflict (campaign_id, contact_id) do update set
    send_allowed = excluded.send_allowed,
    window_24h_open = excluded.window_24h_open;

  insert into public.orders (order_code, bar_id, table_label, status, subtotal_minor, service_charge_minor, total_minor, profile_id)
  values ('ORD-SEED-1', bar_kimironko, 'T1', 'paid', 12000, 1200, 13200, '00000000-0000-0000-0000-000000000001')
  on conflict (order_code) do update set
    bar_id = excluded.bar_id,
    status = excluded.status,
    subtotal_minor = excluded.subtotal_minor,
    service_charge_minor = excluded.service_charge_minor,
    total_minor = excluded.total_minor,
    profile_id = excluded.profile_id
  returning id into order_seed;

  delete from public.notifications
  where order_id = order_seed and notification_type = 'order_status';
  insert into public.notifications (order_id, to_wa_id, template_name, notification_type, channel, status, payload, sent_at)
  values (order_seed, '+250780001001', 'loyalty_template', 'order_status', 'template', 'sent', '{"order_code":"ORD-SEED-1"}'::jsonb, now());

  if exists (select 1 from public.vouchers where code_5 = '12345') then
    update public.vouchers
      set status = 'issued',
          amount_minor = 5000,
          notes = 'Seed voucher for QA',
          redeemed_by_station_id = station_kimironko,
          policy_number = 'POL-001',
          plate = 'RAE123A',
          qr_payload = 'seed-qr-12345',
          whatsapp_e164 = '+250780001001',
          user_id = '00000000-0000-0000-0000-000000000001',
          issued_by_admin = '00000000-0000-0000-0000-000000000003'
    where code_5 = '12345';
  else
    insert into public.vouchers (id, code_5, amount_minor, currency, status, user_id, whatsapp_e164, policy_number, plate, qr_payload, issued_by_admin, issued_at, redeemed_by_station_id, notes)
    values ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '12345', 5000, 'RWF', 'issued', '00000000-0000-0000-0000-000000000001', '+250780001001', 'POL-001', 'RAE123A', 'seed-qr-12345', '00000000-0000-0000-0000-000000000003', now() - interval '1 day', station_kimironko, 'Seed voucher for QA');
  end if;
end;
$seed$;

commit;
