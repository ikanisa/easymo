-- =====================================================================
-- RIDES & INSURANCE AGENTS - SEED DATA
-- =====================================================================
-- This file provides seed data for Rides and Insurance agents
-- Load this after the schema migration
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. INSERT RIDES & INSURANCE AGENTS
-- =====================================================================

INSERT INTO public.ai_agents (slug, name, description, default_persona_code, default_system_instruction_code, default_language, default_channel, is_active)
VALUES
  (
    'rides',
    'Rides AI Agent',
    'Handles nearby drivers/passengers and scheduled trips via WhatsApp natural language chat',
    'R-PERSONA-RIDES',
    'R-SYS-RIDES',
    'en',
    'whatsapp',
    true
  ),
  (
    'insurance',
    'Insurance AI Agent',
    'Manages insurance documents, quote requests, and policy renewals via WhatsApp natural language chat',
    'I-PERSONA-INSURANCE',
    'I-SYS-INSURANCE',
    'en',
    'whatsapp',
    true
  )
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- 2. INSERT PERSONAS
-- =====================================================================

-- Rides Agent Persona
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT
  id,
  'R-PERSONA-RIDES',
  'Rides Coordinator',
  'Calm, fast, very short messages',
  ARRAY['en', 'fr', 'rw'],
  jsonb_build_object(
    'message_style', 'emoji_numbered_options',
    'confirmation_style', 'single_sentence_recap',
    'response_speed', 'immediate',
    'uses_emojis', true
  ),
  true
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

-- Insurance Agent Persona
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT
  id,
  'I-PERSONA-INSURANCE',
  'Insurance Advisor',
  'Clear, reassuring, no jargon',
  ARRAY['en', 'fr', 'rw'],
  jsonb_build_object(
    'message_style', 'precise_requirements',
    'confirmation_style', 'recap_what_received',
    'reassurance_level', 'high',
    'avoids_jargon', true
  ),
  true
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 3. INSERT SYSTEM INSTRUCTIONS
-- =====================================================================

-- Rides Agent System Instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT
  id,
  'R-SYS-RIDES',
  'Rides Agent System Prompt',
  'You are the Rides AI Agent on WhatsApp.
Users chat in natural language. You:

1. Parse what they want (ride now, later, driver or passenger)
2. Convert to structured records in Supabase (ride requests, trips, saved locations)
3. Use DB filters and semantic search to find nearest & best matches (drivers ↔ passengers)
4. Respond with short messages and numbered emoji options (1️⃣, 2️⃣, 3️⃣)
5. Keep all coordination in WhatsApp: confirmations, changes, cancellations

Always confirm pickup & drop-off with a single sentence recap.
Always use emoji numbers for options.',
  'Never give pricing without database confirmation. Always verify driver availability. Confirm addresses before creating trips. Respect user location privacy.',
  'Remember saved locations per user (Home, Work). Track active trips. Maintain driver/passenger preferences. Store conversation context for multi-turn flows.',
  true
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

-- Insurance Agent System Instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT
  id,
  'I-SYS-INSURANCE',
  'Insurance Agent System Prompt',
  'You are the Insurance AI Agent on WhatsApp.
You:

1. Ask users for documents (insurance certificate, carte jaune, etc.) in natural language
2. Parse documents & messages, create/update insurance profiles & policies in Supabase
3. When user wants new/renewed insurance, create structured quote request for human/partner follow-up
4. Reply with very short, numbered messages and clear next actions
5. All interactions happen in WhatsApp

Always recap what was received and what will happen next.
Use numbered options for clarity.',
  'Never give legal/medical advice. Only describe coverage; escalate to human for final offers. Verify document completeness. Protect user data.',
  'Remember user vehicles and existing policies. Track document submissions. Maintain quote request status. Store conversation flow for multi-step processes.',
  true
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 4. INSERT TOOLS
-- =====================================================================

