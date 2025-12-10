-- Agent toolkits store per-persona configuration for Responses API tools
-- Enables runtime selection of web search, file search, retrieval, and image generation

BEGIN;

CREATE TABLE IF NOT EXISTS public.agent_toolkits (
  agent_kind text PRIMARY KEY,
  model text NOT NULL DEFAULT 'gpt-5',
  reasoning_effort text NOT NULL DEFAULT 'medium' CHECK (reasoning_effort IN ('minimal','low','medium','high')),
  text_verbosity text NOT NULL DEFAULT 'medium' CHECK (text_verbosity IN ('low','medium','high')),
  web_search_enabled boolean NOT NULL DEFAULT false,
  web_search_allowed_domains text[] DEFAULT NULL,
  web_search_user_location jsonb,
  file_search_enabled boolean NOT NULL DEFAULT false,
  file_vector_store_id text,
  file_search_max_results integer,
  retrieval_enabled boolean NOT NULL DEFAULT false,
  retrieval_vector_store_id text,
  retrieval_max_results integer,
  retrieval_rewrite boolean NOT NULL DEFAULT true,
  image_generation_enabled boolean NOT NULL DEFAULT false,
  image_preset jsonb,
  allowed_tools jsonb,
  suggestions text[] DEFAULT ARRAY[]::text[],
  streaming_partial_images integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER agent_toolkits_set_updated
BEFORE UPDATE ON public.agent_toolkits
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.agent_toolkits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'is_admin' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'CREATE POLICY agent_toolkits_admin_manage ON public.agent_toolkits
      FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  ELSE
    EXECUTE 'CREATE POLICY agent_toolkits_admin_manage ON public.agent_toolkits
      FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
  END IF;
END;
$$;

-- Seed defaults for core personas. Vector store identifiers and allowed tools
-- can be updated from the admin console once provisioned.
INSERT INTO public.agent_toolkits (
  agent_kind,
  model,
  reasoning_effort,
  text_verbosity,
  web_search_enabled,
  web_search_user_location,
  file_search_enabled,
  retrieval_enabled,
  image_generation_enabled,
  suggestions,
  allowed_tools,
  metadata
) VALUES
  (
    'broker',
    'gpt-5',
    'medium',
    'medium',
    true,
    jsonb_build_object('type','approximate','country','RW','city','Kigali','region','Kigali'),
    true,
    true,
    false,
    ARRAY['Summarise the shortlist','Send WhatsApp decision pack','Escalate to a human broker'],
    '[{"type":"web_search"},{"type":"file_search"}]'::jsonb,
    jsonb_build_object('description','Marketplace broker toolkit')
  ),
  (
    'marketing',
    'gpt-5-mini',
    'low',
    'medium',
    true,
    jsonb_build_object('type','approximate','country','RW','city','Kigali'),
    true,
    true,
    true,
    ARRAY['Draft WhatsApp follow-up','Request campaign metrics','Escalate to marketing lead'],
    '[{"type":"web_search"},{"type":"file_search"},{"type":"image_generation"}]'::jsonb,
    jsonb_build_object('description','Marketing concierge toolkit')
  ),
  (
    'sales',
    'gpt-5',
    'low',
    'low',
    false,
    NULL,
    true,
    true,
    false,
    ARRAY['Qualify the lead','Schedule a call','Escalate to closer'],
    '[{"type":"file_search"}]'::jsonb,
    jsonb_build_object('description','Sales closer toolkit')
  ),
  (
    'support',
    'gpt-5-mini',
    'low',
    'medium',
    false,
    NULL,
    true,
    true,
    false,
    ARRAY['Provide troubleshooting steps','Escalate ticket','Close issue'],
    '[{"type":"file_search"}]'::jsonb,
    jsonb_build_object('description','Support assistant toolkit')
  ),
  (
    'mobility',
    'gpt-5-mini',
    'medium',
    'medium',
    true,
    jsonb_build_object('type','approximate','country','RW','city','Kigali','region','Dispatch'),
    true,
    true,
    true,
    ARRAY['Share driver availability','Send ETA update','Escalate to dispatcher'],
    '[{"type":"web_search"},{"type":"file_search"},{"type":"image_generation"}]'::jsonb,
    jsonb_build_object('description','Mobility operations toolkit')
  )
ON CONFLICT (agent_kind) DO NOTHING;

COMMIT;
