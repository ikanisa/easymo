set check_function_bodies = off;

create schema if not exists app_helpers;

CREATE OR REPLACE FUNCTION analytics.emit_cache_invalidation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'analytics'
AS $function$
declare
  webhook_url   text;
  webhook_token text;
  headers       jsonb;
  sacco_ids     uuid[];
  sacco_id      uuid;
  payload       jsonb;
  tags          text[];
begin
  select value::text into webhook_url
  from public.configuration
  where key = 'analytics_cache_webhook_url';

  if webhook_url is null or length(trim(webhook_url)) = 0 then
    return null;
  end if;

  select value::text into webhook_token
  from public.configuration
  where key = 'analytics_cache_webhook_token';

  headers := jsonb_build_object('content-type', 'application/json');
  if webhook_token is not null then
    headers := headers || jsonb_build_object('authorization', 'Bearer ' || webhook_token);
  end if;

  if TG_OP = 'INSERT' then
    execute 'select array_agg(distinct sacco_id) from new_rows' into sacco_ids;
  elsif TG_OP = 'DELETE' then
    execute 'select array_agg(distinct sacco_id) from old_rows' into sacco_ids;
  else
    execute '
      select array_agg(distinct sacco_id)
      from (
        select sacco_id from new_rows
        union
        select sacco_id from old_rows
      ) scoped
    ' into sacco_ids;
  end if;

  if sacco_ids is null or array_length(sacco_ids, 1) is null then
    sacco_ids := array[null::uuid];
  else
    sacco_ids := array_append(sacco_ids, null::uuid); -- include global/all tag
  end if;

  foreach sacco_id in array sacco_ids loop
    tags := array['dashboard:summary', 'analytics:executive:' || coalesce(sacco_id::text, 'all')];
    if sacco_id is not null then
      tags := array_append(tags, 'sacco:' || sacco_id::text);
    end if;

    payload := jsonb_build_object(
      'event', TG_ARGV[0],
      'saccoId', sacco_id,
      'tags', tags
    );

    begin
      perform net.http_post(
        url := webhook_url,
        headers := headers,
        body := payload,
        timeout_msec := 750
      );
    exception when others then
      insert into analytics.cache_invalidation_failures(event, sacco_id, error_message)
      values (TG_ARGV[0], sacco_id, sqlerrm);
    end;
  end loop;

  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION analytics.refresh_dashboard_materialized_views()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'analytics'
AS $function$
begin
  refresh materialized view concurrently public.analytics_payment_rollups_mv;
  refresh materialized view concurrently public.analytics_ikimina_monthly_mv;
  refresh materialized view concurrently public.analytics_member_last_payment_mv;
end;
$function$
;


set check_function_bodies = off;

