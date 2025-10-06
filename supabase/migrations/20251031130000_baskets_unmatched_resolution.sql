-- Extend momo_unmatched with resolution metadata.

alter table public.momo_unmatched
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists linked_member_id uuid references public.ibimina_members(id) on delete set null,
  add column if not exists resolution_notes text,
  add column if not exists allocation_ledger_id uuid references public.contributions_ledger(id) on delete set null;

create index if not exists idx_momo_unmatched_status_created on public.momo_unmatched (status, created_at);
create index if not exists idx_momo_unmatched_linked_member on public.momo_unmatched (linked_member_id);

