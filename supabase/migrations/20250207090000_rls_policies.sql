-- Enable and define RLS policies for operational tables

-- voucher_events RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'voucher_events'
  ) THEN
    RAISE NOTICE 'voucher_events table missing; skipping RLS setup';
  ELSE
    EXECUTE 'ALTER TABLE public.voucher_events ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.voucher_events FORCE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "voucher_events_admin_select" ON public.voucher_events';
    EXECUTE $$CREATE POLICY "voucher_events_admin_select"
      ON public.voucher_events
      FOR SELECT
      USING (
        auth.role() = ''service_role'' OR
        coalesce(auth.jwt()->>''role'', '''') IN (''super_admin'',''support'',''data_ops'',''readonly'')
      )$$;

    EXECUTE 'DROP POLICY IF EXISTS "voucher_events_station_select" ON public.voucher_events';
    EXECUTE $$CREATE POLICY "voucher_events_station_select"
      ON public.voucher_events
      FOR SELECT
      USING (
        (auth.jwt()->>''role'') = ''station_operator'' AND
        (auth.jwt()->>''station_id'') IS NOT NULL AND
        station_id IS NOT NULL AND
        (auth.jwt()->>''station_id'')::uuid = station_id
      )$$;
  END IF;
END
$$;

-- campaign_targets RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaign_targets'
  ) THEN
    RAISE NOTICE 'campaign_targets table missing; skipping RLS setup';
  ELSE
    EXECUTE 'ALTER TABLE public.campaign_targets ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.campaign_targets FORCE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "campaign_targets_admin_select" ON public.campaign_targets';
    EXECUTE $$CREATE POLICY "campaign_targets_admin_select"
      ON public.campaign_targets
      FOR SELECT
      USING (
        auth.role() = ''service_role'' OR
        coalesce(auth.jwt()->>''role'', '''') IN (''super_admin'',''support'',''data_ops'')
      )$$;
  END IF;
END
$$;

-- settings RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'settings'
  ) THEN
    RAISE NOTICE 'settings table missing; skipping RLS setup';
  ELSE
    EXECUTE 'ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.settings FORCE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "settings_admin_read" ON public.settings';
    EXECUTE $$CREATE POLICY "settings_admin_read"
      ON public.settings
      FOR SELECT
      USING (
        auth.role() = ''service_role'' OR
        coalesce(auth.jwt()->>''role'', '''') IN (''super_admin'',''support'',''data_ops'')
      )$$;

    EXECUTE 'DROP POLICY IF EXISTS "settings_admin_insert" ON public.settings';
    EXECUTE $$CREATE POLICY "settings_admin_insert"
      ON public.settings
      FOR INSERT
      WITH CHECK (
        auth.role() = ''service_role'' OR
        coalesce(auth.jwt()->>''role'', '''') IN (''super_admin'',''support'',''data_ops'')
      )$$;

    EXECUTE 'DROP POLICY IF EXISTS "settings_admin_update" ON public.settings';
    EXECUTE $$CREATE POLICY "settings_admin_update"
      ON public.settings
      FOR UPDATE
      USING (
        auth.role() = ''service_role'' OR
        coalesce(auth.jwt()->>''role'', '''') IN (''super_admin'',''support'',''data_ops'')
      )
      WITH CHECK (
        auth.role() = ''service_role'' OR
        coalesce(auth.jwt()->>''role'', '''') IN (''super_admin'',''support'',''data_ops'')
      )$$;

    EXECUTE 'DROP POLICY IF EXISTS "settings_admin_delete" ON public.settings';
    EXECUTE $$CREATE POLICY "settings_admin_delete"
      ON public.settings
      FOR DELETE
      USING (
        auth.role() = ''service_role'' OR
        coalesce(auth.jwt()->>''role'', '''') IN (''super_admin'',''support'',''data_ops'')
      )$$;
  END IF;
END
$$;
