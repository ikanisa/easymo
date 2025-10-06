-- Convert legacy bigint-based campaigns schema to the UUID structure expected by the Admin app
-- and update dependent tables to reference the new identifiers.

do $$
declare
  needs_migration boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'campaigns'
      and column_name = 'id'
      and data_type <> 'uuid'
  ) into needs_migration;

  if not needs_migration then
    raise notice 'campaigns.id already uses uuid – skipping legacy conversion';
    return;
  end if;

  -- Drop legacy foreign keys/constraints that reference the bigint campaign id.
  execute 'ALTER TABLE public.campaign_recipients DROP CONSTRAINT IF EXISTS campaign_recipients_campaign_id_fkey';
  execute 'ALTER TABLE public.campaign_recipients DROP CONSTRAINT IF EXISTS campaign_recipients_campaign_id_contact_id_key';
  execute 'ALTER TABLE public.send_queue DROP CONSTRAINT IF EXISTS send_queue_campaign_id_fkey';
  execute 'ALTER TABLE public.send_logs DROP CONSTRAINT IF EXISTS send_logs_campaign_id_fkey';

  -- Add a UUID surrogate and prepare admin-facing columns.
  execute 'ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS id_uuid uuid DEFAULT gen_random_uuid()';
  execute 'UPDATE public.campaigns SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL';

  execute 'ALTER TABLE public.campaigns RENAME COLUMN template_id TO template_id_legacy';
  execute 'ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS template_id text';
  execute $cmd$UPDATE public.campaigns
            SET template_id = COALESCE(template_id,
                                       NULLIF(template_id_legacy::text, ''),
                                       NULLIF(payload->>'name', ''),
                                       'custom_text');$cmd$;

  execute 'ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS name text';
  execute $cmd$UPDATE public.campaigns
            SET name = COALESCE(NULLIF(name, ''), NULLIF(title, ''), 'Campaign ' || id);$cmd$;

  execute 'ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_type_check';
  execute 'ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS type text';
  execute $cmd$UPDATE public.campaigns
            SET type = COALESCE(type,
                                 CASE upper(COALESCE(message_kind, ''))
                                   WHEN '' THEN NULL
                                   WHEN 'VOUCHER' THEN 'voucher'
                                   WHEN 'TEMPLATE' THEN 'promo'
                                   WHEN 'TEXT' THEN 'promo'
                                   ELSE 'promo'
                                 END);$cmd$;
  execute 'UPDATE public.campaigns SET type = ''promo'' WHERE type IS NULL';
  execute 'ALTER TABLE public.campaigns ALTER COLUMN type SET DEFAULT ''promo''';

  execute 'ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS created_by uuid';
  execute 'ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS started_at timestamptz';
  execute 'ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS finished_at timestamptz';
  execute 'ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS metadata jsonb';
  execute $cmd$UPDATE public.campaigns
            SET metadata = jsonb_strip_nulls(
              COALESCE(metadata, '{}'::jsonb) ||
              jsonb_build_object(
                'legacy_id', id,
                'legacy_template_id', template_id_legacy,
                'legacy_payload', payload,
                'legacy_target_audience', target_audience,
                'legacy_time_zone', time_zone,
                'legacy_scheduled_at', scheduled_at
              )
            );$cmd$;
  execute 'UPDATE public.campaigns SET metadata = ''{}''::jsonb WHERE metadata IS NULL';

  execute 'ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check';
  execute $cmd$UPDATE public.campaigns
            SET status = CASE upper(COALESCE(status, ''))
                            WHEN 'RUNNING' THEN 'running'
                            WHEN 'PAUSED' THEN 'paused'
                            WHEN 'COMPLETED' THEN 'done'
                            WHEN 'DONE' THEN 'done'
                            WHEN 'SENT' THEN 'done'
                            WHEN 'QUEUED' THEN 'draft'
                            WHEN 'PENDING' THEN 'draft'
                            WHEN '' THEN 'draft'
                            ELSE 'draft'
                          END;$cmd$;
  execute 'ALTER TABLE public.campaigns ALTER COLUMN status SET DEFAULT ''draft''';

  -- Prepare dependent tables with UUID columns.
  execute 'ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS campaign_uuid uuid';
  execute $cmd$UPDATE public.campaign_recipients cr
            SET campaign_uuid = c.id_uuid
           FROM public.campaigns c
          WHERE cr.campaign_id = c.id;$cmd$;

  execute 'ALTER TABLE public.send_queue ADD COLUMN IF NOT EXISTS campaign_uuid uuid';
  execute $cmd$UPDATE public.send_queue sq
            SET campaign_uuid = c.id_uuid
           FROM public.campaigns c
          WHERE sq.campaign_id = c.id;$cmd$;

  execute 'ALTER TABLE public.send_logs ADD COLUMN IF NOT EXISTS campaign_uuid uuid';
  execute $cmd$UPDATE public.send_logs sl
            SET campaign_uuid = c.id_uuid
           FROM public.campaigns c
          WHERE sl.campaign_id = c.id;$cmd$;

  -- Ensure every legacy reference found a UUID mapping.
  if exists (select 1 from public.campaign_recipients where campaign_id is not null and campaign_uuid is null) then
    raise exception 'campaign_recipients rows without UUID mapping detected';
  end if;
  if exists (select 1 from public.send_queue where campaign_id is not null and campaign_uuid is null) then
    raise exception 'send_queue rows without UUID mapping detected';
  end if;

  -- Replace primary key and legacy columns.
  execute 'ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_pkey';
  execute 'ALTER TABLE public.campaigns RENAME COLUMN id TO legacy_id';
  execute 'ALTER TABLE public.campaigns RENAME COLUMN id_uuid TO id';
  execute 'ALTER TABLE public.campaigns ALTER COLUMN id SET DEFAULT gen_random_uuid()';
  execute 'ALTER TABLE public.campaigns ALTER COLUMN id SET NOT NULL';
  execute 'ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id)';
  execute 'ALTER TABLE public.campaigns ALTER COLUMN legacy_id DROP DEFAULT';
  execute 'DROP SEQUENCE IF EXISTS public.campaigns_id_seq';

  -- Rewire dependent tables to the UUID key.
  execute 'ALTER TABLE public.campaign_recipients RENAME COLUMN campaign_id TO campaign_id_legacy';
  execute 'ALTER TABLE public.campaign_recipients RENAME COLUMN campaign_uuid TO campaign_id';
  execute 'ALTER TABLE public.campaign_recipients DROP COLUMN IF EXISTS campaign_id_legacy';
  execute 'ALTER TABLE public.campaign_recipients ALTER COLUMN campaign_id SET NOT NULL';

  execute 'ALTER TABLE public.send_queue RENAME COLUMN campaign_id TO campaign_id_legacy';
  execute 'ALTER TABLE public.send_queue RENAME COLUMN campaign_uuid TO campaign_id';
  execute 'ALTER TABLE public.send_queue DROP COLUMN IF EXISTS campaign_id_legacy';
  execute 'ALTER TABLE public.send_queue ALTER COLUMN campaign_id SET NOT NULL';

  execute 'ALTER TABLE public.send_logs RENAME COLUMN campaign_id TO campaign_id_legacy';
  execute 'ALTER TABLE public.send_logs RENAME COLUMN campaign_uuid TO campaign_id';
  execute 'ALTER TABLE public.send_logs DROP COLUMN IF EXISTS campaign_id_legacy';

  -- Recreate constraints and supporting indexes.
  execute 'ALTER TABLE public.campaign_recipients ADD CONSTRAINT campaign_recipients_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE';
  execute 'ALTER TABLE public.campaign_recipients ADD CONSTRAINT campaign_recipients_campaign_id_contact_id_key UNIQUE (campaign_id, contact_id)';

  execute 'ALTER TABLE public.send_queue ADD CONSTRAINT send_queue_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE';
  execute 'ALTER TABLE public.send_logs ADD CONSTRAINT send_logs_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL';

  execute 'CREATE INDEX IF NOT EXISTS campaigns_created_at_idx ON public.campaigns (created_at DESC)';
  execute 'CREATE INDEX IF NOT EXISTS send_queue_campaign_idx ON public.send_queue (campaign_id)';
  execute 'CREATE INDEX IF NOT EXISTS send_logs_campaign_idx ON public.send_logs (campaign_id)';

  -- Finalise column defaults/nullability for the new schema.
  execute 'UPDATE public.campaigns SET template_id = ''custom_text'' WHERE template_id IS NULL OR template_id = ''''';
  execute 'ALTER TABLE public.campaigns ALTER COLUMN template_id SET DEFAULT ''custom_text''';
  execute 'ALTER TABLE public.campaigns ALTER COLUMN template_id SET NOT NULL';
  execute 'ALTER TABLE public.campaigns ALTER COLUMN metadata SET DEFAULT ''{}''::jsonb';
  execute 'ALTER TABLE public.campaigns ALTER COLUMN metadata SET NOT NULL';
  execute 'ALTER TABLE public.campaigns ALTER COLUMN name SET NOT NULL';
  execute 'ALTER TABLE public.campaigns ALTER COLUMN type SET NOT NULL';
  execute 'ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_type_check CHECK (type IN (''promo'',''voucher''))';
  execute 'ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_status_check CHECK (status IN (''draft'',''running'',''paused'',''done''))';
  execute 'ALTER TABLE public.campaign_recipients ALTER COLUMN campaign_id SET NOT NULL';
  execute 'ALTER TABLE public.send_queue ALTER COLUMN campaign_id SET NOT NULL';

  -- Drop legacy marketing columns now that data lives in metadata.
  execute 'ALTER TABLE public.campaigns DROP COLUMN IF EXISTS title';
  execute 'ALTER TABLE public.campaigns DROP COLUMN IF EXISTS message_kind';
  execute 'ALTER TABLE public.campaigns DROP COLUMN IF EXISTS payload';
  execute 'ALTER TABLE public.campaigns DROP COLUMN IF EXISTS target_audience';
  execute 'ALTER TABLE public.campaigns DROP COLUMN IF EXISTS scheduled_at';
  execute 'ALTER TABLE public.campaigns DROP COLUMN IF EXISTS time_zone';
  execute 'ALTER TABLE public.campaigns DROP COLUMN IF EXISTS template_id_legacy';
end;
$$;

-- Ensure the new UUID campaigns table is referenced by campaign_targets when present.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'campaign_targets'
      and column_name = 'campaign_id'
      and data_type = 'uuid'
  ) then
    execute 'ALTER TABLE public.campaign_targets DROP CONSTRAINT IF EXISTS campaign_targets_campaign_id_fkey';
    execute 'ALTER TABLE public.campaign_targets ADD CONSTRAINT campaign_targets_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE';
  end if;
end;
$$;

-- Keep campaign status lookup performant (idempotent for fresh environments).
create index if not exists campaigns_status_idx on public.campaigns (status);
