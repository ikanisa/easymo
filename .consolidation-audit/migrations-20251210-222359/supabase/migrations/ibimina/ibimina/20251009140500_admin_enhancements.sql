-- Phase 6 admin enhancements: branding copy + template metadata
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'saccos' and column_name = 'pdf_header_text'
  ) then
    alter table public.saccos
      add column pdf_header_text text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'saccos' and column_name = 'pdf_footer_text'
  ) then
    alter table public.saccos
      add column pdf_footer_text text;
  end if;
end $$;
alter table public.sms_templates
  add column if not exists version integer not null default 1,
  add column if not exists tokens jsonb not null default '[]'::jsonb,
  add column if not exists description text;
alter table public.sms_templates drop constraint if exists sms_templates_sacco_id_name_key;
alter table public.sms_templates add constraint sms_templates_sacco_id_name_version_key unique (sacco_id, name, version);
create index if not exists sms_templates_version_idx on public.sms_templates(sacco_id, name, version);