-- Rides Agent Tools
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'rides_upsert_saved_location',
  'Save Location',
  'db',
  'Store named addresses per user (Home, Work, etc.)',
  jsonb_build_object(
    'type', 'object',
    'properties', jsonb_build_object(
      'user_id', jsonb_build_object('type', 'string'),
      'label', jsonb_build_object('type', 'string'),
      'address_text', jsonb_build_object('type', 'string'),
      'lat', jsonb_build_object('type', 'number'),
      'lng', jsonb_build_object('type', 'number')
    )
  ),
  jsonb_build_object('type', 'object'),
  jsonb_build_object('table', 'rides_saved_locations', 'upsert_on', ARRAY['user_id', 'label']),
  true
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'rides_create_request',
  'Create Ride Request',
  'db',
  'Create a ride request (now vs scheduled, driver/passenger)',
  jsonb_build_object(
    'type', 'object',
    'properties', jsonb_build_object(
      'rider_user_id', jsonb_build_object('type', 'string'),
      'pickup_address', jsonb_build_object('type', 'string'),
      'dropoff_address', jsonb_build_object('type', 'string'),
      'scheduled_at', jsonb_build_object('type', 'string', 'format', 'date-time')
    )
  ),
  jsonb_build_object('type', 'object'),
  jsonb_build_object('table', 'rides_trips', 'insert_mode', 'single'),
  true
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'rides_search_matches',
  'Find Compatible Rides',
  'db',
  'Find compatible drivers or passengers nearby',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('role', jsonb_build_object('type', 'string'))),
  jsonb_build_object('type', 'array'),
  jsonb_build_object('search_strategy', 'proximity', 'max_distance_km', 10),
  true
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'rides_update_trip_status',
  'Update Trip Status',
  'db',
  'Set trip status: pending, accepted, en_route, completed, cancelled',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('trip_id', jsonb_build_object('type', 'string'), 'status', jsonb_build_object('type', 'string'))),
  jsonb_build_object('type', 'object'),
  jsonb_build_object('table', 'rides_trips', 'update_mode', 'single'),
  true
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

-- Insurance Agent Tools
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'insurance_upsert_profile',
  'Save Insurance Profile',
  'db',
  'Create/update insurance profile per user and vehicle',
  jsonb_build_object(
    'type', 'object',
    'properties', jsonb_build_object(
      'user_id', jsonb_build_object('type', 'string'),
      'vehicle_identifier', jsonb_build_object('type', 'string'),
      'owner_name', jsonb_build_object('type', 'string')
    )
  ),
  jsonb_build_object('type', 'object'),
  jsonb_build_object('table', 'insurance_profiles', 'upsert_on', ARRAY['user_id', 'vehicle_identifier']),
  true
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'insurance_store_document',
  'Store Insurance Document',
  'db',
  'Store links/metadata for uploaded docs (certificates, carte jaune)',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('profile_id', jsonb_build_object('type', 'string'), 'document_type', jsonb_build_object('type', 'string'), 'file_url', jsonb_build_object('type', 'string'))),
  jsonb_build_object('type', 'object'),
  jsonb_build_object('table', 'insurance_documents', 'insert_mode', 'single'),
  true
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'insurance_create_quote_request',
  'Create Quote Request',
  'db',
  'Create structured request for new/renewal policy',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('profile_id', jsonb_build_object('type', 'string'), 'request_type', jsonb_build_object('type', 'string'))),
  jsonb_build_object('type', 'object'),
  jsonb_build_object('table', 'insurance_quote_requests', 'insert_mode', 'single'),
  true
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'insurance_list_user_policies',
  'List User Policies',
  'db',
  'List active/expired policies linked to user',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('user_id', jsonb_build_object('type', 'string'))),
  jsonb_build_object('type', 'array'),
  jsonb_build_object('table', 'insurance_quote_requests', 'filter_column', 'profile_id'),
  true
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 5. INSERT TASKS
-- =====================================================================

