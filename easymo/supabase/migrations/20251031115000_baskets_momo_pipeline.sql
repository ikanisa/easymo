-- MoMo SMS ingest and parsing tables.

BEGIN;

create table if not exists public.momo_sms_inbox (
  id uuid primary key default gen_random_uuid(),
  raw_text text not null,
  msisdn_raw text,
  received_at timestamptz not null default now(),
  ingest_source text,
  hash text not null
);

create unique index if not exists momo_sms_inbox_hash_key on public.momo_sms_inbox (hash);
create index if not exists idx_momo_sms_inbox_received_at on public.momo_sms_inbox (received_at);

create table if not exists public.momo_parsed_txns (
  id uuid primary key default gen_random_uuid(),
  inbox_id uuid not null references public.momo_sms_inbox(id) on delete cascade,
  msisdn_e164 text,
  sender_name text,
  amount numeric(12,2),
  currency text default 'RWF',
  txn_id text,
  txn_ts timestamptz,
  confidence numeric,
  parsed_json jsonb not null default '{}'::jsonb
);

create index if not exists idx_momo_parsed_txns_msisdn on public.momo_parsed_txns (msisdn_e164);
create unique index if not exists idx_momo_parsed_txns_txn on public.momo_parsed_txns (txn_id)
  where txn_id is not null;

create table if not exists public.momo_unmatched (
  id uuid primary key default gen_random_uuid(),
  parsed_id uuid not null references public.momo_parsed_txns(id) on delete cascade,
  reason text not null,
  suggested_member_id uuid references public.ibimina_members(id) on delete set null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

alter table public.momo_unmatched
  add constraint momo_unmatched_status_check
    check (status in ('open','resolved'));

create index if not exists idx_momo_unmatched_status on public.momo_unmatched (status);
create index if not exists idx_momo_unmatched_created on public.momo_unmatched (created_at);

COMMIT;
