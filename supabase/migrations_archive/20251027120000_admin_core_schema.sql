-- Minimal admin core schema snapshot for tests
create table if not exists public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  station_id uuid,
  created_at timestamptz default now()
);

create unique index if not exists qr_tokens_token_key on public.qr_tokens(token);
create index if not exists qr_tokens_station_idx on public.qr_tokens(station_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  status text,
  created_at timestamptz default now()
);

alter table public.notifications add column metadata jsonb;

