set check_function_bodies = off;

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


create table "app"."mfa_codes" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid not null,
    "code" text not null,
    "expires_at" timestamp with time zone not null,
    "created_at" timestamp with time zone not null default now(),
    "consumed" boolean not null default false
);


alter table "app"."mfa_codes" enable row level security;

alter table "app"."mfa_email_codes" enable row level security;

drop view if exists "public"."saccos";

alter table "app"."saccos" drop column "search_slug";

alter table "app"."saccos" add column "search_slug" text generated always as (TRIM(BOTH '-'::text FROM lower(regexp_replace(COALESCE(name, ''::text), '[^a-z0-9]+'::text, '-'::text, 'g'::text)))) stored;

CREATE INDEX idx_mfa_codes_code ON app.mfa_codes USING btree (code);

CREATE INDEX idx_mfa_codes_user_id ON app.mfa_codes USING btree (user_id);

CREATE UNIQUE INDEX mfa_codes_pkey ON app.mfa_codes USING btree (id);

alter table "app"."mfa_codes" add constraint "mfa_codes_pkey" PRIMARY KEY using index "mfa_codes_pkey";

alter table "app"."mfa_codes" add constraint "mfa_codes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "app"."mfa_codes" validate constraint "mfa_codes_user_id_fkey";

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

CREATE OR REPLACE FUNCTION app.sync_financial_institution_from_saccos()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if tg_op = 'DELETE' then
    delete from app.financial_institutions where sacco_id = old.id;
    return old;
  end if;

  insert into app.financial_institutions (name, kind, district, sacco_id)
  values (new.name, 'SACCO', new.district, new.id)
  on conflict (sacco_id)
  do update set
    name = excluded.name,
    district = excluded.district,
    updated_at = timezone('UTC', now());

  return new;
end;
$function$
;

create policy "mfa_codes_insert_own"
on "app"."mfa_codes"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "mfa_codes_select_own"
on "app"."mfa_codes"
as permissive
for select
to public
using (((auth.uid() = user_id) OR (auth.role() = 'service_role'::text)));


create policy "mfa_codes_update_service_role"
on "app"."mfa_codes"
as permissive
for update
to public
using ((auth.role() = 'service_role'::text));


create policy "mfa_email_codes_self_manage"
on "app"."mfa_email_codes"
as permissive
for all
to public
using (((auth.uid() = user_id) OR app.is_admin()))
with check (((auth.uid() = user_id) OR app.is_admin()));



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
end;
$do$;

revoke delete on table "public"."ikimina" from "anon";

revoke insert on table "public"."ikimina" from "anon";

revoke references on table "public"."ikimina" from "anon";

revoke select on table "public"."ikimina" from "anon";

revoke trigger on table "public"."ikimina" from "anon";

revoke truncate on table "public"."ikimina" from "anon";

revoke update on table "public"."ikimina" from "anon";

revoke delete on table "public"."ikimina" from "authenticated";

revoke insert on table "public"."ikimina" from "authenticated";

revoke references on table "public"."ikimina" from "authenticated";

revoke select on table "public"."ikimina" from "authenticated";

revoke trigger on table "public"."ikimina" from "authenticated";

revoke truncate on table "public"."ikimina" from "authenticated";

revoke update on table "public"."ikimina" from "authenticated";

revoke delete on table "public"."ikimina" from "service_role";

revoke insert on table "public"."ikimina" from "service_role";

revoke references on table "public"."ikimina" from "service_role";

revoke select on table "public"."ikimina" from "service_role";

revoke trigger on table "public"."ikimina" from "service_role";

revoke truncate on table "public"."ikimina" from "service_role";

revoke update on table "public"."ikimina" from "service_role";

revoke delete on table "public"."members" from "anon";

revoke insert on table "public"."members" from "anon";

revoke references on table "public"."members" from "anon";

revoke select on table "public"."members" from "anon";

revoke trigger on table "public"."members" from "anon";

revoke truncate on table "public"."members" from "anon";

revoke update on table "public"."members" from "anon";

revoke delete on table "public"."members" from "authenticated";

revoke insert on table "public"."members" from "authenticated";

revoke references on table "public"."members" from "authenticated";

revoke select on table "public"."members" from "authenticated";

revoke trigger on table "public"."members" from "authenticated";

revoke truncate on table "public"."members" from "authenticated";

revoke update on table "public"."members" from "authenticated";

revoke delete on table "public"."members" from "service_role";

revoke insert on table "public"."members" from "service_role";

revoke references on table "public"."members" from "service_role";

revoke select on table "public"."members" from "service_role";

revoke trigger on table "public"."members" from "service_role";

revoke truncate on table "public"."members" from "service_role";

revoke update on table "public"."members" from "service_role";

