BEGIN;

-- Policy throttle counters for shared rate limiting state
create table if not exists public.policy_throttle_counters (
  bucket_id text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  limit_cap integer not null default 0,
  expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint policy_throttle_counters_pkey primary key (bucket_id, window_start)
);

create index if not exists policy_throttle_counters_window_idx
  on public.policy_throttle_counters (bucket_id, window_start desc);

create index if not exists policy_throttle_counters_expiry_idx
  on public.policy_throttle_counters (expires_at);

create trigger set_policy_throttle_counters_updated
  before update on public.policy_throttle_counters
  for each row execute function public.set_updated_at();

alter table public.policy_throttle_counters enable row level security;

drop policy if exists policy_throttle_counters_service_role on public.policy_throttle_counters;
create policy policy_throttle_counters_service_role on public.policy_throttle_counters
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Reliability queue for deferred persistence
create table if not exists public.reliability_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  available_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reliability_jobs_status_idx
  on public.reliability_jobs (status, available_at);

create index if not exists reliability_jobs_type_idx
  on public.reliability_jobs (job_type, status);

create trigger set_reliability_jobs_updated
  before update on public.reliability_jobs
  for each row execute function public.set_updated_at();

alter table public.reliability_jobs enable row level security;

drop policy if exists reliability_jobs_service_role on public.reliability_jobs;
create policy reliability_jobs_service_role on public.reliability_jobs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

COMMIT;
