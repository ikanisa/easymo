create extension if not exists postgis;

do $$ begin
  create type public.mobility_role as enum ('driver', 'passenger');
exception when duplicate_object then null;
end $$;

create table if not exists public.mobility_users (
  wa_id text primary key,
  display_name text,
  role_pref public.mobility_role,
  flow_state text not null default 'home' check (flow_state in ('home','choose_role','await_location','browse_results')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mobility_presence (
  wa_id text primary key references public.mobility_users(wa_id) on delete cascade,
  role public.mobility_role not null,
  geog geography(point, 4326) not null,
  updated_at timestamptz not null default now()
);

create index if not exists mobility_presence_geog_gix
  on public.mobility_presence using gist (geog);

create index if not exists mobility_presence_role_updated_idx
  on public.mobility_presence (role, updated_at desc);

create or replace function public.mobility_touch_user(p_wa_id text, p_display_name text)
returns void
language sql
as $$
  insert into public.mobility_users (wa_id, display_name)
  values (p_wa_id, nullif(p_display_name, ''))
  on conflict (wa_id) do update
    set display_name = coalesce(excluded.display_name, public.mobility_users.display_name),
        updated_at = now();
$$;

create or replace function public.mobility_set_flow(p_wa_id text, p_role public.mobility_role, p_flow_state text)
returns void
language sql
as $$
  update public.mobility_users
     set role_pref = p_role,
         flow_state = p_flow_state,
         updated_at = now()
   where wa_id = p_wa_id;
$$;

create or replace function public.mobility_upsert_presence(
  p_wa_id text,
  p_role public.mobility_role,
  p_lat double precision,
  p_lng double precision
)
returns void
language sql
as $$
  insert into public.mobility_presence (wa_id, role, geog, updated_at)
  values (
    p_wa_id,
    p_role,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    now()
  )
  on conflict (wa_id) do update
    set role = excluded.role,
        geog = excluded.geog,
        updated_at = now();
$$;

create or replace function public.mobility_find_nearby(
  p_wa_id text,
  p_target_role public.mobility_role,
  p_lat double precision,
  p_lng double precision,
  p_limit int default 9,
  p_max_km double precision default 5,
  p_ttl_minutes int default 30
)
returns table (
  wa_id text,
  display_name text,
  distance_m double precision,
  last_seen timestamptz
)
language sql
stable
as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
  )
  select
    p.wa_id,
    u.display_name,
    st_distance(p.geog, o.g) as distance_m,
    p.updated_at as last_seen
  from public.mobility_presence p
  join public.mobility_users u on u.wa_id = p.wa_id
  cross join origin o
  where p.role = p_target_role
    and p.wa_id <> p_wa_id
    and p.updated_at > now() - make_interval(mins => p_ttl_minutes)
    and st_dwithin(p.geog, o.g, (p_max_km * 1000.0))
  order by st_distance(p.geog, o.g) asc
  limit greatest(0, least(p_limit, 9));
$$;

alter table public.mobility_users enable row level security;
alter table public.mobility_presence enable row level security;
