-- Loans, collateral, invites, and KYC documents.

BEGIN;

create table if not exists public.sacco_loans (
  id uuid primary key default gen_random_uuid(),
  ikimina_id uuid not null references public.ibimina(id) on delete cascade,
  member_id uuid references public.ibimina_members(id) on delete set null,
  principal numeric(12,2) not null,
  currency text not null default 'RWF',
  tenure_months integer not null,
  rate_apr numeric(6,3),
  purpose text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

alter table public.sacco_loans
  add constraint sacco_loans_status_check
    check (status in ('pending','endorsing','approved','rejected','disbursed','closed'));

create index if not exists idx_sacco_loans_ikimina on public.sacco_loans (ikimina_id);
create index if not exists idx_sacco_loans_member on public.sacco_loans (member_id);
create index if not exists idx_sacco_loans_status on public.sacco_loans (status);

create table if not exists public.sacco_collateral (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.sacco_loans(id) on delete cascade,
  source text not null default 'group_savings',
  amount_pledged numeric(12,2) not null,
  coverage_ratio numeric(6,3),
  created_at timestamptz not null default now()
);

alter table public.sacco_collateral
  add constraint sacco_collateral_source_check
    check (source in ('group_savings'));

create index if not exists idx_sacco_collateral_loan on public.sacco_collateral (loan_id);

create table if not exists public.basket_invites (
  id uuid primary key default gen_random_uuid(),
  ikimina_id uuid not null references public.ibimina(id) on delete cascade,
  token text not null,
  issuer_member_id uuid references public.ibimina_members(id) on delete set null,
  expires_at timestamptz not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.basket_invites
  add constraint basket_invites_status_check
    check (status in ('active','used','expired','canceled'));

create unique index if not exists basket_invites_token_key on public.basket_invites (token);
create index if not exists idx_basket_invites_ikimina on public.basket_invites (ikimina_id);
create index if not exists idx_basket_invites_status on public.basket_invites (status);

create table if not exists public.kyc_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  doc_type text not null default 'national_id',
  front_url text not null,
  back_url text,
  parsed_json jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.kyc_documents
  add constraint kyc_documents_doc_type_check
    check (doc_type in ('national_id'));

alter table public.kyc_documents
  add constraint kyc_documents_status_check
    check (status in ('pending','verified','rejected'));

create index if not exists idx_kyc_documents_user on public.kyc_documents (user_id);
create index if not exists idx_kyc_documents_status on public.kyc_documents (status);

COMMIT;
