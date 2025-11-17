BEGIN;

-- Enable RLS and add policies for WhatsApp/agent roles on previously flagged tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'analytics_events_2026_04', 'analytics_events_2026_05',
      'event_store_2026_04', 'event_store_2026_05',
      'job_categories', 'job_sources',
      'momo_parsed_txns', 'momo_sms_inbox',
      'referral_attributions', 'referral_clicks', 'referral_links',
      'send_logs', 'send_queue',
      'leaderboard_notifications', 'leaderboard_snapshots',
      'promo_rules', 'segments'
    ])
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

      -- Service role retains full control
      EXECUTE format(
        'CREATE POLICY IF NOT EXISTS "service_role_full_access" ON public.%I '
        || 'FOR ALL USING (auth.role() = ''service_role'') '
        || 'WITH CHECK (auth.role() = ''service_role'');',
        tbl
      );

      -- WhatsApp automation needs read + append rights
      EXECUTE format(
        'CREATE POLICY IF NOT EXISTS "whatsapp_read" ON public.%I '
        || 'FOR SELECT USING (auth.role() IN (''whatsapp'', ''agent'', ''service_role''));',
        tbl
      );
      EXECUTE format(
        'CREATE POLICY IF NOT EXISTS "whatsapp_insert" ON public.%I '
        || 'FOR INSERT WITH CHECK (auth.role() IN (''whatsapp'', ''agent'', ''service_role''));',
        tbl
      );

      -- Agents get the same read/append shape for parity with WhatsApp bots
      EXECUTE format(
        'CREATE POLICY IF NOT EXISTS "agent_read" ON public.%I '
        || 'FOR SELECT USING (auth.role() IN (''agent'', ''service_role''));',
        tbl
      );
      EXECUTE format(
        'CREATE POLICY IF NOT EXISTS "agent_insert" ON public.%I '
        || 'FOR INSERT WITH CHECK (auth.role() IN (''agent'', ''service_role''));',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- Remove overlapping RPC that is no longer used by WhatsApp chat flows
DROP FUNCTION IF EXISTS public.get_shops_by_tag(text, double precision, double precision, double precision, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_shops_by_tag(text, double precision, double precision, double precision) CASCADE;
DROP FUNCTION IF EXISTS public.get_shops_by_tag(text, double precision, double precision) CASCADE;

COMMIT;
