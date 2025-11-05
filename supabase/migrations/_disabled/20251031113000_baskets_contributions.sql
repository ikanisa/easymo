-- Contributions ledger, cycles, and rankings view.

BEGIN;

create table if not exists public.contributions_ledger (
  id uuid primary key default gen_random_uuid(),
  ikimina_id uuid not null references public.ibimina(id) on delete cascade,
  member_id uuid references public.ibimina_members(id) on delete set null,
  amount numeric(12,2) not null,
  currency text not null default 'RWF',
  cycle_yyyymm char(6) not null,
  txn_id text,
  allocated_at timestamptz not null default now(),
  source text not null default 'sms',
  meta jsonb not null default '{}'::jsonb
);

alter table public.contributions_ledger
  add constraint contributions_ledger_source_check
    check (source in ('sms','admin','correction'));

create index if not exists idx_contributions_ledger_ikimina on public.contributions_ledger (ikimina_id);
create index if not exists idx_contributions_ledger_member on public.contributions_ledger (member_id);
create index if not exists idx_contributions_ledger_cycle on public.contributions_ledger (cycle_yyyymm);
create unique index if not exists idx_contributions_ledger_txn_id on public.contributions_ledger (txn_id)
  where txn_id is not null;

create table if not exists public.contribution_cycles (
  id uuid primary key default gen_random_uuid(),
  ikimina_id uuid not null references public.ibimina(id) on delete cascade,
  yyyymm char(6) not null,
  expected_amount numeric(12,2),
  collected_amount numeric(12,2) not null default 0,
  status text not null default 'pending'
);

alter table public.contribution_cycles
  add constraint contribution_cycles_status_check
    check (status in ('pending','open','closed'));

create unique index if not exists contribution_cycles_unique on public.contribution_cycles (ikimina_id, yyyymm);
create index if not exists idx_contribution_cycles_status on public.contribution_cycles (status);

create or replace view public.member_rankings as
with totals as (
  select
    l.ikimina_id,
    l.member_id,
    sum(l.amount) as total_amount,
    sum(l.amount) filter (where l.cycle_yyyymm = to_char(now(), 'YYYYMM')) as month_amount
  from public.contributions_ledger l
  group by l.ikimina_id, l.member_id
)
select
  t.ikimina_id,
  t.member_id,
  coalesce(t.total_amount, 0) as total_amount,
  coalesce(t.month_amount, 0) as month_amount,
  row_number() over (partition by t.ikimina_id order by t.total_amount desc nulls last, t.member_id) as rank_total,
  row_number() over (partition by t.ikimina_id order by t.month_amount desc nulls last, t.member_id) as rank_month
from totals t;

COMMIT;
