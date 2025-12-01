-- =====================================================================
-- AI AGENT ECOSYSTEM – COMPLETE SUPABASE SCHEMA (WHATSAPP-FIRST)
-- =====================================================================
-- Migration: AI Agent ecosystem with Rides & Insurance agents
-- Created: 2025-11-22
-- Purpose: Implement normalized schema for WhatsApp-first AI agents
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

CREATE INDEX IF NOT EXISTS idx_ai_agents_slug ON public.ai_agents(slug);
CREATE INDEX IF NOT EXISTS idx_ai_agents_is_active ON public.ai_agents(is_active);

-- Agent personas
CREATE TABLE IF NOT EXISTS public.ai_agent_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  code text,
  role_name text,
  tone_style text,
  languages text[] DEFAULT '{}'::text[],
  traits jsonb DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_personas_agent_id ON public.ai_agent_personas(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_personas_is_default ON public.ai_agent_personas(is_default);

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

CREATE INDEX IF NOT EXISTS idx_ai_agent_system_instructions_agent_id ON public.ai_agent_system_instructions(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_system_instructions_is_active ON public.ai_agent_system_instructions(is_active);

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

CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_agent_id ON public.ai_agent_tools(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_is_active ON public.ai_agent_tools(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_tool_type ON public.ai_agent_tools(tool_type);

-- Agent tasks/actions
CREATE TABLE IF NOT EXISTS public.ai_agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  code text,
  name text,
  description text,
  trigger_description text,
  tools_used text[] DEFAULT '{}'::text[],
  output_description text,
  requires_human_handoff boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_agent_id ON public.ai_agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_code ON public.ai_agent_tasks(code);

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

CREATE INDEX IF NOT EXISTS idx_ai_agent_knowledge_bases_agent_id ON public.ai_agent_knowledge_bases(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_knowledge_bases_code ON public.ai_agent_knowledge_bases(code);

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
  user_roles text[] DEFAULT '{}'::text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_users_phone_number ON public.whatsapp_users(phone_number);

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

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_user_id ON public.whatsapp_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_agent_id ON public.whatsapp_conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_status ON public.whatsapp_conversations(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_message_at ON public.whatsapp_conversations(last_message_at);

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

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_id ON public.whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_message_id ON public.whatsapp_messages(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_at ON public.whatsapp_messages(sent_at);

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

CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_conversation_id ON public.ai_agent_intents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_agent_id ON public.ai_agent_intents(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_intent_type ON public.ai_agent_intents(intent_type);
CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_status ON public.ai_agent_intents(status);

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

CREATE INDEX IF NOT EXISTS idx_ai_agent_match_events_agent_id ON public.ai_agent_match_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_match_events_match_type ON public.ai_agent_match_events(match_type);
CREATE INDEX IF NOT EXISTS idx_ai_agent_match_events_created_at ON public.ai_agent_match_events(created_at);

-- =====================================================================
-- 3. RIDES DOMAIN TABLES (WHATSAPP-FIRST)
-- =====================================================================

-- Named addresses per whatsapp_user
CREATE TABLE IF NOT EXISTS public.rides_saved_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  label text,
  address_text text,
  lat double precision,
  lng double precision,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rides_saved_locations_user_id ON public.rides_saved_locations(user_id);

-- Trips scheduled or completed between drivers and passengers
CREATE TABLE IF NOT EXISTS public.rides_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  driver_user_id uuid REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_address text,
  dropoff_lat double precision,
  dropoff_lng double precision,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  status text DEFAULT 'pending',
  price_estimate numeric,
  currency text DEFAULT 'RWF',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rides_trips_rider_user_id ON public.rides_trips(rider_user_id);
CREATE INDEX IF NOT EXISTS idx_rides_trips_driver_user_id ON public.rides_trips(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_rides_trips_status ON public.rides_trips(status);
CREATE INDEX IF NOT EXISTS idx_rides_trips_scheduled_at ON public.rides_trips(scheduled_at);

-- Driver status/availability
CREATE TABLE IF NOT EXISTS public.rides_driver_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  is_online boolean DEFAULT false,
  current_lat double precision,
  current_lng double precision,
  last_seen_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rides_driver_status_user_id ON public.rides_driver_status(user_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_status_is_online ON public.rides_driver_status(is_online);
CREATE INDEX IF NOT EXISTS idx_rides_driver_status_last_seen_at ON public.rides_driver_status(last_seen_at);

-- =====================================================================
-- 4. INSURANCE DOMAIN TABLES (WHATSAPP-FIRST)
-- =====================================================================

-- Per-user and per-vehicle insurance profile
CREATE TABLE IF NOT EXISTS public.insurance_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  vehicle_identifier text,
  vehicle_metadata jsonb DEFAULT '{}'::jsonb,
  owner_name text,
  owner_id_number text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_profiles_user_id ON public.insurance_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_profiles_vehicle_identifier ON public.insurance_profiles(vehicle_identifier);

-- Insurance-related documents
CREATE TABLE IF NOT EXISTS public.insurance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.insurance_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
  document_type text,
  file_url text,
  wa_message_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  uploaded_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_documents_profile_id ON public.insurance_documents(profile_id);
CREATE INDEX IF NOT EXISTS idx_insurance_documents_document_type ON public.insurance_documents(document_type);

-- Requests for new or renewed insurance cover
CREATE TABLE IF NOT EXISTS public.insurance_quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.insurance_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  intent_id uuid REFERENCES public.ai_agent_intents(id) ON UPDATE CASCADE ON DELETE SET NULL,
  request_type text,
  status text DEFAULT 'pending',
  requested_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  quote_details jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_quote_requests_profile_id ON public.insurance_quote_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_insurance_quote_requests_agent_id ON public.insurance_quote_requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_insurance_quote_requests_status ON public.insurance_quote_requests(status);

-- =====================================================================
-- 5. MASTER VIEW: AI AGENTS OVERVIEW
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
  ON p.agent_id = a.id AND p.is_default IS true
LEFT JOIN public.ai_agent_system_instructions si
  ON si.agent_id = a.id
 AND si.code = a.default_system_instruction_code
 AND si.is_active IS true
LEFT JOIN (
  SELECT agent_id, COUNT(*) AS tool_count
  FROM public.ai_agent_tools
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

-- =====================================================================
-- 6. SEED DATA FOR AGENTS
-- =====================================================================

-- Insert core agents (only if they don't exist)
INSERT INTO public.ai_agents (slug, name, description, default_language, default_channel, is_active)
VALUES
  ('waiter', 'Waiter AI Agent', 'Virtual restaurant waiter handling menu queries, orders, and reservations via WhatsApp', 'multi', 'whatsapp', true),
  ('farmer', 'Farmer AI Agent', 'Agricultural marketplace agent connecting farmers with buyers via WhatsApp', 'multi', 'whatsapp', true),
  ('business_broker', 'Business Broker AI Agent', 'Business directory and marketplace agent via WhatsApp', 'multi', 'whatsapp', true),
  ('real_estate', 'Real Estate AI Agent', 'Property search and rental agent via WhatsApp', 'multi', 'whatsapp', true),
  ('jobs', 'Jobs AI Agent', 'Job matching and posting agent via WhatsApp', 'multi', 'whatsapp', true),
  ('sales_cold_caller', 'Sales/Marketing Cold Caller AI Agent', 'Lead generation and cold calling agent via WhatsApp', 'multi', 'whatsapp', true),
  ('rides', 'Rides AI Agent', 'Handles nearby drivers/passengers and scheduled trips via WhatsApp', 'multi', 'whatsapp', true),
  ('insurance', 'Insurance AI Agent', 'Manages insurance info, documents & connects to insurers via WhatsApp', 'multi', 'whatsapp', true)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
