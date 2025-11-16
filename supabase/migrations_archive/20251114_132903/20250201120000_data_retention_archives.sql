BEGIN;

-- Data retention support: archive table for campaign targets
create table if not exists public.campaign_target_archives (
  id uuid default gen_random_uuid() primary key,
  target_id uuid not null,
  campaign_id uuid not null,
  msisdn_hash text not null,
  msisdn_masked text not null,
  status text,
  error_code text,
  last_update_at timestamptz,
  archived_at timestamptz default timezone('utc', now()) not null,
  metadata jsonb default '{}'::jsonb not null
);

create unique index if not exists campaign_target_archives_target_id_key
  on public.campaign_target_archives (target_id);
create index if not exists campaign_target_archives_campaign_idx
  on public.campaign_target_archives (campaign_id);

COMMIT;
