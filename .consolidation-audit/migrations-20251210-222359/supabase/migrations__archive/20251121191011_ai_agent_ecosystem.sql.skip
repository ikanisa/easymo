-- =====================================================================
-- AI AGENT ECOSYSTEM SCHEMA
-- =====================================================================
-- Creates normalized schema for multi-agent AI system
-- Agents: Waiter, Farmer, Business Broker, Real Estate, Jobs, Sales SDR
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. MASTER AGENT REGISTRY
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  default_persona_code text,
  default_system_instruction_code text,
  default_language text DEFAULT 'en',
  default_channel text DEFAULT 'whatsapp',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agents_slug ON public.ai_agents(slug);
CREATE INDEX IF NOT EXISTS idx_ai_agents_is_active ON public.ai_agents(is_active);

COMMENT ON TABLE public.ai_agents IS 'Master registry of all AI agents in the ecosystem';
COMMENT ON COLUMN public.ai_agents.slug IS 'Machine-friendly identifier (e.g. waiter, farmer, broker)';
COMMENT ON COLUMN public.ai_agents.metadata IS 'Free-form config: rate limits, API keys, environment settings';

-- =====================================================================
-- 2. AGENT PERSONAS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.ai_agent_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  code text NOT NULL,
  role_name text,
  tone_style text,
  languages text[] DEFAULT ARRAY[]::text[],
  traits jsonb DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_personas_agent_id ON public.ai_agent_personas(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_personas_code ON public.ai_agent_personas(code);
CREATE INDEX IF NOT EXISTS idx_ai_agent_personas_default ON public.ai_agent_personas(agent_id, is_default) WHERE is_default = true;

COMMENT ON TABLE public.ai_agent_personas IS 'Persona definitions: tone, language, behavioral traits per agent';
COMMENT ON COLUMN public.ai_agent_personas.traits IS 'Structured persona traits (e.g. formality, humor, empathy levels)';

-- =====================================================================
-- 3. SYSTEM INSTRUCTIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.ai_agent_system_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  code text NOT NULL,
  title text,
  instructions text NOT NULL,
  guardrails text,
  memory_strategy text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_system_instructions_agent_id ON public.ai_agent_system_instructions(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_system_instructions_code ON public.ai_agent_system_instructions(code);
CREATE INDEX IF NOT EXISTS idx_ai_agent_system_instructions_active ON public.ai_agent_system_instructions(agent_id, is_active) WHERE is_active = true;

COMMENT ON TABLE public.ai_agent_system_instructions IS 'System prompts, guardrails, and memory strategies per agent';
COMMENT ON COLUMN public.ai_agent_system_instructions.memory_strategy IS 'Description of conversation state/memory handling approach';

-- =====================================================================
-- 4. AGENT TOOLS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.ai_agent_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  name text NOT NULL,
  display_name text,
  tool_type text NOT NULL,
  description text,
  input_schema jsonb DEFAULT '{}'::jsonb,
  output_schema jsonb DEFAULT '{}'::jsonb,
  config jsonb DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_agent_id ON public.ai_agent_tools(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_type ON public.ai_agent_tools(tool_type);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_active ON public.ai_agent_tools(agent_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_input_schema ON public.ai_agent_tools USING GIN(input_schema);

COMMENT ON TABLE public.ai_agent_tools IS 'Tool registry: database queries, APIs, Deep Search, Maps, etc.';
COMMENT ON COLUMN public.ai_agent_tools.tool_type IS 'Tool category: db, http, deep_search, maps, sip, whatsapp, momo';
COMMENT ON COLUMN public.ai_agent_tools.config IS 'Tool configuration: endpoints, timeouts, credentials';

-- =====================================================================
-- 5. AGENT TASKS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.ai_agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  trigger_description text,
  tools_used text[] DEFAULT ARRAY[]::text[],
  output_description text,
  requires_human_handoff boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_agent_id ON public.ai_agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_code ON public.ai_agent_tasks(code);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_handoff ON public.ai_agent_tasks(requires_human_handoff) WHERE requires_human_handoff = true;

COMMENT ON TABLE public.ai_agent_tasks IS 'Tasks/actions per agent: order taking, job matching, cold calling, etc.';
COMMENT ON COLUMN public.ai_agent_tasks.trigger_description IS 'Natural language description of when this task activates';
COMMENT ON COLUMN public.ai_agent_tasks.tools_used IS 'Array of tool names this task depends on';

-- =====================================================================
-- 6. KNOWLEDGE BASES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.ai_agent_knowledge_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  storage_type text NOT NULL,
  access_method text NOT NULL,
  update_strategy text,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_knowledge_bases_agent_id ON public.ai_agent_knowledge_bases(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_knowledge_bases_code ON public.ai_agent_knowledge_bases(code);
CREATE INDEX IF NOT EXISTS idx_ai_agent_knowledge_bases_storage_type ON public.ai_agent_knowledge_bases(storage_type);

COMMENT ON TABLE public.ai_agent_knowledge_bases IS 'Knowledge sources: menus, catalogues, directories, listings';
COMMENT ON COLUMN public.ai_agent_knowledge_bases.storage_type IS 'Storage mechanism: table, view, vector_store, external';
COMMENT ON COLUMN public.ai_agent_knowledge_bases.access_method IS 'How agent accesses: direct_db, tool:name, deep_search';

-- =====================================================================
-- 7. MASTER AGENTS OVERVIEW VIEW
-- =====================================================================

CREATE OR REPLACE VIEW public.ai_agents_overview_v AS
SELECT
  a.id,
  a.slug,
  a.name,
  a.description,
  a.default_language,
  a.default_channel,
  a.is_active,
  p.code AS default_persona_code,
  p.role_name AS default_persona_role_name,
  si.code AS default_system_instruction_code,
  si.title AS default_system_instruction_title,
  COALESCE(tool_counts.tool_count, 0) AS tool_count,
  COALESCE(task_counts.task_count, 0) AS task_count,
  COALESCE(kb_counts.kb_count, 0) AS kb_count,
  a.created_at,
  a.updated_at
FROM public.ai_agents a
LEFT JOIN public.ai_agent_personas p
  ON p.agent_id = a.id AND p.is_default = true
LEFT JOIN public.ai_agent_system_instructions si
  ON si.agent_id = a.id
  AND si.code = a.default_system_instruction_code
  AND si.is_active = true
LEFT JOIN (
  SELECT agent_id, count(*) AS tool_count
  FROM public.ai_agent_tools
  WHERE is_active = true
  GROUP BY agent_id
) AS tool_counts ON tool_counts.agent_id = a.id
LEFT JOIN (
  SELECT agent_id, count(*) AS task_count
  FROM public.ai_agent_tasks
  GROUP BY agent_id
) AS task_counts ON task_counts.agent_id = a.id
LEFT JOIN (
  SELECT agent_id, count(*) AS kb_count
  FROM public.ai_agent_knowledge_bases
  GROUP BY agent_id
) AS kb_counts ON kb_counts.agent_id = a.id;

COMMENT ON VIEW public.ai_agents_overview_v IS 'Aggregated view of all agents with their default configs and counts';

-- =====================================================================
-- 8. UPDATE TRIGGERS
-- =====================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  -- ai_agents
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_ai_agents') THEN
    CREATE TRIGGER set_updated_at_ai_agents
      BEFORE UPDATE ON public.ai_agents
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;

  -- ai_agent_personas
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_ai_agent_personas') THEN
    CREATE TRIGGER set_updated_at_ai_agent_personas
      BEFORE UPDATE ON public.ai_agent_personas
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;

  -- ai_agent_system_instructions
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_ai_agent_system_instructions') THEN
    CREATE TRIGGER set_updated_at_ai_agent_system_instructions
      BEFORE UPDATE ON public.ai_agent_system_instructions
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;

  -- ai_agent_tools
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_ai_agent_tools') THEN
    CREATE TRIGGER set_updated_at_ai_agent_tools
      BEFORE UPDATE ON public.ai_agent_tools
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;

  -- ai_agent_tasks
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_ai_agent_tasks') THEN
    CREATE TRIGGER set_updated_at_ai_agent_tasks
      BEFORE UPDATE ON public.ai_agent_tasks
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;

  -- ai_agent_knowledge_bases
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_ai_agent_knowledge_bases') THEN
    CREATE TRIGGER set_updated_at_ai_agent_knowledge_bases
      BEFORE UPDATE ON public.ai_agent_knowledge_bases
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- =====================================================================
-- 9. INITIAL SEED DATA
-- =====================================================================

-- Insert 6 core agents
INSERT INTO public.ai_agents (slug, name, description, default_persona_code, default_system_instruction_code, default_language, default_channel)
VALUES
  ('waiter', 'Waiter AI Agent', 'Virtual waiter for restaurants and bars: menu browsing, order taking, MoMo payment', 'W-PERSONA', 'W-SYS', 'multi', 'whatsapp'),
  ('farmer', 'Farmer AI Agent', 'Agricultural marketplace assistant: produce listing, buyer matching, market prices', 'F-PERSONA', 'F-SYS', 'multi', 'whatsapp'),
  ('business_broker', 'Business Broker AI Agent', 'Local business discovery: pharmacies, hardware stores, services nearby', 'BB-PERSONA', 'BB-SYS', 'multi', 'whatsapp'),
  ('real_estate', 'Real Estate AI Agent', 'Rental concierge: property search, landlord-tenant matching, viewings', 'RE-PERSONA', 'RE-SYS', 'multi', 'whatsapp'),
  ('jobs', 'Jobs AI Agent', 'Job marketplace: job seeker matching, gig posts, long-term positions', 'J-PERSONA', 'J-SYS', 'multi', 'whatsapp'),
  ('sales_cold_caller', 'Sales/Marketing SDR Agent', 'Cold calling SDR for easyMO: lead qualification, demo booking, follow-ups', 'SDR-PERSONA', 'SDR-SYS', 'en', 'voice')
ON CONFLICT (slug) DO NOTHING;

-- Insert default personas
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, is_default)
SELECT 
  a.id,
  CASE a.slug
    WHEN 'waiter' THEN 'W-PERSONA'
    WHEN 'farmer' THEN 'F-PERSONA'
    WHEN 'business_broker' THEN 'BB-PERSONA'
    WHEN 'real_estate' THEN 'RE-PERSONA'
    WHEN 'jobs' THEN 'J-PERSONA'
    WHEN 'sales_cold_caller' THEN 'SDR-PERSONA'
  END,
  CASE a.slug
    WHEN 'waiter' THEN 'Virtual Waiter / Maître d'''
    WHEN 'farmer' THEN 'Agricultural Market Assistant'
    WHEN 'business_broker' THEN 'Local Business Concierge'
    WHEN 'real_estate' THEN 'Property Rental Specialist'
    WHEN 'jobs' THEN 'Career Matchmaker'
    WHEN 'sales_cold_caller' THEN 'Sales Development Representative'
  END,
  CASE a.slug
    WHEN 'waiter' THEN 'Warm, professional, service-oriented'
    WHEN 'farmer' THEN 'Practical, supportive, market-savvy'
    WHEN 'business_broker' THEN 'Helpful, knowledgeable, efficient'
    WHEN 'real_estate' THEN 'Professional, thorough, reassuring'
    WHEN 'jobs' THEN 'Encouraging, objective, career-focused'
    WHEN 'sales_cold_caller' THEN 'Confident, consultative, value-driven'
  END,
  ARRAY['en', 'fr', 'rw']::text[],
  true
FROM public.ai_agents a
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_agent_personas p WHERE p.agent_id = a.id AND p.is_default = true
);

-- Insert default system instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT
  a.id,
  CASE a.slug
    WHEN 'waiter' THEN 'W-SYS'
    WHEN 'farmer' THEN 'F-SYS'
    WHEN 'business_broker' THEN 'BB-SYS'
    WHEN 'real_estate' THEN 'RE-SYS'
    WHEN 'jobs' THEN 'J-SYS'
    WHEN 'sales_cold_caller' THEN 'SDR-SYS'
  END,
  CASE a.slug
    WHEN 'waiter' THEN 'Waiter Agent System Instructions v1'
    WHEN 'farmer' THEN 'Farmer Agent System Instructions v1'
    WHEN 'business_broker' THEN 'Business Broker System Instructions v1'
    WHEN 'real_estate' THEN 'Real Estate Agent System Instructions v1'
    WHEN 'jobs' THEN 'Jobs Agent System Instructions v1'
    WHEN 'sales_cold_caller' THEN 'Sales SDR System Instructions v1'
  END,
  CASE a.slug
    WHEN 'waiter' THEN 'You are a virtual waiter helping customers browse menus, place orders, and complete payments via MoMo.'
    WHEN 'farmer' THEN 'You are an agricultural marketplace assistant helping farmers list produce and match with buyers.'
    WHEN 'business_broker' THEN 'You are a local business discovery agent helping users find nearby businesses and services.'
    WHEN 'real_estate' THEN 'You are a rental concierge helping people find properties and connecting landlords with tenants.'
    WHEN 'jobs' THEN 'You are a job marketplace assistant helping job seekers find opportunities and employers find candidates.'
    WHEN 'sales_cold_caller' THEN 'You are a sales development representative for easyMO, qualifying leads and booking demos.'
  END,
  'Always be respectful. Never share personal information. Escalate to human for sensitive issues.',
  'Maintain conversation context across messages. Store key facts in session memory.',
  true
FROM public.ai_agents a
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_agent_system_instructions si 
  WHERE si.agent_id = a.id 
  AND si.code = CASE a.slug
    WHEN 'waiter' THEN 'W-SYS'
    WHEN 'farmer' THEN 'F-SYS'
    WHEN 'business_broker' THEN 'BB-SYS'
    WHEN 'real_estate' THEN 'RE-SYS'
    WHEN 'jobs' THEN 'J-SYS'
    WHEN 'sales_cold_caller' THEN 'SDR-SYS'
  END
);

COMMIT;
