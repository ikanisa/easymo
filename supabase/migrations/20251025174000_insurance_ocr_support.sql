-- Additive schema updates for insurance OCR flow
alter table if exists public.insurance_leads
  add column if not exists user_id uuid references public.profiles(user_id);

alter table if exists public.insurance_leads
  alter column status set default 'received';

create index if not exists insurance_leads_status_idx
  on public.insurance_leads(status);
