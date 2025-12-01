-- =====================================================================
-- AI AGENT ECOSYSTEM – SUPABASE SCHEMA (WHATSAPP-FIRST)
-- =====================================================================
-- Migration: AI Agent ecosystem tables for WhatsApp-first natural language
-- agents (Waiter, Farmer, Broker, Real Estate, Jobs, Sales, Rides, Insurance)
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
  default_language text,
  default_channel text,
  is_active boolean DEFAULT true,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agents_slug ON public.ai_agents(slug);
CREATE INDEX IF NOT EXISTS idx_ai_agents_active ON public.ai_agents(is_active) WHERE is_active = true;

-- Agent personas
CREATE TABLE IF NOT EXISTS public.ai_agent_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  code text,
  role_name text,
  tone_style text,
  languages text[],
  traits jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_personas_agent_id ON public.ai_agent_personas(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_personas_default ON public.ai_agent_personas(agent_id, is_default) WHERE is_default = true;

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
CREATE INDEX IF NOT EXISTS idx_ai_agent_system_instructions_active ON public.ai_agent_system_instructions(agent_id, is_active) WHERE is_active = true;

-- Agent tools registry
CREATE TABLE IF NOT EXISTS public.ai_agent_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  name text,
  display_name text,
  tool_type text,
  description text,
  input_schema jsonb,
  output_schema jsonb,
  config jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_agent_id ON public.ai_agent_tools(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_type ON public.ai_agent_tools(tool_type);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_active ON public.ai_agent_tools(agent_id, is_active) WHERE is_active = true;

-- Agent tasks/actions
CREATE TABLE IF NOT EXISTS public.ai_agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  code text,
  name text,
  description text,
  trigger_description text,
  tools_used text[],
  output_description text,
  requires_human_handoff boolean DEFAULT false,
  metadata jsonb,
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
  config jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_knowledge_bases_agent_id ON public.ai_agent_knowledge_bases(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_knowledge_bases_storage_type ON public.ai_agent_knowledge_bases(storage_type);

-- =====================================================================
-- 2. WHATSAPP-FIRST MESSAGING & INTENT TABLES
-- =====================================================================

-- WhatsApp users (one row per unique phone_number)
CREATE TABLE IF NOT EXISTS public.whatsapp_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL UNIQUE,
  display_name text,
  preferred_language text,
  timezone text,
  user_roles text[],
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_users_phone ON public.whatsapp_users(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_roles ON public.whatsapp_users USING GIN(user_roles);

-- WhatsApp conversations: user x agent x context
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  external_thread_id text,
  context text,
  status text DEFAULT 'active',
  last_message_at timestamptz,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_user_id ON public.whatsapp_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_agent_id ON public.whatsapp_conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_status ON public.whatsapp_conversations(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_message ON public.whatsapp_conversations(last_message_at DESC);

-- Raw WhatsApp messages (inbound + outbound)
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  direction text,
  wa_message_id text,
  message_type text,
  body text,
  payload jsonb,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_id ON public.whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_message_id ON public.whatsapp_messages(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction ON public.whatsapp_messages(direction);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_at ON public.whatsapp_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_payload ON public.whatsapp_messages USING GIN(payload);

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
  structured_payload jsonb,
  confidence numeric,
  status text DEFAULT 'pending',
  applied_at timestamptz,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_conversation_id ON public.ai_agent_intents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_agent_id ON public.ai_agent_intents(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_message_id ON public.ai_agent_intents(message_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_type ON public.ai_agent_intents(intent_type);
CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_status ON public.ai_agent_intents(status);
CREATE INDEX IF NOT EXISTS idx_ai_agent_intents_payload ON public.ai_agent_intents USING GIN(structured_payload);

-- Match events: linking demand <-> supply across domains
CREATE TABLE IF NOT EXISTS public.ai_agent_match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON UPDATE CASCADE ON DELETE SET NULL,
  intent_id uuid REFERENCES public.ai_agent_intents(id) ON UPDATE CASCADE ON DELETE SET NULL,
  match_type text,
  demand_ref jsonb,
  supply_ref jsonb,
  score numeric,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_match_events_agent_id ON public.ai_agent_match_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_match_events_conversation_id ON public.ai_agent_match_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_match_events_intent_id ON public.ai_agent_match_events(intent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_match_events_type ON public.ai_agent_match_events(match_type);

-- =====================================================================
-- 3. RIDES DOMAIN TABLES (WhatsApp-first, natural language)
-- =====================================================================

-- Named addresses per whatsapp_user
CREATE TABLE IF NOT EXISTS public.rides_saved_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  label text,
  address_text text,
  lat double precision,
  lng double precision,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rides_saved_locations_user_id ON public.rides_saved_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_rides_saved_locations_coords ON public.rides_saved_locations(lat, lng);

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
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rides_trips_rider_user_id ON public.rides_trips(rider_user_id);
CREATE INDEX IF NOT EXISTS idx_rides_trips_driver_user_id ON public.rides_trips(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_rides_trips_status ON public.rides_trips(status);
CREATE INDEX IF NOT EXISTS idx_rides_trips_scheduled_at ON public.rides_trips(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_rides_trips_pickup_coords ON public.rides_trips(pickup_lat, pickup_lng);
CREATE INDEX IF NOT EXISTS idx_rides_trips_dropoff_coords ON public.rides_trips(dropoff_lat, dropoff_lng);

-- Driver status/availability
CREATE TABLE IF NOT EXISTS public.rides_driver_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  is_online boolean DEFAULT false,
  current_lat double precision,
  current_lng double precision,
  last_seen_at timestamptz DEFAULT now(),
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_rides_driver_status_user_id ON public.rides_driver_status(user_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_status_online ON public.rides_driver_status(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_rides_driver_status_coords ON public.rides_driver_status(current_lat, current_lng);

-- =====================================================================
-- 4. INSURANCE DOMAIN TABLES (WhatsApp-first, natural language)
-- =====================================================================

-- Per-user and per-vehicle insurance profile
CREATE TABLE IF NOT EXISTS public.insurance_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  vehicle_identifier text,
  vehicle_metadata jsonb,
  owner_name text,
  owner_id_number text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_profiles_user_id ON public.insurance_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_profiles_vehicle_id ON public.insurance_profiles(vehicle_identifier);

-- Insurance-related documents submitted over WhatsApp
CREATE TABLE IF NOT EXISTS public.insurance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.insurance_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
  document_type text,
  file_url text,
  wa_message_id text,
  metadata jsonb,
  uploaded_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_documents_profile_id ON public.insurance_documents(profile_id);
CREATE INDEX IF NOT EXISTS idx_insurance_documents_type ON public.insurance_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_insurance_documents_wa_message_id ON public.insurance_documents(wa_message_id);

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
  quote_details jsonb,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_quote_requests_profile_id ON public.insurance_quote_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_insurance_quote_requests_agent_id ON public.insurance_quote_requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_insurance_quote_requests_intent_id ON public.insurance_quote_requests(intent_id);
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

COMMIT;
