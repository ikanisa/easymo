-- Phase B seed data for mobility admin and simulator flows
-- Usage: supabase db push --workdir supabase && psql "$DATABASE_URL" -f supabase/seed/fixtures/phase_b_seed.sql

with upsert_profiles as (
  insert into public.profiles (user_id, whatsapp_e164, ref_code, credits_balance)
  values
    ('00000000-0000-0000-0000-000000000101', '+250780001001', 'DRV001', 5000),
    ('00000000-0000-0000-0000-000000000102', '+250780001002', 'PSG001', 2500)
  on conflict (user_id) do update set whatsapp_e164 = excluded.whatsapp_e164
  returning user_id, ref_code
)
select 1;

-- Driver presence snapshots around Kigali
insert into public.driver_presence (user_id, vehicle_type, last_seen, lat, lng)
select user_id, 'moto', timezone('utc', now()), -1.9441, 30.0619
from public.profiles p
where ref_code = 'DRV001'
  and not exists (
    select 1 from public.driver_presence dp
    where dp.user_id = p.user_id and dp.vehicle_type = 'moto'
  );

insert into public.driver_presence (user_id, vehicle_type, last_seen, lat, lng)
select user_id, 'cab', timezone('utc', now() - interval '2 minutes'), -1.9499, 30.0588
from public.profiles p
where ref_code = 'DRV001'
  and not exists (
    select 1 from public.driver_presence dp
    where dp.user_id = p.user_id and dp.vehicle_type = 'cab'
  );

-- Active passenger trips
insert into public.trips (creator_user_id, role, vehicle_type, status, lat, lng)
select user_id, 'passenger', 'moto', 'active', -1.9505, 30.0604
from public.profiles where ref_code = 'PSG001'
limit 1;

insert into public.trips (creator_user_id, role, vehicle_type, status, lat, lng)
select user_id, 'passenger', 'cab', 'active', -1.9532, 30.0695
from public.profiles where ref_code = 'PSG001'
limit 1;

-- Subscriptions examples
insert into public.subscriptions (user_id, status, amount, txn_id, proof_url, started_at, expires_at)
select user_id, 'active', 5000, 'TXN-DRV-001', null,
       timezone('utc', now() - interval '5 days'),
       timezone('utc', now() + interval '25 days')
from public.profiles where ref_code = 'DRV001'
  and not exists (
    select 1 from public.subscriptions s where s.user_id = public.profiles.user_id and s.status = 'active'
  );

insert into public.subscriptions (user_id, status, amount, proof_url)
select user_id, 'pending_review', 5000, null
from public.profiles where ref_code = 'PSG001'
  and not exists (
    select 1 from public.subscriptions s where s.user_id = public.profiles.user_id and s.status = 'pending_review'
  );

-- Voucher sample campaign
insert into public.campaigns (id, name, description, status)
values ('11111111-1111-1111-1111-111111111111', 'Launch Incentive', 'Sample voucher campaign', 'active')
on conflict (id) do update set status = excluded.status;

insert into public.vouchers (id, user_id, campaign_id, code, status, value)
select '22222222-2222-2222-2222-222222222222', user_id, '11111111-1111-1111-1111-111111111111', 'VOUCHER-001', 'issued', 3000
from public.profiles where ref_code = 'PSG001'
on conflict (id) do update set status = excluded.status;

insert into public.voucher_events (voucher_id, event_type, actor_user_id, notes)
select '22222222-2222-2222-2222-222222222222', 'issued', user_id, 'Seed issue'
from public.profiles where ref_code = 'DRV001'
limit 1;

-- Insurance quote example
insert into public.insurance_quotes (id, user_id, vehicle_type, premium, status, quote_number)
select '33333333-3333-3333-3333-333333333333', user_id, 'moto', 18000, 'pending', 'QUOTE-001'
from public.profiles where ref_code = 'DRV001'
on conflict (id) do nothing;

-- Stations
insert into public.stations (id, name, code, whatsapp_e164)
values ('44444444-4444-4444-4444-444444444444', 'Kimironko Hub', 'KIM-01', '+250780009999')
on conflict (id) do update set whatsapp_e164 = excluded.whatsapp_e164;
