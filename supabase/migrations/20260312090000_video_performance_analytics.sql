-- Video performance analytics schema
-- Captures render jobs, approval workflows, and aggregated metrics

set check_function_bodies = off;

create table if not exists public.video_jobs (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid,
  slot text not null,
  template_id uuid,
  template_label text,
  hook_id uuid,
  hook_label text,
  cta_variant text,
  script_version text,
  rights_expiry_at timestamptz,
  renders integer default 0 not null,
  render_cost_cents integer default 0 not null,
  render_currency text default 'USD'::text not null,
  approvals_count integer default 0 not null,
  changes_requested_count integer default 0 not null,
  whatsapp_clicks integer default 0 not null,
  last_whatsapp_click_at timestamptz,
  last_approval_at timestamptz,
  last_requested_change_at timestamptz,
  notes text,
  status text default 'draft'::text not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists video_jobs_slot_idx on public.video_jobs(slot);
create index if not exists video_jobs_campaign_idx on public.video_jobs(campaign_id);
create index if not exists video_jobs_status_idx on public.video_jobs(status);
create index if not exists video_jobs_rights_expiry_idx on public.video_jobs(rights_expiry_at) where rights_expiry_at is not null;

create table if not exists public.video_approvals (
  id uuid default gen_random_uuid() primary key,
  job_id uuid not null references public.video_jobs(id) on delete cascade,
  reviewer_id uuid,
  reviewer_name text,
  status text default 'pending'::text not null check (status in ('pending','approved','changes_requested')),
  summary text,
  requested_changes text,
  whatsapp_clicks integer default 0 not null,
  last_whatsapp_click_at timestamptz,
  approved_at timestamptz,
  changes_requested_at timestamptz,
  recorded_at timestamptz default timezone('utc'::text, now()) not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists video_approvals_job_idx on public.video_approvals(job_id);
create index if not exists video_approvals_status_idx on public.video_approvals(job_id, status);
create index if not exists video_approvals_approved_idx on public.video_approvals(approved_at) where approved_at is not null;
create index if not exists video_approvals_changes_idx on public.video_approvals(changes_requested_at) where changes_requested_at is not null;

create table if not exists public.video_performance (
  id uuid default gen_random_uuid() primary key,
  job_id uuid not null references public.video_jobs(id) on delete cascade,
  template_id uuid,
  template_label text,
  hook_id uuid,
  hook_label text,
  cta_variant text,
  slot text not null,
  interval text not null check (interval in ('daily','weekly','lifetime')),
  interval_start timestamptz not null,
  renders integer default 0 not null,
  approvals integer default 0 not null,
  changes_requested integer default 0 not null,
  whatsapp_clicks integer default 0 not null,
  approval_rate numeric default 0 not null,
  click_through_rate numeric default 0 not null,
  cost_per_render numeric,
  insights text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  unique (job_id, interval, interval_start)
);

create index if not exists video_performance_interval_idx on public.video_performance(interval, interval_start desc);
create index if not exists video_performance_slot_idx on public.video_performance(slot, interval);
create index if not exists video_performance_hook_idx on public.video_performance(hook_id) where hook_id is not null;
create index if not exists video_performance_template_idx on public.video_performance(template_id) where template_id is not null;

create or replace function public.video_jobs_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create or replace function public.video_approvals_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create or replace function public.video_performance_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create trigger trg_video_jobs_touch_updated
  before update on public.video_jobs
  for each row
  execute function public.video_jobs_set_updated_at();

create trigger trg_video_approvals_touch_updated
  before update on public.video_approvals
  for each row
  execute function public.video_approvals_set_updated_at();

create trigger trg_video_performance_touch_updated
  before update on public.video_performance
  for each row
  execute function public.video_performance_set_updated_at();

create or replace function public.upsert_video_performance_row(
  job_row public.video_jobs,
  bucket_interval text,
  bucket_start timestamptz,
  renders integer,
  approvals integer,
  changes integer,
  clicks integer,
  approval_rate numeric,
  click_rate numeric,
  cost_per_render numeric,
  insights text
) returns void
language plpgsql
as $$
declare
  metadata jsonb;
begin
  metadata := coalesce(job_row.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'campaign_id', job_row.campaign_id,
      'template_id', job_row.template_id,
      'template_label', job_row.template_label,
      'hook_id', job_row.hook_id,
      'hook_label', job_row.hook_label,
      'cta_variant', job_row.cta_variant,
      'script_version', job_row.script_version,
      'rights_expiry_at', job_row.rights_expiry_at,
      'render_currency', job_row.render_currency,
      'render_cost_cents', job_row.render_cost_cents,
      'slot', job_row.slot
    );

  insert into public.video_performance as vp (
    job_id,
    template_id,
    template_label,
    hook_id,
    hook_label,
    cta_variant,
    slot,
    interval,
    interval_start,
    renders,
    approvals,
    changes_requested,
    whatsapp_clicks,
    approval_rate,
    click_through_rate,
    cost_per_render,
    insights,
    metadata,
    created_at,
    updated_at
  ) values (
    job_row.id,
    job_row.template_id,
    job_row.template_label,
    job_row.hook_id,
    job_row.hook_label,
    job_row.cta_variant,
    job_row.slot,
    bucket_interval,
    bucket_start,
    coalesce(renders, 0),
    coalesce(approvals, 0),
    coalesce(changes, 0),
    coalesce(clicks, 0),
    coalesce(approval_rate, 0),
    coalesce(click_rate, 0),
    cost_per_render,
    insights,
    metadata,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  on conflict (job_id, interval, interval_start)
  do update set
    template_id = excluded.template_id,
    template_label = excluded.template_label,
    hook_id = excluded.hook_id,
    hook_label = excluded.hook_label,
    cta_variant = excluded.cta_variant,
    slot = excluded.slot,
    renders = excluded.renders,
    approvals = excluded.approvals,
    changes_requested = excluded.changes_requested,
    whatsapp_clicks = excluded.whatsapp_clicks,
    approval_rate = excluded.approval_rate,
    click_through_rate = excluded.click_through_rate,
    cost_per_render = excluded.cost_per_render,
    insights = excluded.insights,
    metadata = coalesce(vp.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = timezone('utc'::text, now());
end;
$$;

create or replace function public.refresh_video_performance(job_uuid uuid)
returns void
language plpgsql
as $$
declare
  job_row public.video_jobs;
  total_renders integer;
  total_approvals integer;
  total_changes integer;
  total_clicks integer;
  last_click_at timestamptz;
  last_approved_at timestamptz;
  last_changed_at timestamptz;
  approval_rate numeric;
  click_rate numeric;
  cost_per_render numeric;
  currency text;
  lifetime_bucket timestamptz;
  daily_bucket timestamptz;
  weekly_bucket timestamptz;
  insights text;
  safe_currency text;
  render_cost numeric;
begin
  select * into job_row from public.video_jobs where id = job_uuid;
  if not found then
    return;
  end if;

  total_renders := coalesce(job_row.renders, 0);

  select
    count(*) filter (where status = 'approved'),
    count(*) filter (where status = 'changes_requested'),
    coalesce(sum(whatsapp_clicks), 0),
    max(last_whatsapp_click_at),
    max(approved_at),
    max(changes_requested_at)
  into total_approvals, total_changes, total_clicks, last_click_at, last_approved_at, last_changed_at
  from public.video_approvals
  where job_id = job_uuid;

  total_approvals := coalesce(total_approvals, 0);
  total_changes := coalesce(total_changes, 0);
  total_clicks := coalesce(total_clicks, 0);

  if total_renders > 0 then
    approval_rate := round((total_approvals::numeric / total_renders::numeric), 4);
    click_rate := round((total_clicks::numeric / total_renders::numeric), 4);
  else
    approval_rate := 0;
    click_rate := 0;
  end if;

  if job_row.render_cost_cents is not null then
    render_cost := job_row.render_cost_cents::numeric / 100.0;
  else
    render_cost := null;
  end if;

  if render_cost is not null and total_renders > 0 then
    cost_per_render := round((render_cost / total_renders::numeric), 4);
  else
    cost_per_render := null;
  end if;

  currency := nullif(job_row.render_currency, '');
  safe_currency := coalesce(currency, 'USD');

  insights := format(
    'Approvals %s | CTR %s%% | Cost/Render %s %s',
    total_approvals,
    round(coalesce(click_rate, 0) * 100, 2),
    safe_currency,
    coalesce(to_char(cost_per_render, 'FM9999990.00'), 'n/a')
  );

  if pg_trigger_depth() = 1 then
    update public.video_jobs
    set
      approvals_count = total_approvals,
      changes_requested_count = total_changes,
      whatsapp_clicks = total_clicks,
      last_whatsapp_click_at = coalesce(last_click_at, last_whatsapp_click_at),
      last_approval_at = coalesce(last_approved_at, last_approval_at),
      last_requested_change_at = coalesce(last_changed_at, last_requested_change_at)
    where id = job_uuid;
  end if;

  lifetime_bucket := date_trunc('day', coalesce(job_row.created_at, timezone('utc'::text, now())));
  daily_bucket := date_trunc('day', timezone('utc'::text, now()));
  weekly_bucket := date_trunc('week', timezone('utc'::text, now()));

  perform public.upsert_video_performance_row(
    job_row,
    'daily',
    daily_bucket,
    total_renders,
    total_approvals,
    total_changes,
    total_clicks,
    approval_rate,
    click_rate,
    cost_per_render,
    insights
  );

  perform public.upsert_video_performance_row(
    job_row,
    'weekly',
    weekly_bucket,
    total_renders,
    total_approvals,
    total_changes,
    total_clicks,
    approval_rate,
    click_rate,
    cost_per_render,
    insights
  );

  perform public.upsert_video_performance_row(
    job_row,
    'lifetime',
    lifetime_bucket,
    total_renders,
    total_approvals,
    total_changes,
    total_clicks,
    approval_rate,
    click_rate,
    cost_per_render,
    insights
  );
end;
$$;

create or replace function public.video_jobs_after_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    return null;
  end if;

  if pg_trigger_depth() > 1 then
    return new;
  end if;

  perform public.refresh_video_performance(new.id);
  return new;
end;
$$;

create or replace function public.video_approvals_after_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    return null;
  end if;

  if pg_trigger_depth() > 1 then
    return new;
  end if;

  perform public.refresh_video_performance(new.job_id);
  return new;
end;
$$;

create trigger trg_video_jobs_refresh
  after insert or update on public.video_jobs
  for each row
  execute function public.video_jobs_after_change();

create trigger trg_video_approvals_refresh
  after insert or update on public.video_approvals
  for each row
  execute function public.video_approvals_after_change();

alter table public.video_jobs enable row level security;
alter table public.video_approvals enable row level security;
alter table public.video_performance enable row level security;

create policy video_jobs_service_role_access
  on public.video_jobs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy video_approvals_service_role_access
  on public.video_approvals
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy video_performance_service_role_access
  on public.video_performance
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

comment on table public.video_jobs is 'Stores render jobs for marketing video variants and delivery metrics.';
comment on table public.video_approvals is 'Approval workflow records (approvals, change requests, WhatsApp clicks).';
comment on table public.video_performance is 'Aggregated performance roll-ups for video jobs across daily/weekly/lifetime windows.';
