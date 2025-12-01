BEGIN;

-- Enable RLS and add service-role policies for LLM-related tables

-- llm_requests
ALTER TABLE IF EXISTS public.llm_requests ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'llm_requests' AND policyname = 'svc_rw_llm_requests'
  ) THEN
    CREATE POLICY svc_rw_llm_requests ON public.llm_requests
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (true);
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.llm_requests TO service_role;

-- llm_failover_events
ALTER TABLE IF EXISTS public.llm_failover_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'llm_failover_events' AND policyname = 'svc_rw_llm_failover'
  ) THEN
    CREATE POLICY svc_rw_llm_failover ON public.llm_failover_events
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (true);
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.llm_failover_events TO service_role;

-- tool_provider_routing
ALTER TABLE IF EXISTS public.tool_provider_routing ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tool_provider_routing' AND policyname = 'svc_rw_tool_routing'
  ) THEN
    CREATE POLICY svc_rw_tool_routing ON public.tool_provider_routing
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (true);
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tool_provider_routing TO service_role;

COMMENT ON POLICY svc_rw_llm_requests ON public.llm_requests IS 'Service role full access to LLM requests table';
COMMENT ON POLICY svc_rw_llm_failover ON public.llm_failover_events IS 'Service role full access to LLM failover events';
COMMENT ON POLICY svc_rw_tool_routing ON public.tool_provider_routing IS 'Service role full access to tool routing table';

COMMIT;