-- Rides Agent Tasks
INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT
  id,
  'rides_find_driver',
  'Find Driver',
  'User wants a driver now or scheduled',
  'Keywords: need ride, get driver, take me to, book ride',
  ARRAY['rides_create_request', 'rides_search_matches'],
  'Create ride request, find nearby drivers, present top matches with emoji numbers',
  false,
  jsonb_build_object('priority', 'high', 'response_time_target_seconds', 10)
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT
  id,
  'rides_find_passenger',
  'Find Passenger',
  'Driver wants passengers along a route (carpool/empty seats)',
  'Keywords: looking for passengers, have empty seats, going to',
  ARRAY['rides_search_matches'],
  'Find riders along driver route, present matches',
  false,
  jsonb_build_object('priority', 'medium')
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT
  id,
  'rides_schedule_trip',
  'Schedule Trip',
  'User wants a trip at specific date/time',
  'Keywords: tomorrow, next week, schedule, book for',
  ARRAY['rides_create_request', 'rides_upsert_saved_location'],
  'Create scheduled trip, save locations if named',
  false,
  jsonb_build_object('priority', 'medium')
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT
  id,
  'rides_cancel_trip',
  'Cancel Trip',
  'Cancel or modify existing trip',
  'Keywords: cancel, change, modify trip',
  ARRAY['rides_update_trip_status'],
  'Update trip status to cancelled, notify other party',
  false,
  jsonb_build_object('priority', 'high')
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

-- Insurance Agent Tasks
INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT
  id,
  'insurance_submit_documents',
  'Submit Documents',
  'Guided flow for uploading & confirming docs',
  'Keywords: insurance, certificate, carte jaune, upload document',
  ARRAY['insurance_upsert_profile', 'insurance_store_document'],
  'Guide user through document upload, store metadata, confirm receipt',
  false,
  jsonb_build_object('priority', 'high', 'requires_document_validation', true)
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT
  id,
  'insurance_request_quote',
  'Request Quote',
  'Create new quote request from natural language',
  'Keywords: new insurance, get quote, how much, cost',
  ARRAY['insurance_upsert_profile', 'insurance_create_quote_request'],
  'Create quote request, mark for partner follow-up, give timeline',
  true,
  jsonb_build_object('priority', 'high', 'requires_partner_action', true)
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT
  id,
  'insurance_renew_policy',
  'Renew Policy',
  'Identify expiring policy and initiate renewal',
  'Keywords: renew, extend, expiring soon',
  ARRAY['insurance_list_user_policies', 'insurance_create_quote_request'],
  'Find expiring policy, create renewal request, notify user of next steps',
  true,
  jsonb_build_object('priority', 'medium', 'requires_partner_action', true)
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT
  id,
  'insurance_check_status',
  'Check Status',
  'Show user where their request is in the pipeline',
  'Keywords: status, progress, what happened, check request',
  ARRAY['insurance_list_user_policies'],
  'Show status of all quotes/policies, give updates',
  false,
  jsonb_build_object('priority', 'low')
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 6. INSERT KNOWLEDGE BASES
-- =====================================================================

-- Rides Knowledge Bases
INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT
  id,
  'rides_saved_locations',
  'Saved Locations',
  'Per-user saved addresses (Home, Work, etc.)',
  'table',
  'tool:rides_upsert_saved_location',
  'user_driven',
  jsonb_build_object('table', 'rides_saved_locations')
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT
  id,
  'rides_trips',
  'Trip History',
  'History of trips for reuse & suggestions',
  'table',
  'direct_db',
  'auto',
  jsonb_build_object('table', 'rides_trips')
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT
  id,
  'rides_live_availability',
  'Driver Availability',
  'Last known locations & status for active drivers',
  'table',
  'direct_db',
  'realtime',
  jsonb_build_object('table', 'rides_driver_status', 'ttl_minutes', 15)
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

-- Insurance Knowledge Bases
INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT
  id,
  'insurance_profiles',
  'Insurance Profiles',
  'Per user, per vehicle basic data',
  'table',
  'tool:insurance_upsert_profile',
  'user_driven',
  jsonb_build_object('table', 'insurance_profiles')
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT
  id,
  'insurance_policies',
  'User Policies',
  'Policies linked to users and vehicles',
  'table',
  'tool:insurance_list_user_policies',
  'partner_driven',
  jsonb_build_object('table', 'insurance_quote_requests')
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT
  id,
  'insurance_quote_requests',
  'Quote Requests',
  'Pending quotes for partners to follow',
  'table',
  'direct_db',
  'partner_driven',
  jsonb_build_object('table', 'insurance_quote_requests')
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT
  id,
  'insurance_product_info',
  'Product Information',
  'Simple KB describing products per partner (explanation only, not pricing)',
  'external',
  'http',
  'cron_daily',
  jsonb_build_object('source', 'partner_api', 'cache_hours', 24)
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

COMMIT;
