-- =====================================================================
-- AI AGENT ECOSYSTEM – SUPABASE SCHEMA (WHATSAPP-FIRST)
-- =====================================================================
-- Migration: AI Agent Ecosystem with WhatsApp-First Interaction Model
-- Created: 2025-11-21
-- Description: Normalized schema for multi-agent AI ecosystem where all
--              user interactions occur via WhatsApp. Agents parse natural
--              language, store structured intents, and manage domain data.
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. CORE AGENT META TABLES
-- =====================================================================

-- Master agent registry
CREATE TABLE IF NOT EXISTS public.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  default_persona_code text,
  default_system_instruction_code text,
  default_language text DEFAULT 'en',
  default_channel text DEFAULT 'whatsapp',
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.ai_agents IS 
'Master registry of AI agents (waiter, farmer, broker, real_estate, jobs, sales_cold_caller). One row per logical agent integration.';

-- Agent personas
CREATE TABLE IF NOT EXISTS public.ai_agent_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  code text,
  role_name text,
  tone_style text,
  languages text[] DEFAULT ARRAY['en']::text[],
  traits jsonb DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.ai_agent_personas IS 
'Persona definitions per agent (tone, languages, traits). Typically one default persona per agent.';

-- System instructions / prompts / guardrails
CREATE TABLE IF NOT EXISTS public.ai_agent_system_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  code text,
  title text,
  instructions text,
  guardrails text,
  memory_strategy text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.ai_agent_system_instructions IS 
'System prompts, guardrails, and memory strategies per agent. Allows multiple versions via code.';

-- Agent tools registry
CREATE TABLE IF NOT EXISTS public.ai_agent_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  name text,
  display_name text,
  tool_type text,
  description text,
  input_schema jsonb DEFAULT '{}'::jsonb,
  output_schema jsonb DEFAULT '{}'::jsonb,
  config jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.ai_agent_tools IS 
'Tools an agent can invoke (DB functions, HTTP endpoints, deep search, Maps, SIP, WhatsApp templates, etc.).';

-- Agent tasks/actions
CREATE TABLE IF NOT EXISTS public.ai_agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  code text,
  name text,
  description text,
  trigger_description text,
  tools_used text[] DEFAULT ARRAY[]::text[],
  output_description text,
  requires_human_handoff boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.ai_agent_tasks IS 
'High-level tasks per agent (e.g. waiter_take_order, farmer_create_listing, jobs_match, real_estate_shortlist_5). Each task can use multiple tools.';

-- Agent knowledge bases registry
CREATE TABLE IF NOT EXISTS public.ai_agent_knowledge_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  code text,
  name text,
  description text,
  storage_type text,
  access_method text,
  update_strategy text,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.ai_agent_knowledge_bases IS 
'Logical knowledge bases per agent (restaurant_menus, produce_catalogue, business_directory, property_listings, job_seekers, lead_db, etc.). These point to underlying tables/views/vector stores.';

-- =====================================================================
-- 2. WHATSAPP-FIRST MESSAGING & INTENT TABLES
-- =====================================================================

-- WhatsApp users (one row per unique phone_number)
CREATE TABLE IF NOT EXISTS public.whatsapp_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL UNIQUE,
  display_name text,
  preferred_language text DEFAULT 'en',
  timezone text,
  user_roles text[] DEFAULT ARRAY[]::text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.whatsapp_users IS 
'All end-users and business staff that interact via WhatsApp. Phone number (E.164 format) is the primary identity.';

-- WhatsApp conversations: user x agent x context
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  external_thread_id text,
  context text,
  status text DEFAULT 'active',
  last_message_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.whatsapp_conversations IS 
'Logical conversation thread between a WhatsApp user and a specific AI agent (e.g. Waiter for Bar X, Jobs agent, Real Estate agent).';

-- Raw WhatsApp messages (inbound + outbound)
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  direction text,
  wa_message_id text,
  message_type text,
  body text,
  payload jsonb DEFAULT '{}'::jsonb,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.whatsapp_messages IS 
'Raw WhatsApp messages for each conversation, both from the user and from the AI agent. Used for debugging, auditing, and re-parsing.';

-- Parsed intents: agent's understanding of a user message
CREATE TABLE IF NOT EXISTS public.ai_agent_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  message_id uuid REFERENCES public.whatsapp_messages(id) ON UPDATE CASCADE ON DELETE SET NULL,
  intent_type text,
  intent_subtype text,
  raw_text text,
  summary text,
  structured_payload jsonb DEFAULT '{}'::jsonb,
  confidence numeric,
  status text DEFAULT 'pending',
  applied_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.ai_agent_intents IS 
'Structured representation of what the agent thinks the user wants per inbound message. Natural language is turned into structured JSON used to update domain tables.';

-- Match events: linking demand <-> supply across domains
CREATE TABLE IF NOT EXISTS public.ai_agent_match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON UPDATE CASCADE ON DELETE SET NULL,
  intent_id uuid REFERENCES public.ai_agent_intents(id) ON UPDATE CASCADE ON DELETE SET NULL,
  match_type text,
  demand_ref jsonb DEFAULT '{}'::jsonb,
  supply_ref jsonb DEFAULT '{}'::jsonb,
  score numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.ai_agent_match_events IS 
