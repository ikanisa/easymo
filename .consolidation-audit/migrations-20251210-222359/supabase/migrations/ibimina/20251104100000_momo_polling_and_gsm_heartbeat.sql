-- Automation scaffolding for MoMo statement polling and GSM heartbeats
set search_path = app, public;

create table if not exists app.momo_statement_pollers (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid references app.saccos(id) on delete set null,
  provider text not null default 'MTN',
  display_name text not null default 'Default MoMo Poller',
  endpoint_url text not null,
  auth_header text,
  cursor text,
  polling_interval_seconds integer not null default 900,
  status text not null default 'ACTIVE',
  last_polled_at timestamptz,
  last_latency_ms integer,
  last_polled_count integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table app.momo_statement_pollers is 'Configuration for automated MoMo statement polling workers.';
comment on column app.momo_statement_pollers.cursor is 'Provider issued cursor for incremental polling.';
comment on column app.momo_statement_pollers.last_latency_ms is 'Average latency, in milliseconds, for the last polling batch.';
comment on column app.momo_statement_pollers.last_polled_count is 'Number of statements discovered in the last poll.';

create index if not exists idx_momo_statement_pollers_status on app.momo_statement_pollers(status);
create index if not exists idx_momo_statement_pollers_sacco on app.momo_statement_pollers(sacco_id);

create table if not exists app.momo_statement_staging (
  id uuid primary key default gen_random_uuid(),
  poller_id uuid not null references app.momo_statement_pollers(id) on delete cascade,
  external_id text not null,
  sacco_id uuid references app.saccos(id) on delete set null,
  payload jsonb not null,
  statement_date date,
  status text not null default 'PENDING',
  latency_ms integer,
  error text,
  queued_job_id uuid,
  polled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table app.momo_statement_staging is 'Raw statements fetched from MoMo integrations awaiting reconciliation jobs.';
comment on column app.momo_statement_staging.latency_ms is 'End-to-end latency between statement timestamp and polling time.';

create unique index if not exists uq_momo_statement_staging_external on app.momo_statement_staging(poller_id, external_id);
create index if not exists idx_momo_statement_staging_status on app.momo_statement_staging(status);

create table if not exists app.reconciliation_jobs (
  id uuid primary key default gen_random_uuid(),
  staging_id uuid references app.momo_statement_staging(id) on delete set null,
  sacco_id uuid references app.saccos(id) on delete set null,
  job_type text not null default 'STATEMENT_SYNC',
  status text not null default 'PENDING',
  attempts integer not null default 0,
  last_error text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  latency_ms integer,
  meta jsonb default '{}'::jsonb
);

comment on table app.reconciliation_jobs is 'Queue of reconciliation automation tasks created from MoMo polling.';

create index if not exists idx_reconciliation_jobs_status on app.reconciliation_jobs(status);
create index if not exists idx_reconciliation_jobs_type on app.reconciliation_jobs(job_type);

alter table if exists app.momo_statement_staging
  add constraint fk_momo_statement_staging_job
  foreign key (queued_job_id)
  references app.reconciliation_jobs(id)
  on delete set null;

create table if not exists app.sms_gateway_endpoints (
  id uuid primary key default gen_random_uuid(),
  gateway text not null default 'primary',
  display_name text not null default 'Primary GSM Modem',
  health_url text not null,
  auth_header text,
  expected_keyword text,
  status text not null default 'ACTIVE',
  last_status text,
  last_heartbeat_at timestamptz,
  last_latency_ms integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table app.sms_gateway_endpoints is 'Configured GSM/SMS gateway heartbeat targets.';

create index if not exists idx_sms_gateway_endpoints_status on app.sms_gateway_endpoints(status);
create unique index if not exists uq_sms_gateway_endpoint_gateway on app.sms_gateway_endpoints(gateway);

create table if not exists app.sms_gateway_heartbeats (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references app.sms_gateway_endpoints(id) on delete cascade,
  status text not null,
  latency_ms integer,
  checked_at timestamptz not null default now(),
  error text,
  meta jsonb default '{}'::jsonb
);

comment on table app.sms_gateway_heartbeats is 'Historical log of GSM heartbeat probes.';

create index if not exists idx_sms_gateway_heartbeats_endpoint on app.sms_gateway_heartbeats(endpoint_id);
create index if not exists idx_sms_gateway_heartbeats_checked on app.sms_gateway_heartbeats(checked_at desc);

alter table app.momo_statement_pollers enable row level security;
alter table app.momo_statement_staging enable row level security;
alter table app.reconciliation_jobs enable row level security;
alter table app.sms_gateway_endpoints enable row level security;
alter table app.sms_gateway_heartbeats enable row level security;

alter table app.momo_statement_pollers force row level security;
alter table app.momo_statement_staging force row level security;
alter table app.reconciliation_jobs force row level security;
alter table app.sms_gateway_endpoints force row level security;
alter table app.sms_gateway_heartbeats force row level security;

-- Service role bypasses RLS, no additional policies required for automation prototypes.