CREATE OR REPLACE FUNCTION app.account_balance(account_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  with movements as (
    select
      sum(case when credit_id = account_id then amount else 0 end) as credits,
      sum(case when debit_id = account_id then amount else 0 end) as debits
    from app.ledger_entries
    where debit_id = account_id or credit_id = account_id
  )
  select coalesce(credits, 0) - coalesce(debits, 0)
  from movements;
$function$
;

CREATE OR REPLACE FUNCTION app.account_sacco(account_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select sacco_id
  from app.accounts
  where id = account_id
$function$
;

CREATE OR REPLACE FUNCTION app."current_role"()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select role
  from app.user_profiles
  where user_id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION app.current_sacco()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select sacco_id
  from app.user_profiles
  where user_id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION app.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
begin
  insert into app.user_profiles(user_id, role, sacco_id)
  values (new.id, 'SACCO_STAFF', null)
  on conflict (user_id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION app.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'SYSTEM_ADMIN',
    false
  )
  or coalesce(app.current_role() = 'SYSTEM_ADMIN', false)
$function$
;

CREATE OR REPLACE FUNCTION app.member_sacco(member_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select sacco_id
  from app.members
  where id = member_id
$function$
;

CREATE OR REPLACE FUNCTION app.payment_sacco(payment_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select sacco_id
  from app.payments
  where id = payment_id
$function$
;


set check_function_bodies = off;

CREATE OR REPLACE FUNCTION app_helpers.slugify(input text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select nullif(
    trim(both '-' from regexp_replace(
      regexp_replace(lower(coalesce($1, '')), '[^[:alnum:]]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )),
    ''
  );
$function$
;

CREATE OR REPLACE FUNCTION app_helpers.sync_sacco_slug()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.search_slug := app_helpers.slugify(new.name);
  return new;
end;
$function$
;


set check_function_bodies = off;

CREATE OR REPLACE FUNCTION ops.consume_rate_limit(bucket_key_raw text, route text, max_hits integer, window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
declare
  span integer := greatest(window_seconds, 1);
  now_utc timestamptz := timezone('UTC', now());
  window_start timestamptz := now_utc - make_interval(secs => mod(floor(extract(epoch from now_utc))::int, span));
  bucket_key text := coalesce(nullif(trim(bucket_key_raw), ''), 'anonymous');
  new_count integer;
begin
  insert into ops.rate_limits(bucket_key, route, window_started, count)
  values (bucket_key, route, window_start, 1)
  on conflict (bucket_key, route, window_started)
  do update set count = ops.rate_limits.count + 1
  returning count into new_count;

  delete from ops.rate_limits
  where window_started < now_utc - make_interval(secs => span * 2);

  return new_count <= max_hits;
end;
$function$
;

CREATE OR REPLACE PROCEDURE ops.sp_monthly_close()
 LANGUAGE plpgsql
AS $procedure$
begin
  insert into app.audit_logs(action, entity, diff, created_at)
  values (
    'MONTHLY_CLOSE',
    'SYSTEM',
    jsonb_build_object('timestamp', timezone('UTC', now())),
    timezone('UTC', now())
  );
end;
$procedure$
;

CREATE OR REPLACE PROCEDURE ops.sp_nightly_recon()
 LANGUAGE plpgsql
AS $procedure$
begin
  -- Widen matching window for potential duplicates and reopen unresolved items.
  update app.recon_exceptions re
    set status = 'OPEN',
        resolved_at = null
  where re.status <> 'OPEN';
end;
$procedure$
;


do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    return;
  end if;

  execute 'create schema if not exists net';
  execute $func$
    create or replace function net.http_post(
      url text,
      headers jsonb default '{}'::jsonb,
      body jsonb default '{}'::jsonb,
      timeout_msec integer default null
    )
    returns jsonb
    language sql
    as $body$
      select jsonb_build_object('status', 'stubbed');
    $body$;
  $func$;
  raise notice 'pg_net stub installed via remote_schema migration';
end;
$do$;

create type "public"."invite_status" as enum ('sent', 'accepted', 'expired');

create type "public"."join_status" as enum ('pending', 'approved', 'rejected');

create type "public"."notify_type" as enum ('new_member', 'payment_confirmed', 'invite_accepted');

create type "public"."payment_status" as enum ('pending', 'completed', 'failed');

revoke delete on table "public"."agent_events" from "anon";

revoke insert on table "public"."agent_events" from "anon";

revoke references on table "public"."agent_events" from "anon";

revoke select on table "public"."agent_events" from "anon";

revoke trigger on table "public"."agent_events" from "anon";

revoke truncate on table "public"."agent_events" from "anon";

revoke update on table "public"."agent_events" from "anon";

revoke delete on table "public"."agent_events" from "authenticated";

revoke insert on table "public"."agent_events" from "authenticated";

revoke references on table "public"."agent_events" from "authenticated";

revoke select on table "public"."agent_events" from "authenticated";

revoke trigger on table "public"."agent_events" from "authenticated";

revoke truncate on table "public"."agent_events" from "authenticated";

revoke update on table "public"."agent_events" from "authenticated";

revoke delete on table "public"."agent_events" from "service_role";

revoke insert on table "public"."agent_events" from "service_role";

revoke references on table "public"."agent_events" from "service_role";

revoke select on table "public"."agent_events" from "service_role";

revoke trigger on table "public"."agent_events" from "service_role";

revoke truncate on table "public"."agent_events" from "service_role";

revoke update on table "public"."agent_events" from "service_role";

revoke delete on table "public"."configuration" from "anon";

revoke insert on table "public"."configuration" from "anon";

revoke references on table "public"."configuration" from "anon";

revoke select on table "public"."configuration" from "anon";

revoke trigger on table "public"."configuration" from "anon";

revoke truncate on table "public"."configuration" from "anon";

revoke update on table "public"."configuration" from "anon";

revoke delete on table "public"."configuration" from "authenticated";

revoke insert on table "public"."configuration" from "authenticated";

revoke references on table "public"."configuration" from "authenticated";

revoke select on table "public"."configuration" from "authenticated";

revoke trigger on table "public"."configuration" from "authenticated";

revoke truncate on table "public"."configuration" from "authenticated";

revoke update on table "public"."configuration" from "authenticated";

revoke delete on table "public"."configuration" from "service_role";

revoke insert on table "public"."configuration" from "service_role";

revoke references on table "public"."configuration" from "service_role";

revoke select on table "public"."configuration" from "service_role";

revoke trigger on table "public"."configuration" from "service_role";

revoke truncate on table "public"."configuration" from "service_role";

revoke update on table "public"."configuration" from "service_role";

revoke delete on table "public"."group_invites" from "anon";

revoke insert on table "public"."group_invites" from "anon";

revoke references on table "public"."group_invites" from "anon";

revoke select on table "public"."group_invites" from "anon";

revoke trigger on table "public"."group_invites" from "anon";

revoke truncate on table "public"."group_invites" from "anon";

revoke update on table "public"."group_invites" from "anon";

revoke delete on table "public"."group_invites" from "authenticated";

revoke insert on table "public"."group_invites" from "authenticated";

revoke references on table "public"."group_invites" from "authenticated";

revoke select on table "public"."group_invites" from "authenticated";

revoke trigger on table "public"."group_invites" from "authenticated";

revoke truncate on table "public"."group_invites" from "authenticated";

revoke update on table "public"."group_invites" from "authenticated";

revoke delete on table "public"."group_invites" from "service_role";

revoke insert on table "public"."group_invites" from "service_role";

revoke references on table "public"."group_invites" from "service_role";

revoke select on table "public"."group_invites" from "service_role";

revoke trigger on table "public"."group_invites" from "service_role";

revoke truncate on table "public"."group_invites" from "service_role";

revoke update on table "public"."group_invites" from "service_role";

revoke delete on table "public"."items" from "anon";

revoke insert on table "public"."items" from "anon";

revoke references on table "public"."items" from "anon";

revoke select on table "public"."items" from "anon";

revoke trigger on table "public"."items" from "anon";

revoke truncate on table "public"."items" from "anon";

revoke update on table "public"."items" from "anon";

revoke delete on table "public"."items" from "authenticated";

revoke insert on table "public"."items" from "authenticated";

revoke references on table "public"."items" from "authenticated";

revoke select on table "public"."items" from "authenticated";

revoke trigger on table "public"."items" from "authenticated";

revoke truncate on table "public"."items" from "authenticated";

revoke update on table "public"."items" from "authenticated";

revoke delete on table "public"."items" from "service_role";

revoke insert on table "public"."items" from "service_role";

revoke references on table "public"."items" from "service_role";

revoke select on table "public"."items" from "service_role";

revoke trigger on table "public"."items" from "service_role";

revoke truncate on table "public"."items" from "service_role";

revoke update on table "public"."items" from "service_role";

revoke delete on table "public"."join_requests" from "anon";

revoke insert on table "public"."join_requests" from "anon";

revoke references on table "public"."join_requests" from "anon";

revoke select on table "public"."join_requests" from "anon";

revoke trigger on table "public"."join_requests" from "anon";

revoke truncate on table "public"."join_requests" from "anon";

revoke update on table "public"."join_requests" from "anon";

revoke delete on table "public"."join_requests" from "authenticated";

revoke insert on table "public"."join_requests" from "authenticated";

revoke references on table "public"."join_requests" from "authenticated";

revoke select on table "public"."join_requests" from "authenticated";

revoke trigger on table "public"."join_requests" from "authenticated";

revoke truncate on table "public"."join_requests" from "authenticated";

revoke update on table "public"."join_requests" from "authenticated";

revoke delete on table "public"."join_requests" from "service_role";

revoke insert on table "public"."join_requests" from "service_role";

revoke references on table "public"."join_requests" from "service_role";

revoke select on table "public"."join_requests" from "service_role";

revoke trigger on table "public"."join_requests" from "service_role";

revoke truncate on table "public"."join_requests" from "service_role";

revoke update on table "public"."join_requests" from "service_role";

revoke delete on table "public"."locations" from "anon";

revoke insert on table "public"."locations" from "anon";

revoke references on table "public"."locations" from "anon";

revoke select on table "public"."locations" from "anon";

revoke trigger on table "public"."locations" from "anon";

revoke truncate on table "public"."locations" from "anon";

revoke update on table "public"."locations" from "anon";

revoke delete on table "public"."locations" from "authenticated";

revoke insert on table "public"."locations" from "authenticated";

revoke references on table "public"."locations" from "authenticated";

revoke select on table "public"."locations" from "authenticated";

revoke trigger on table "public"."locations" from "authenticated";

revoke truncate on table "public"."locations" from "authenticated";

revoke update on table "public"."locations" from "authenticated";

revoke delete on table "public"."locations" from "service_role";

revoke insert on table "public"."locations" from "service_role";

revoke references on table "public"."locations" from "service_role";

revoke select on table "public"."locations" from "service_role";

revoke trigger on table "public"."locations" from "service_role";

revoke truncate on table "public"."locations" from "service_role";

revoke update on table "public"."locations" from "service_role";

revoke delete on table "public"."members_app_profiles" from "anon";

revoke insert on table "public"."members_app_profiles" from "anon";

revoke references on table "public"."members_app_profiles" from "anon";

revoke select on table "public"."members_app_profiles" from "anon";

revoke trigger on table "public"."members_app_profiles" from "anon";

revoke truncate on table "public"."members_app_profiles" from "anon";

revoke update on table "public"."members_app_profiles" from "anon";

revoke delete on table "public"."members_app_profiles" from "authenticated";

revoke insert on table "public"."members_app_profiles" from "authenticated";

revoke references on table "public"."members_app_profiles" from "authenticated";

revoke select on table "public"."members_app_profiles" from "authenticated";

revoke trigger on table "public"."members_app_profiles" from "authenticated";

revoke truncate on table "public"."members_app_profiles" from "authenticated";

revoke update on table "public"."members_app_profiles" from "authenticated";

revoke delete on table "public"."members_app_profiles" from "service_role";

revoke insert on table "public"."members_app_profiles" from "service_role";

revoke references on table "public"."members_app_profiles" from "service_role";

revoke select on table "public"."members_app_profiles" from "service_role";

revoke trigger on table "public"."members_app_profiles" from "service_role";

revoke truncate on table "public"."members_app_profiles" from "service_role";

revoke update on table "public"."members_app_profiles" from "service_role";

revoke delete on table "public"."mfa_recovery_codes" from "anon";

revoke insert on table "public"."mfa_recovery_codes" from "anon";

revoke references on table "public"."mfa_recovery_codes" from "anon";

revoke select on table "public"."mfa_recovery_codes" from "anon";

revoke trigger on table "public"."mfa_recovery_codes" from "anon";

revoke truncate on table "public"."mfa_recovery_codes" from "anon";

revoke update on table "public"."mfa_recovery_codes" from "anon";

revoke delete on table "public"."mfa_recovery_codes" from "authenticated";

revoke insert on table "public"."mfa_recovery_codes" from "authenticated";

revoke references on table "public"."mfa_recovery_codes" from "authenticated";

revoke select on table "public"."mfa_recovery_codes" from "authenticated";

revoke trigger on table "public"."mfa_recovery_codes" from "authenticated";

revoke truncate on table "public"."mfa_recovery_codes" from "authenticated";

revoke update on table "public"."mfa_recovery_codes" from "authenticated";

revoke delete on table "public"."mfa_recovery_codes" from "service_role";

revoke insert on table "public"."mfa_recovery_codes" from "service_role";

revoke references on table "public"."mfa_recovery_codes" from "service_role";

revoke select on table "public"."mfa_recovery_codes" from "service_role";

revoke trigger on table "public"."mfa_recovery_codes" from "service_role";

revoke truncate on table "public"."mfa_recovery_codes" from "service_role";

revoke update on table "public"."mfa_recovery_codes" from "service_role";

revoke delete on table "public"."notification_queue" from "anon";

revoke insert on table "public"."notification_queue" from "anon";

revoke references on table "public"."notification_queue" from "anon";

revoke select on table "public"."notification_queue" from "anon";

revoke trigger on table "public"."notification_queue" from "anon";

revoke truncate on table "public"."notification_queue" from "anon";

revoke update on table "public"."notification_queue" from "anon";

revoke delete on table "public"."notification_queue" from "authenticated";

revoke insert on table "public"."notification_queue" from "authenticated";

revoke references on table "public"."notification_queue" from "authenticated";

revoke select on table "public"."notification_queue" from "authenticated";

revoke trigger on table "public"."notification_queue" from "authenticated";

revoke truncate on table "public"."notification_queue" from "authenticated";

revoke update on table "public"."notification_queue" from "authenticated";

revoke delete on table "public"."notification_queue" from "service_role";

revoke insert on table "public"."notification_queue" from "service_role";

revoke references on table "public"."notification_queue" from "service_role";

revoke select on table "public"."notification_queue" from "service_role";

revoke trigger on table "public"."notification_queue" from "service_role";

revoke truncate on table "public"."notification_queue" from "service_role";

revoke update on table "public"."notification_queue" from "service_role";

revoke delete on table "public"."notifications" from "anon";

revoke insert on table "public"."notifications" from "anon";

revoke references on table "public"."notifications" from "anon";

revoke select on table "public"."notifications" from "anon";

revoke trigger on table "public"."notifications" from "anon";

revoke truncate on table "public"."notifications" from "anon";

revoke update on table "public"."notifications" from "anon";

revoke delete on table "public"."notifications" from "authenticated";

revoke insert on table "public"."notifications" from "authenticated";

revoke references on table "public"."notifications" from "authenticated";

revoke select on table "public"."notifications" from "authenticated";

revoke trigger on table "public"."notifications" from "authenticated";

revoke truncate on table "public"."notifications" from "authenticated";

revoke update on table "public"."notifications" from "authenticated";

revoke delete on table "public"."notifications" from "service_role";

revoke insert on table "public"."notifications" from "service_role";

revoke references on table "public"."notifications" from "service_role";

revoke select on table "public"."notifications" from "service_role";

revoke trigger on table "public"."notifications" from "service_role";

revoke truncate on table "public"."notifications" from "service_role";

revoke update on table "public"."notifications" from "service_role";

revoke delete on table "public"."orders" from "anon";

revoke insert on table "public"."orders" from "anon";

revoke references on table "public"."orders" from "anon";

revoke select on table "public"."orders" from "anon";

revoke trigger on table "public"."orders" from "anon";

revoke truncate on table "public"."orders" from "anon";

revoke update on table "public"."orders" from "anon";

revoke delete on table "public"."orders" from "authenticated";

revoke insert on table "public"."orders" from "authenticated";

revoke references on table "public"."orders" from "authenticated";

revoke select on table "public"."orders" from "authenticated";

revoke trigger on table "public"."orders" from "authenticated";

revoke truncate on table "public"."orders" from "authenticated";

revoke update on table "public"."orders" from "authenticated";

revoke delete on table "public"."orders" from "service_role";

revoke insert on table "public"."orders" from "service_role";

revoke references on table "public"."orders" from "service_role";

revoke select on table "public"."orders" from "service_role";

revoke trigger on table "public"."orders" from "service_role";

revoke truncate on table "public"."orders" from "service_role";

revoke update on table "public"."orders" from "service_role";

revoke delete on table "public"."rate_limit_counters" from "anon";

revoke insert on table "public"."rate_limit_counters" from "anon";

revoke references on table "public"."rate_limit_counters" from "anon";

revoke select on table "public"."rate_limit_counters" from "anon";

revoke trigger on table "public"."rate_limit_counters" from "anon";

revoke truncate on table "public"."rate_limit_counters" from "anon";

revoke update on table "public"."rate_limit_counters" from "anon";

revoke delete on table "public"."rate_limit_counters" from "authenticated";

revoke insert on table "public"."rate_limit_counters" from "authenticated";

revoke references on table "public"."rate_limit_counters" from "authenticated";

revoke select on table "public"."rate_limit_counters" from "authenticated";

revoke trigger on table "public"."rate_limit_counters" from "authenticated";

revoke truncate on table "public"."rate_limit_counters" from "authenticated";

revoke update on table "public"."rate_limit_counters" from "authenticated";

revoke delete on table "public"."rate_limit_counters" from "service_role";

revoke insert on table "public"."rate_limit_counters" from "service_role";

revoke references on table "public"."rate_limit_counters" from "service_role";

revoke select on table "public"."rate_limit_counters" from "service_role";

revoke trigger on table "public"."rate_limit_counters" from "service_role";

revoke truncate on table "public"."rate_limit_counters" from "service_role";

revoke update on table "public"."rate_limit_counters" from "service_role";

revoke delete on table "public"."sms_templates" from "anon";

revoke insert on table "public"."sms_templates" from "anon";

revoke references on table "public"."sms_templates" from "anon";

revoke select on table "public"."sms_templates" from "anon";

revoke trigger on table "public"."sms_templates" from "anon";

revoke truncate on table "public"."sms_templates" from "anon";

revoke update on table "public"."sms_templates" from "anon";

revoke delete on table "public"."sms_templates" from "authenticated";

revoke insert on table "public"."sms_templates" from "authenticated";

revoke references on table "public"."sms_templates" from "authenticated";

revoke select on table "public"."sms_templates" from "authenticated";

revoke trigger on table "public"."sms_templates" from "authenticated";

revoke truncate on table "public"."sms_templates" from "authenticated";

revoke update on table "public"."sms_templates" from "authenticated";

revoke delete on table "public"."sms_templates" from "service_role";

revoke insert on table "public"."sms_templates" from "service_role";

revoke references on table "public"."sms_templates" from "service_role";

revoke select on table "public"."sms_templates" from "service_role";

revoke trigger on table "public"."sms_templates" from "service_role";

revoke truncate on table "public"."sms_templates" from "service_role";

revoke update on table "public"."sms_templates" from "service_role";

revoke delete on table "public"."system_metrics" from "anon";

revoke insert on table "public"."system_metrics" from "anon";

revoke references on table "public"."system_metrics" from "anon";

revoke select on table "public"."system_metrics" from "anon";

revoke trigger on table "public"."system_metrics" from "anon";

revoke truncate on table "public"."system_metrics" from "anon";

revoke update on table "public"."system_metrics" from "anon";

revoke delete on table "public"."system_metrics" from "authenticated";

revoke insert on table "public"."system_metrics" from "authenticated";

revoke references on table "public"."system_metrics" from "authenticated";

revoke select on table "public"."system_metrics" from "authenticated";

revoke trigger on table "public"."system_metrics" from "authenticated";

revoke truncate on table "public"."system_metrics" from "authenticated";

revoke update on table "public"."system_metrics" from "authenticated";

revoke delete on table "public"."system_metrics" from "service_role";

revoke insert on table "public"."system_metrics" from "service_role";

revoke references on table "public"."system_metrics" from "service_role";

revoke select on table "public"."system_metrics" from "service_role";

revoke trigger on table "public"."system_metrics" from "service_role";

revoke truncate on table "public"."system_metrics" from "service_role";

revoke update on table "public"."system_metrics" from "service_role";

revoke delete on table "public"."tenants" from "anon";

revoke insert on table "public"."tenants" from "anon";

revoke references on table "public"."tenants" from "anon";

revoke select on table "public"."tenants" from "anon";

revoke trigger on table "public"."tenants" from "anon";

revoke truncate on table "public"."tenants" from "anon";

revoke update on table "public"."tenants" from "anon";

revoke delete on table "public"."tenants" from "authenticated";

revoke insert on table "public"."tenants" from "authenticated";

revoke references on table "public"."tenants" from "authenticated";

revoke select on table "public"."tenants" from "authenticated";

revoke trigger on table "public"."tenants" from "authenticated";

revoke truncate on table "public"."tenants" from "authenticated";

revoke update on table "public"."tenants" from "authenticated";

revoke delete on table "public"."tenants" from "service_role";

revoke insert on table "public"."tenants" from "service_role";

revoke references on table "public"."tenants" from "service_role";

revoke select on table "public"."tenants" from "service_role";

revoke trigger on table "public"."tenants" from "service_role";

revoke truncate on table "public"."tenants" from "service_role";

revoke update on table "public"."tenants" from "service_role";

revoke delete on table "public"."trusted_devices" from "anon";

revoke insert on table "public"."trusted_devices" from "anon";

revoke references on table "public"."trusted_devices" from "anon";

revoke select on table "public"."trusted_devices" from "anon";

revoke trigger on table "public"."trusted_devices" from "anon";

revoke truncate on table "public"."trusted_devices" from "anon";

revoke update on table "public"."trusted_devices" from "anon";

revoke delete on table "public"."trusted_devices" from "authenticated";

revoke insert on table "public"."trusted_devices" from "authenticated";

revoke references on table "public"."trusted_devices" from "authenticated";

revoke select on table "public"."trusted_devices" from "authenticated";

revoke trigger on table "public"."trusted_devices" from "authenticated";

revoke truncate on table "public"."trusted_devices" from "authenticated";

revoke update on table "public"."trusted_devices" from "authenticated";

revoke delete on table "public"."trusted_devices" from "service_role";

revoke insert on table "public"."trusted_devices" from "service_role";

revoke references on table "public"."trusted_devices" from "service_role";

revoke select on table "public"."trusted_devices" from "service_role";

revoke trigger on table "public"."trusted_devices" from "service_role";

revoke truncate on table "public"."trusted_devices" from "service_role";

revoke update on table "public"."trusted_devices" from "service_role";

revoke delete on table "public"."user_saccos" from "anon";

revoke insert on table "public"."user_saccos" from "anon";

revoke references on table "public"."user_saccos" from "anon";

revoke select on table "public"."user_saccos" from "anon";

revoke trigger on table "public"."user_saccos" from "anon";

revoke truncate on table "public"."user_saccos" from "anon";

revoke update on table "public"."user_saccos" from "anon";

revoke delete on table "public"."user_saccos" from "authenticated";

revoke insert on table "public"."user_saccos" from "authenticated";

revoke references on table "public"."user_saccos" from "authenticated";

revoke select on table "public"."user_saccos" from "authenticated";

revoke trigger on table "public"."user_saccos" from "authenticated";

revoke truncate on table "public"."user_saccos" from "authenticated";

revoke update on table "public"."user_saccos" from "authenticated";

revoke delete on table "public"."user_saccos" from "service_role";

revoke insert on table "public"."user_saccos" from "service_role";

revoke references on table "public"."user_saccos" from "service_role";

revoke select on table "public"."user_saccos" from "service_role";

revoke trigger on table "public"."user_saccos" from "service_role";

revoke truncate on table "public"."user_saccos" from "service_role";

revoke update on table "public"."user_saccos" from "service_role";

revoke delete on table "public"."users" from "anon";

revoke insert on table "public"."users" from "anon";

revoke references on table "public"."users" from "anon";

revoke select on table "public"."users" from "anon";

revoke trigger on table "public"."users" from "anon";

revoke truncate on table "public"."users" from "anon";

revoke update on table "public"."users" from "anon";

revoke delete on table "public"."users" from "authenticated";

revoke insert on table "public"."users" from "authenticated";

revoke references on table "public"."users" from "authenticated";

revoke select on table "public"."users" from "authenticated";

revoke trigger on table "public"."users" from "authenticated";

revoke truncate on table "public"."users" from "authenticated";

revoke update on table "public"."users" from "authenticated";

revoke delete on table "public"."users" from "service_role";

revoke insert on table "public"."users" from "service_role";

revoke references on table "public"."users" from "service_role";

revoke select on table "public"."users" from "service_role";

revoke trigger on table "public"."users" from "service_role";

revoke truncate on table "public"."users" from "service_role";

revoke update on table "public"."users" from "service_role";

revoke delete on table "public"."webauthn_credentials" from "anon";

revoke insert on table "public"."webauthn_credentials" from "anon";

revoke references on table "public"."webauthn_credentials" from "anon";

revoke select on table "public"."webauthn_credentials" from "anon";

revoke trigger on table "public"."webauthn_credentials" from "anon";

revoke truncate on table "public"."webauthn_credentials" from "anon";

revoke update on table "public"."webauthn_credentials" from "anon";

revoke delete on table "public"."webauthn_credentials" from "authenticated";

revoke insert on table "public"."webauthn_credentials" from "authenticated";

revoke references on table "public"."webauthn_credentials" from "authenticated";

revoke select on table "public"."webauthn_credentials" from "authenticated";

revoke trigger on table "public"."webauthn_credentials" from "authenticated";

revoke truncate on table "public"."webauthn_credentials" from "authenticated";

revoke update on table "public"."webauthn_credentials" from "authenticated";

revoke delete on table "public"."webauthn_credentials" from "service_role";

revoke insert on table "public"."webauthn_credentials" from "service_role";

revoke references on table "public"."webauthn_credentials" from "service_role";

revoke select on table "public"."webauthn_credentials" from "service_role";

revoke trigger on table "public"."webauthn_credentials" from "service_role";

revoke truncate on table "public"."webauthn_credentials" from "service_role";

revoke update on table "public"."webauthn_credentials" from "service_role";

alter table "public"."items" drop constraint "items_location_id_fkey";

alter table "public"."items" drop constraint "items_tenant_id_fkey";

alter table "public"."locations" drop constraint "locations_region_check";

alter table "public"."locations" drop constraint "locations_tenant_id_fkey";

alter table "public"."orders" drop constraint "orders_location_id_fkey";

alter table "public"."orders" drop constraint "orders_tenant_id_fkey";

alter table "public"."tenants" drop constraint "tenants_region_check";

do $$
begin
  if exists (
    select 1
    from pg_views
    where schemaname = 'public'
      and viewname = 'ledger_entries'
  ) then
    execute 'drop view public.ledger_entries';
  end if;
end$$;

do $$
begin
  if exists (
    select 1
    from pg_views
    where schemaname = 'public'
      and viewname = 'payments'
  ) then
    execute 'drop view public.payments';
  end if;
end$$;

alter table "public"."agent_events" drop constraint "agent_events_pkey";

alter table "public"."items" drop constraint "items_pkey";

alter table "public"."locations" drop constraint "locations_pkey";

alter table "public"."orders" drop constraint "orders_pkey";

alter table "public"."tenants" drop constraint "tenants_pkey";

drop index if exists "public"."agent_events_pkey";

drop index if exists "public"."idx_items_location";

drop index if exists "public"."idx_locations_tenant";

drop index if exists "public"."idx_orders_location";

drop index if exists "public"."items_pkey";

drop index if exists "public"."locations_pkey";

drop index if exists "public"."orders_pkey";

drop index if exists "public"."tenants_pkey";

drop table "public"."agent_events";

drop table "public"."items";

drop table "public"."locations";

drop table "public"."orders";

drop table "public"."tenants";

create table "public"."ikimina" (
    "id" uuid not null default gen_random_uuid(),
    "sacco_id" uuid not null,
    "code" text not null,
    "name" text not null,
    "type" text not null default 'ASCA'::text,
    "settings" jsonb not null default '{}'::jsonb,
    "status" text not null default 'ACTIVE'::text,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."ikimina" enable row level security;

create table "public"."members" (
    "id" uuid not null default gen_random_uuid(),
    "ikimina_id" uuid not null,
    "user_id" uuid,
    "member_code" text,
    "full_name" text,
    "national_id" text,
    "msisdn" text,
    "joined_at" timestamp with time zone not null default now(),
    "status" text not null default 'ACTIVE'::text
);


alter table "public"."members" enable row level security;

CREATE INDEX idx_group_invites_token ON public.group_invites USING btree (token);

CREATE INDEX idx_ikimina_sacco ON public.ikimina USING btree (sacco_id);

CREATE INDEX idx_join_requests_user ON public.join_requests USING btree (user_id);

CREATE INDEX idx_members_msisdn ON public.members USING btree (msisdn);

CREATE INDEX idx_members_nid ON public.members USING btree (national_id);

CREATE INDEX idx_members_user_id ON public.members USING btree (user_id);

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);

CREATE UNIQUE INDEX ikimina_pkey ON public.ikimina USING btree (id);

CREATE UNIQUE INDEX ikimina_sacco_id_code_key ON public.ikimina USING btree (sacco_id, code);

CREATE UNIQUE INDEX members_ikimina_id_member_code_key ON public.members USING btree (ikimina_id, member_code);

CREATE UNIQUE INDEX members_pkey ON public.members USING btree (id);

alter table "public"."ikimina" add constraint "ikimina_pkey" PRIMARY KEY using index "ikimina_pkey";

alter table "public"."members" add constraint "members_pkey" PRIMARY KEY using index "members_pkey";

alter table "public"."ikimina" add constraint "ikimina_sacco_id_code_key" UNIQUE using index "ikimina_sacco_id_code_key";

alter table "public"."members" add constraint "members_ikimina_id_fkey" FOREIGN KEY (ikimina_id) REFERENCES ikimina(id) ON DELETE CASCADE not valid;

alter table "public"."members" validate constraint "members_ikimina_id_fkey";

alter table "public"."members" add constraint "members_ikimina_id_member_code_key" UNIQUE using index "members_ikimina_id_member_code_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.current_user_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.is_user_member_of_group(gid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1 from public.members m
    where m.ikimina_id = gid and (m.user_id = auth.uid())
  );
$function$
;

CREATE OR REPLACE FUNCTION public.search_saccos_trgm(q text)
 RETURNS TABLE(id uuid, name text, district text, sector_code text, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  select
    s.id,
    s.name,
    s.district,
    s.sector_code,
    greatest(similarity(s.name, q), similarity(s.sector_code, q)) as similarity
  from public.saccos s
  where coalesce(trim(q), '') <> ''
  order by similarity desc, s.name
  limit 20
$function$
;

CREATE OR REPLACE FUNCTION public.sum_group_deposits(gid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select jsonb_build_object(
    'amount', coalesce(sum(p.amount), 0),
    'currency', coalesce(nullif(max(p.currency), ''), 'RWF')
  )
  from public.payments p
  where p.ikimina_id = gid and p.status = 'completed';
$function$
;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.account_balance(account_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'app'
AS $function$
  select app.account_balance(account_id);
$function$
;

CREATE OR REPLACE FUNCTION public.can_user_access_account(_account_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.accounts a
    WHERE a.id = _account_id
      AND (
        public.has_role(_user_id, 'SYSTEM_ADMIN')
        OR (
          a.owner_type = 'SACCO'
          AND a.owner_id = public.get_user_sacco(_user_id)
        )
        OR (
          a.owner_type = 'IKIMINA'
          AND EXISTS (
            SELECT 1
            FROM public.ibimina i
            WHERE i.id = a.owner_id::UUID
              AND i.sacco_id = public.get_user_sacco(_user_id)
          )
        )
        OR (
          a.owner_type = 'MEMBER'
          AND EXISTS (
            SELECT 1
            FROM public.ikimina_members m
            JOIN public.ibimina i ON i.id = m.ikimina_id
            WHERE m.id = a.owner_id::UUID
              AND i.sacco_id = public.get_user_sacco(_user_id)
          )
        )
        OR (
          a.owner_type = 'USER'
          AND a.owner_id = _user_id
        )
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_key text, p_max_hits integer, p_window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
  existing public.rate_limit_counters%ROWTYPE;
  max_allowed INTEGER := COALESCE(p_max_hits, 5);
  window_seconds INTEGER := GREATEST(COALESCE(p_window_seconds, 300), 1);
BEGIN
  SELECT * INTO existing
  FROM public.rate_limit_counters
  WHERE key = p_key;

  IF NOT FOUND OR existing.window_expires < NOW() THEN
    INSERT INTO public.rate_limit_counters(key, hits, window_expires)
    VALUES (p_key, 1, NOW() + make_interval(secs => window_seconds))
    ON CONFLICT (key) DO UPDATE
      SET hits = EXCLUDED.hits,
          window_expires = EXCLUDED.window_expires;
    RETURN TRUE;
  END IF;

  IF existing.hits >= max_allowed THEN
    RETURN FALSE;
  END IF;

  UPDATE public.rate_limit_counters
    SET hits = existing.hits + 1,
        window_expires = existing.window_expires
  WHERE key = p_key;

  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.consume_route_rate_limit(bucket_key text, route text, max_hits integer, window_seconds integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'ops'
AS $function$
  select ops.consume_rate_limit(bucket_key, route, max_hits, window_seconds);
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_sacco(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT sacco_id FROM public.users WHERE id = _user_id
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if this is the admin email and set role accordingly
  INSERT INTO public.users (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    CASE 
      WHEN NEW.email = 'info@ikanisa.com' THEN 'SYSTEM_ADMIN'::app_role
      ELSE 'SACCO_STAFF'::app_role
    END
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = _user_id AND role = _role
  )
$function$
;

CREATE OR REPLACE FUNCTION public.increment_metric(event_name text, delta integer, meta jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.system_metrics(event, total, last_occurred, meta)
  VALUES (event_name, delta, NOW(), COALESCE(meta, '{}'::jsonb))
  ON CONFLICT (event) DO UPDATE
    SET total = public.system_metrics.total + GREATEST(delta, 0),
        last_occurred = NOW(),
        meta = CASE
          WHEN meta = '{}'::jsonb THEN public.system_metrics.meta
          ELSE meta
        END;
END;
$function$
;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'ledger_entries'
  ) then
    -- table still present; skip view creation here (later migrations replace it)
    return;
  end if;
  execute 'create or replace view public.ledger_entries as
    select id, sacco_id, debit_id, credit_id, amount, currency, value_date, external_id, memo, created_at
    from app.ledger_entries';
end$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'payments'
  ) then
    -- table still present; later migrations convert it to a view
    return;
  end if;
  execute 'create or replace view public.payments as
    select id, channel, sacco_id, ikimina_id, member_id, msisdn, msisdn_encrypted, msisdn_hash,
           msisdn_masked, amount, currency, txn_id, reference, occurred_at, status, source_id,
           ai_version, confidence, created_at
    from app.payments';
end$$;


CREATE OR REPLACE FUNCTION public.search_saccos(query text, limit_count integer DEFAULT 20, district_filter text DEFAULT NULL::text, province_filter text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, sector text, district text, province text, email text, category text, similarity_score numeric, rank_score numeric)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  WITH params AS (
    SELECT
      NULLIF(trim(query), '') AS sanitized_query,
      NULLIF(trim(district_filter), '') AS district_like,
      NULLIF(trim(province_filter), '') AS province_like,
      LEAST(GREATEST(COALESCE(limit_count, 20), 1), 100) AS limit_size
  ), expanded AS (
    SELECT
      params.limit_size,
      params.district_like,
      params.province_like,
      params.sanitized_query,
      CASE
        WHEN params.sanitized_query IS NULL THEN NULL
        ELSE websearch_to_tsquery('simple', params.sanitized_query)
      END AS ts_query
    FROM params
  ), ranked AS (
    SELECT
      s.id,
      s.name,
      s.sector,
      s.district,
      s.province,
      s.email,
      s.category,
      expanded.sanitized_query,
      expanded.ts_query,
      CASE
        WHEN expanded.sanitized_query IS NULL THEN 0
        ELSE similarity(s.name, expanded.sanitized_query)
      END AS trigram_name,
      CASE
        WHEN expanded.sanitized_query IS NULL THEN 0
        ELSE similarity(COALESCE(s.sector, '') || ' ' || COALESCE(s.district, ''), expanded.sanitized_query)
      END AS trigram_location,
      CASE
        WHEN expanded.ts_query IS NULL THEN 0
        ELSE ts_rank(s.search_document, expanded.ts_query)
      END AS ts_rank_score
    FROM public.saccos s
    CROSS JOIN expanded
    WHERE (
      expanded.sanitized_query IS NULL
      OR (
        (expanded.ts_query IS NOT NULL AND s.search_document @@ expanded.ts_query)
        OR (
          expanded.sanitized_query IS NOT NULL
          AND similarity(s.name, expanded.sanitized_query) > 0.1
        )
        OR (
          expanded.sanitized_query IS NOT NULL
          AND similarity(COALESCE(s.sector, '') || ' ' || COALESCE(s.district, ''), expanded.sanitized_query) > 0.1
        )
      )
    )
      AND (expanded.district_like IS NULL OR s.district ILIKE expanded.district_like)
      AND (expanded.province_like IS NULL OR s.province ILIKE expanded.province_like)
  )
  SELECT
    id,
    name,
    sector,
    district,
    province,
    email,
    category,
    GREATEST(trigram_name, trigram_location) AS similarity_score,
    ts_rank_score + GREATEST(trigram_name, trigram_location) AS rank_score
  FROM ranked
  ORDER BY rank_score DESC, similarity_score DESC, name ASC
  LIMIT (SELECT limit_size FROM expanded LIMIT 1)
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_mfa_recovery_codes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_configuration_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

create policy "gi_select_limited"
on "public"."group_invites"
as permissive
for select
to public
using (((invitee_user_id = auth.uid()) OR (auth.role() = 'service_role'::text)));


create policy "gi_update_accept"
on "public"."group_invites"
as permissive
for update
to public
using (((invitee_user_id = auth.uid()) OR (auth.role() = 'service_role'::text)))
with check (((invitee_user_id = auth.uid()) OR (auth.role() = 'service_role'::text)));


create policy "ikimina_select_all_auth"
on "public"."ikimina"
as permissive
for select
to public
using ((auth.uid() IS NOT NULL));


create policy "jr_insert_self"
on "public"."join_requests"
as permissive
for insert
to public
with check ((user_id = auth.uid()));


create policy "jr_select_self"
on "public"."join_requests"
as permissive
for select
to public
using ((user_id = auth.uid()));


create policy "members_select_guarded"
on "public"."members"
as permissive
for select
to public
using ((is_user_member_of_group(ikimina_id) OR (auth.role() = 'service_role'::text)));


create policy "prof_insert_self"
on "public"."members_app_profiles"
as permissive
for insert
to public
with check ((user_id = auth.uid()));


create policy "prof_select_self"
on "public"."members_app_profiles"
as permissive
for select
to public
using ((user_id = auth.uid()));


create policy "prof_update_self"
on "public"."members_app_profiles"
as permissive
for update
to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));


create policy "notif_insert_service"
on "public"."notifications"
as permissive
for insert
to public
with check (((user_id = auth.uid()) OR (auth.role() = 'service_role'::text)));


create policy "notif_select_self"
on "public"."notifications"
as permissive
for select
to public
using ((user_id = auth.uid()));


create policy "notif_update_self"
on "public"."notifications"
as permissive
for update
to public
using ((user_id = auth.uid()));


create policy "us_insert_self"
on "public"."user_saccos"
as permissive
for insert
to public
with check ((user_id = auth.uid()));


create policy "us_select_self"
on "public"."user_saccos"
as permissive
for select
to public
using ((user_id = auth.uid()));


CREATE TRIGGER trg_members_app_profiles_touch BEFORE UPDATE ON public.members_app_profiles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
