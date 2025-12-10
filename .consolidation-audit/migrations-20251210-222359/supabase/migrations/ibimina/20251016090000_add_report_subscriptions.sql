set search_path = app, public, auth;

create table if not exists app.report_subscriptions (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid not null references app.saccos(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  email text not null,
  frequency text not null check (frequency in ('DAILY','WEEKLY','MONTHLY')),
  format text not null check (format in ('PDF','CSV')),
  delivery_hour smallint not null default 6 check (delivery_hour between 0 and 23),
  delivery_day smallint,
  filters jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz not null default timezone('UTC', now()),
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

drop trigger if exists report_subscriptions_touch_updated_at on app.report_subscriptions;
create trigger report_subscriptions_touch_updated_at
before update on app.report_subscriptions
for each row
execute function public.set_updated_at();

create index if not exists idx_report_subscriptions_sacco_active
  on app.report_subscriptions (sacco_id, is_active);

create index if not exists idx_report_subscriptions_next_run
  on app.report_subscriptions (next_run_at);

alter table app.report_subscriptions enable row level security;

drop policy if exists report_subscriptions_select on app.report_subscriptions;
create policy report_subscriptions_select
  on app.report_subscriptions
  for select
  using (app.is_admin() or sacco_id = app.current_sacco());

drop policy if exists report_subscriptions_insert on app.report_subscriptions;
create policy report_subscriptions_insert
  on app.report_subscriptions
  for insert
  with check (app.is_admin() or sacco_id = app.current_sacco());

drop policy if exists report_subscriptions_update on app.report_subscriptions;
create policy report_subscriptions_update
  on app.report_subscriptions
  for update
  using (app.is_admin() or sacco_id = app.current_sacco())
  with check (app.is_admin() or sacco_id = app.current_sacco());

drop policy if exists report_subscriptions_delete on app.report_subscriptions;
create policy report_subscriptions_delete
  on app.report_subscriptions
  for delete
  using (app.is_admin() or sacco_id = app.current_sacco());

comment on table app.report_subscriptions is 'Scheduled SACCO report exports managed from the Ibimina reports workspace.';
comment on column app.report_subscriptions.filters is 'JSON filter payload (saccoId, from, to).';
comment on column app.report_subscriptions.delivery_hour is 'Hour of day (UTC) to queue the export.';
comment on column app.report_subscriptions.delivery_day is 'For WEEKLY (0-6 Sunday-Saturday) or MONTHLY (1-28) schedules.';
