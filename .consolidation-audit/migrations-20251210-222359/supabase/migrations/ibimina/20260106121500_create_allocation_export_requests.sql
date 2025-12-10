create schema if not exists app;

create table if not exists app.allocation_export_requests (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid references public.saccos(id) on delete set null,
  reference_token text,
  period_label text,
  status text not null default 'queued',
  requested_by uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  result_url text,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

comment on table app.allocation_export_requests is 'Queue of allocation export jobs triggered from the staff workspace.';
comment on column app.allocation_export_requests.reference_token is 'Reference token filter applied to the export, if provided.';
comment on column app.allocation_export_requests.period_label is 'Human readable label for the export window.';

create index if not exists idx_allocation_export_status on app.allocation_export_requests(status);
create index if not exists idx_allocation_export_requested_by on app.allocation_export_requests(requested_by);

alter table app.allocation_export_requests enable row level security;

create policy allocation_export_insert_service
  on app.allocation_export_requests
  for insert
  using (auth.role() = 'service_role')
  with check (true);

create policy allocation_export_select_requester
  on app.allocation_export_requests
  for select
  using (
    auth.role() = 'service_role'
    or (requested_by is not null and requested_by = auth.uid())
  );

create policy allocation_export_update_service
  on app.allocation_export_requests
  for update
  using (auth.role() = 'service_role');