'Generic log of matches found by any agent: jobs matched to seekers, properties matched to renters, produce matched to buyers, menu items suggested to guests, etc. Domain-agnostic using generic IDs + metadata.';

-- =====================================================================
-- 3. INDEXES FOR PERFORMANCE
-- =====================================================================

-- ai_agents indexes
CREATE INDEX IF NOT EXISTS idx_ai_agents_slug ON public.ai_agents(slug);
CREATE INDEX IF NOT EXISTS idx_ai_agents_is_active ON public.ai_agents(is_active) WHERE is_active = true;

-- ai_agent_personas indexes
CREATE INDEX IF NOT EXISTS idx_ai_agent_personas_agent_id ON public.ai_agent_personas(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_personas_is_default ON public.ai_agent_personas(agent_id, is_default) WHERE is_default = true;

-- ai_agent_system_instructions indexes
CREATE INDEX IF NOT EXISTS idx_ai_agent_system_instructions_agent_id ON public.ai_agent_system_instructions(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_system_instructions_code ON public.ai_agent_system_instructions(agent_id, code);
CREATE INDEX IF NOT EXISTS idx_ai_agent_system_instructions_is_active ON public.ai_agent_system_instructions(agent_id, is_active) WHERE is_active = true;

-- ai_agent_tools indexes
CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_agent_id ON public.ai_agent_tools(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_is_active ON public.ai_agent_tools(agent_id, is_active) WHERE is_active = true;

-- ai_agent_tasks indexes
CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_agent_id ON public.ai_agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_code ON public.ai_agent_tasks(agent_id, code);

-- ai_agent_knowledge_bases indexes
CREATE INDEX IF NOT EXISTS idx_ai_agent_knowledge_bases_agent_id ON public.ai_agent_knowledge_bases(agent_id);

-- whatsapp_users indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_phone_number ON public.whatsapp_users(phone_number);

-- whatsapp_conversations indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_user_id ON public.whatsapp_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_agent_id ON public.whatsapp_conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_status ON public.whatsapp_conversations(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_message_at ON public.whatsapp_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_user_agent_status ON public.whatsapp_conversations(user_id, agent_id, status);

-- whatsapp_messages indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_id ON public.whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_message_id ON public.whatsapp_messages(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_at ON public.whatsapp_messages(sent_at DESC);

-- ai_agent_intents indexes
CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_conversation_id ON public.ai_agent_intents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_agent_id ON public.ai_agent_intents(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_message_id ON public.ai_agent_intents(message_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_intent_type ON public.ai_agent_intents(intent_type);
CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_status ON public.ai_agent_intents(status);
CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_type_status ON public.ai_agent_intents(intent_type, status);

-- ai_agent_match_events indexes
CREATE INDEX IF NOT EXISTS idx_ai_agent_match_events_agent_id ON public.ai_agent_match_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_match_events_conversation_id ON public.ai_agent_match_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_match_events_intent_id ON public.ai_agent_match_events(intent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_match_events_match_type ON public.ai_agent_match_events(match_type);
CREATE INDEX IF NOT EXISTS idx_ai_agent_match_events_created_at ON public.ai_agent_match_events(created_at DESC);

-- GIN indexes for JSONB columns (optional, for advanced queries)
CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_structured_payload ON public.ai_agent_intents USING GIN (structured_payload);
CREATE INDEX IF NOT EXISTS idx_ai_agent_match_events_metadata ON public.ai_agent_match_events USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_payload ON public.whatsapp_messages USING GIN (payload);

-- =====================================================================
-- 4. MASTER VIEW: AI AGENTS OVERVIEW
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
  ON p.agent_id = a.id AND p.is_default IS TRUE
LEFT JOIN public.ai_agent_system_instructions si
  ON si.agent_id = a.id
 AND si.code = a.default_system_instruction_code
 AND si.is_active IS TRUE
LEFT JOIN (
  SELECT agent_id, COUNT(*) AS tool_count
  FROM public.ai_agent_tools
  WHERE is_active = true
  GROUP BY agent_id
) AS tool_counts
  ON tool_counts.agent_id = a.id
LEFT JOIN (
  SELECT agent_id, COUNT(*) AS task_count
  FROM public.ai_agent_tasks
  GROUP BY agent_id
) AS task_counts
  ON task_counts.agent_id = a.id
LEFT JOIN (
  SELECT agent_id, COUNT(*) AS kb_count
  FROM public.ai_agent_knowledge_bases
  GROUP BY agent_id
) AS kb_counts
  ON kb_counts.agent_id = a.id;

COMMENT ON VIEW public.ai_agents_overview_v IS 
'Comprehensive overview of all AI agents with their default configurations, persona, system instructions, and counts of tools, tasks, and knowledge bases.';

COMMIT;
