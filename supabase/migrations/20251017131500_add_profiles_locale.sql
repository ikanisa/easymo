-- Ensure profiles.locale is available for locale-aware automation
alter table public.profiles
  add column if not exists locale text default 'en';

update public.profiles
set locale = 'en'
where locale is null;

comment on column public.profiles.locale is 'Preferred language code for WhatsApp automation.';