alter table "public"."members" drop constraint "members_ikimina_id_fkey";

drop view if exists "public"."saccos";

drop view if exists "public"."ledger_entries";

drop view if exists "public"."payments";

drop view if exists "public"."sms_inbox";

alter table "public"."rate_limit_counters" enable row level security;

alter table "public"."sms_templates" enable row level security;

alter table "public"."members" add constraint "members_ikimina_id_fkey" FOREIGN KEY (ikimina_id) REFERENCES ikimina(id) ON DELETE CASCADE not valid;

alter table "public"."members" validate constraint "members_ikimina_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.debug_seed_counts()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select jsonb_build_object(
    'saccos', (select count(*) from app.saccos),
    'ikimina', (select count(*) from app.ikimina),
    'members', (select count(*) from app.members),
    'accounts', (select count(*) from app.accounts),
    'ledger_entries', (select count(*) from app.ledger_entries),
    'payments', (select count(*) from app.payments),
    'sms_inbox', (select count(*) from app.sms_inbox),
    'import_files', (select count(*) from app.import_files),
    'audit_logs', (select count(*) from app.audit_logs)
  );
$function$
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

CREATE OR REPLACE FUNCTION public.current_user_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.debug_auth_users_columns()
 RETURNS TABLE(column_name text, data_type text, is_nullable text, column_default text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'information_schema'
AS $function$
  select
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
  from information_schema.columns c
  where c.table_schema = 'auth'
    and c.table_name = 'users'
  order by c.ordinal_position;
$function$
;

CREATE OR REPLACE FUNCTION public.debug_auth_users_tokens()
 RETURNS TABLE(id uuid, email text, confirmation_token text, email_change_token_current text, email_change_token_new text, recovery_token text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
  select
    u.id,
    u.email,
    u.confirmation_token,
    u.email_change_token_current,
    u.email_change_token_new,
    u.recovery_token,
    u.created_at,
    u.updated_at
  from auth.users u;
$function$
;

CREATE OR REPLACE FUNCTION public.debug_null_text_columns()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
declare
  result jsonb := '{}'::jsonb;
  rec record;
  cnt bigint;
begin
  for rec in
    select column_name
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and data_type in ('text', 'character varying')
  loop
    execute format('select count(*) from auth.users where %I is null', rec.column_name) into cnt;
    result := result || jsonb_build_object(rec.column_name, cnt);
  end loop;
  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.debug_null_tokens()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
  select jsonb_build_object(
    'null_confirmation_token', (select count(*) from auth.users where confirmation_token is null),
    'null_email_change_token_current', (select count(*) from auth.users where email_change_token_current is null),
    'null_email_change_token_new', (select count(*) from auth.users where email_change_token_new is null),
    'null_recovery_token', (select count(*) from auth.users where recovery_token is null)
  );
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

create or replace view "public"."ledger_entries" as  SELECT id,
    sacco_id,
    debit_id,
    credit_id,
    amount,
    currency,
    value_date,
    external_id,
    memo,
    created_at
   FROM app.ledger_entries;


create or replace view "public"."payments" as  SELECT id,
    channel,
    sacco_id,
    ikimina_id,
    member_id,
    msisdn,
    msisdn_encrypted,
    msisdn_hash,
    msisdn_masked,
    amount,
    currency,
    txn_id,
    reference,
    occurred_at,
    status,
    source_id,
    ai_version,
    confidence,
    created_at
   FROM app.payments;


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

create or replace view "public"."sms_inbox" as  SELECT id,
    sacco_id,
    raw_text,
    msisdn,
    msisdn_encrypted,
    msisdn_hash,
    msisdn_masked,
    received_at,
    vendor_meta,
    parsed_json,
    parse_source,
    confidence,
    status,
    error,
    created_at
   FROM app.sms_inbox;


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

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$
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

create policy "rate_limit_counters_admin"
on "public"."rate_limit_counters"
as permissive
for all
to public
using (app.is_admin())
with check (app.is_admin());


create policy "sms_templates_admin"
on "public"."sms_templates"
as permissive
for all
to public
using (app.is_admin())
with check (app.is_admin());




  create policy "Authenticated delete statements"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'statements'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Authenticated insert statements"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'statements'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Authenticated read statements"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'statements'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Authenticated update statements"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'statements'::text) AND (auth.role() = 'authenticated'::text)))
with check (((bucket_id = 'statements'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder 1va6avm_0"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'uploads'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder 1va6avm_1"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'uploads'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder 1va6avm_2"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'uploads'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder 1va6avm_3"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'uploads'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder i3p58f_0"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'reports'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder i3p58f_1"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'reports'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder i3p58f_2"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'reports'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder i3p58f_3"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'reports'::text) AND (auth.role() = 'authenticated'::text)));
