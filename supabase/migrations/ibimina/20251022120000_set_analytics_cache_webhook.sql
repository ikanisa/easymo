-- Ensure analytics cache webhook configuration matches deployed admin app
insert into public.configuration as config (key, description, value)
values (
  'analytics_cache_webhook_url',
  'Webhook endpoint invoked after analytics changes to trigger Next.js cache revalidation',
  '"https://ibimina-admin.vercel.app/api/cache/revalidate"'::jsonb
)
on conflict (key) do update
set
  description = excluded.description,
  value = excluded.value;

insert into public.configuration as config (key, description, value)
values (
  'analytics_cache_webhook_token',
  'Bearer token expected by the analytics cache revalidation webhook',
  'null'::jsonb
)
on conflict (key) do update
set
  description = excluded.description,
  value = excluded.value;
