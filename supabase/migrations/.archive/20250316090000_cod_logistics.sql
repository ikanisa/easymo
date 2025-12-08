-- Transaction wrapper for production safety
BEGIN;

-- Produce logistics + COD-first orchestration
set check_function_bodies = off;

create table if not exists public.logistics_partners (
  code text primary key,
  name text not null,
  supports_cod boolean default false,
  supports_prepay boolean default true,
  priority integer default 100,
  region text default 'rw',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

insert into public.logistics_partners (code, name, supports_cod, supports_prepay, priority, region, metadata)
values
  ('cod_rider', 'COD Rider Network', true, true, 10, 'rw', '{"channel":"whatsapp"}'::jsonb),
  ('kgl_cargo', 'Kigali Cargo Coop', true, false, 20, 'rw', '{"channel":"sip"}'::jsonb),
  ('lakehouse_fleet', 'LakeHouse Fleet', false, true, 50, 'rw', '{"channel":"api"}'::jsonb),
  ('agrinet_cod', 'AgriNet COD Dispatch', true, true, 5, 'rw', '{"channel":"voice","mode":"cod_first"}'::jsonb),
  ('express_harvest', 'Express Harvest Haulers', true, false, 15, 'rw', '{"channel":"sip","mode":"truck"}'::jsonb)
on conflict (code) do update set
  name = excluded.name,
  supports_cod = excluded.supports_cod,
  supports_prepay = excluded.supports_prepay,
  priority = excluded.priority,
  region = excluded.region,
  metadata = excluded.metadata;

create table if not exists public.produce_listings (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null,
  title text not null,
  description text,
  unit text default 'kg',
  available_quantity numeric default 0,
  status text default 'active' check (status in ('active','paused','sold_out')),
  photos jsonb default '[]'::jsonb,
  cod_enabled boolean default true,
  preferred_partner text references public.logistics_partners(code),
  video_opt_in boolean default false,
  sora_promo_status text default 'pending',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.produce_pickups (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.produce_listings(id) on delete cascade,
  partner_code text not null references public.logistics_partners(code),
  payment_mode text not null check (payment_mode in ('COD','PREPAID')),
  status text not null default 'scheduled',
  scheduled_for timestamptz,
  quantity numeric not null default 0,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.produce_inventory_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.produce_listings(id) on delete cascade,
  match_id uuid,
  change_amount numeric not null,
  snapshot_quantity numeric not null,
  reason text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create or replace function public.schedule_pickup(
  p_listing_id uuid,
  p_quantity numeric,
  p_cod_preferred boolean default true,
  p_requested_partner text default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
) returns public.produce_pickups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.produce_listings;
  v_partner text;
  v_partner_record public.logistics_partners%ROWTYPE;
  v_payment_mode text := 'PREPAID';
  v_pickup public.produce_pickups;
  v_cod_requested boolean := true;
  v_eta_minutes integer;
  v_scheduled_for timestamptz;
  v_pickup_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  select * into v_listing
  from public.produce_listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing % not found', p_listing_id;
  end if;

  v_cod_requested := coalesce(p_cod_preferred, true) and coalesce(v_listing.cod_enabled, true);

  v_partner := coalesce(p_requested_partner, v_listing.preferred_partner);

  if v_partner is not null then
    select * into v_partner_record
    from public.logistics_partners
    where code = v_partner
    limit 1;
  end if;

  if v_partner_record.code is null or (v_cod_requested and v_partner_record.supports_cod is false) then
    select *
    into v_partner_record
    from public.logistics_partners lp
    where (v_cod_requested is false or lp.supports_cod)
    order by case when lp.supports_cod then 0 else 1 end, lp.priority asc
    limit 1;
  end if;

  if v_partner_record.code is null then
    raise exception 'No logistics partner available for listing %', p_listing_id;
  end if;

  v_partner := v_partner_record.code;

  v_payment_mode := case when v_cod_requested and v_partner_record.supports_cod then 'COD' else 'PREPAID' end;

  v_eta_minutes := coalesce((p_metadata->>'pickup_eta_minutes')::int, 120);
  v_scheduled_for := now() + make_interval(mins => greatest(v_eta_minutes, 15));

  insert into public.produce_pickups (
    listing_id,
    partner_code,
    payment_mode,
    status,
    scheduled_for,
    quantity,
    notes,
    metadata
  ) values (
    p_listing_id,
    v_partner,
    v_payment_mode,
    'scheduled',
    v_scheduled_for,
    coalesce(p_quantity, 0),
    p_notes,
    v_pickup_metadata || jsonb_build_object(
      'partner', v_partner,
      'cod_requested', v_cod_requested,
      'partner_metadata', coalesce(v_partner_record.metadata, '{}'::jsonb)
    )
  ) returning * into v_pickup;

  insert into public.produce_inventory_events (
    listing_id,
    match_id,
    change_amount,
    snapshot_quantity,
    reason,
    metadata
  ) values (
    p_listing_id,
    null,
    0,
    v_listing.available_quantity,
    'pickup_scheduled',
    jsonb_build_object(
      'partner', v_partner,
      'payment_mode', v_payment_mode,
      'cod_requested', v_cod_requested,
      'partner_channel', v_partner_record.metadata ->> 'channel'
    ) || v_pickup_metadata
  );

  update public.produce_listings
  set updated_at = now()
  where id = p_listing_id;

  return v_pickup;
end;
$$;

create or replace function public.update_inventory_after_match(
  p_listing_id uuid,
  p_match_id uuid,
  p_quantity numeric,
  p_metadata jsonb default '{}'::jsonb
) returns table (
  listing_id uuid,
  remaining_quantity numeric,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.produce_listings;
  v_remaining numeric;
  v_status text;
  v_auto_schedule boolean;
  v_cod_preferred boolean;
  v_requested_partner text;
  v_pickup_quantity numeric;
  v_pickup_notes text;
  v_pickup_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_auto_pickup public.produce_pickups%ROWTYPE;
  v_auto_pickup_id uuid;
  v_auto_pickup_partner text;
  v_auto_pickup_mode text;
begin
  select * into v_listing
  from public.produce_listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing % not found', p_listing_id;
  end if;

  v_remaining := greatest(v_listing.available_quantity - coalesce(p_quantity, 0), 0);
  v_status := case when v_remaining = 0 then 'sold_out' else v_listing.status end;

  v_auto_schedule := coalesce((p_metadata->>'auto_schedule_pickup')::boolean, false);
  v_cod_preferred := coalesce((p_metadata->>'cod_preferred')::boolean, v_listing.cod_enabled);
  v_requested_partner := coalesce(p_metadata->>'requested_partner', v_listing.preferred_partner);
  v_pickup_quantity := coalesce((p_metadata->>'pickup_quantity')::numeric, p_quantity);
  v_pickup_notes := coalesce(p_metadata->>'pickup_notes', 'Auto scheduled after match');

  if v_auto_schedule and coalesce(v_pickup_quantity, 0) > 0 then
    begin
      select schedule_pickup(
        p_listing_id,
        v_pickup_quantity,
        v_cod_preferred,
        v_requested_partner,
        v_pickup_notes,
        v_pickup_metadata || jsonb_build_object('match_id', p_match_id, 'auto_schedule_pickup', true)
      ) into v_auto_pickup;

      if v_auto_pickup.id is not null then
        v_auto_pickup_id := v_auto_pickup.id;
        v_auto_pickup_partner := v_auto_pickup.partner_code;
        v_auto_pickup_mode := v_auto_pickup.payment_mode;
      end if;
    exception when others then
      raise notice 'Auto pickup scheduling failed for listing %: %', p_listing_id, SQLERRM;
      v_auto_pickup_id := null;
      v_auto_pickup_partner := null;
      v_auto_pickup_mode := null;
    end;
  end if;

  update public.produce_listings
  set available_quantity = v_remaining,
      status = v_status,
      updated_at = now()
  where id = p_listing_id;

  insert into public.produce_inventory_events (
    listing_id,
    match_id,
    change_amount,
    snapshot_quantity,
    reason,
    metadata
  ) values (
    p_listing_id,
    p_match_id,
    -1 * coalesce(p_quantity, 0),
    v_remaining,
    'match_consumed',
    v_pickup_metadata ||
    case when v_auto_pickup_id is not null then
      jsonb_build_object(
        'auto_pickup_id', v_auto_pickup_id,
        'auto_pickup_partner', v_auto_pickup_partner,
        'auto_pickup_payment_mode', v_auto_pickup_mode
      )
    else '{}'::jsonb end
  );

  return query select p_listing_id, v_remaining, v_status;
end;
$$;

alter table public.produce_listings enable row level security;
alter table public.produce_pickups enable row level security;
alter table public.produce_inventory_events enable row level security;

DROP POLICY IF EXISTS "svc_rw_produce_listings" ON public.produce_listings;
DROP POLICY IF EXISTS "svc_rw_produce_listings" ON public.produce_listings;
create policy "svc_rw_produce_listings" on public.produce_listings for all using (auth.role() = 'service_role') with check (true);
DROP POLICY IF EXISTS "svc_rw_produce_pickups" ON public.produce_pickups;
DROP POLICY IF EXISTS "svc_rw_produce_pickups" ON public.produce_pickups;
create policy "svc_rw_produce_pickups" on public.produce_pickups for all using (auth.role() = 'service_role') with check (true);
DROP POLICY IF EXISTS "svc_rw_produce_inventory_events" ON public.produce_inventory_events;
DROP POLICY IF EXISTS "svc_rw_produce_inventory_events" ON public.produce_inventory_events;
create policy "svc_rw_produce_inventory_events" on public.produce_inventory_events for all using (auth.role() = 'service_role') with check (true);

grant all on table public.logistics_partners to postgres, anon, authenticated, service_role;
grant all on table public.produce_listings to postgres, anon, authenticated, service_role;
grant all on table public.produce_pickups to postgres, anon, authenticated, service_role;
grant all on table public.produce_inventory_events to postgres, anon, authenticated, service_role;

COMMIT;
