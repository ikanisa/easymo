-- =====================================================================
-- AI AGENT ECOSYSTEM - SEED DATA (OPTIONAL)
-- =====================================================================
-- This file provides initial seed data for the 6 AI agents with minimal
-- configurations. Load this after the schema migration.
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. INSERT AI AGENTS
-- =====================================================================

INSERT INTO public.ai_agents (slug, name, description, default_persona_code, default_system_instruction_code, default_language, default_channel, is_active)
VALUES
  (
    'waiter',
    'Waiter AI Agent',
    'Virtual waiter/maître d'' for restaurant menu browsing, ordering, and reservations via WhatsApp',
    'W-PERSONA',
    'W-SYS',
    'en',
    'whatsapp',
    true
  ),
  (
    'farmer',
    'Farmer AI Agent',
    'Connects farmers with buyers for produce listings, price inquiries, and agricultural services via WhatsApp',
    'F-PERSONA',
    'F-SYS',
    'en',
    'whatsapp',
    true
  ),
  (
    'business_broker',
    'Business Broker AI Agent',
    'Business directory agent for discovering local businesses, services, and promotions via WhatsApp',
    'BB-PERSONA',
    'BB-SYS',
    'en',
    'whatsapp',
    true
  ),
  (
    'real_estate',
    'Real Estate AI Agent',
    'Property search and rental agent for finding homes, apartments, and commercial spaces via WhatsApp',
    'RE-PERSONA',
    'RE-SYS',
    'en',
    'whatsapp',
    true
  ),
  (
    'jobs',
    'Jobs AI Agent',
    'Job board agent for job seekers and employers to post, search, and match opportunities via WhatsApp',
    'J-PERSONA',
    'J-SYS',
    'en',
    'whatsapp',
    true
  ),
  (
    'sales_cold_caller',
    'Sales Cold Caller AI Agent',
    'Lead generation and cold calling agent for sales teams to manage prospects and outreach via WhatsApp',
    'SC-PERSONA',
    'SC-SYS',
    'en',
    'whatsapp',
    true
  )
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- 2. INSERT DEFAULT PERSONAS
-- =====================================================================

-- Waiter persona
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT
  id,
  'W-PERSONA',
  'Virtual Waiter / Maître d''',
  'Friendly, professional, attentive',
  ARRAY['en', 'fr', 'rw'],
  jsonb_build_object(
    'warmth', 'high',
    'formality', 'medium',
    'responsiveness', 'immediate',
    'upsell_capable', true
  ),
  true
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

-- Farmer persona
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT
  id,
  'F-PERSONA',
  'Agricultural Marketplace Assistant',
  'Helpful, knowledgeable, trustworthy',
  ARRAY['en', 'fr', 'rw'],
  jsonb_build_object(
    'warmth', 'high',
    'formality', 'low',
    'local_expertise', true,
    'price_negotiation_aware', true
  ),
  true
FROM public.ai_agents WHERE slug = 'farmer'
ON CONFLICT DO NOTHING;

-- Business Broker persona
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT
  id,
  'BB-PERSONA',
  'Local Business Discovery Guide',
  'Enthusiastic, informative, concise',
  ARRAY['en', 'fr', 'rw'],
  jsonb_build_object(
    'warmth', 'high',
    'formality', 'low',
    'search_oriented', true,
    'promotion_aware', true
  ),
  true
FROM public.ai_agents WHERE slug = 'business_broker'
ON CONFLICT DO NOTHING;

-- Real Estate persona
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT
  id,
  'RE-PERSONA',
  'Property Search Specialist',
  'Professional, detail-oriented, patient',
  ARRAY['en', 'fr', 'rw'],
  jsonb_build_object(
    'warmth', 'medium',
    'formality', 'medium',
    'location_focused', true,
    'budget_conscious', true
  ),
  true
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

-- Jobs persona
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT
  id,
  'J-PERSONA',
  'Career Matchmaker',
  'Encouraging, professional, efficient',
  ARRAY['en', 'fr', 'rw'],
  jsonb_build_object(
    'warmth', 'high',
    'formality', 'medium',
    'match_focused', true,
    'skill_aware', true
  ),
  true
FROM public.ai_agents WHERE slug = 'jobs'
ON CONFLICT DO NOTHING;

-- Sales Cold Caller persona
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT
  id,
  'SC-PERSONA',
  'Lead Generation Specialist',
  'Persuasive, professional, persistent',
  ARRAY['en', 'fr'],
  jsonb_build_object(
    'warmth', 'medium',
    'formality', 'high',
    'conversion_focused', true,
    'objection_handling', true
  ),
  true
FROM public.ai_agents WHERE slug = 'sales_cold_caller'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 3. INSERT DEFAULT SYSTEM INSTRUCTIONS
-- =====================================================================

-- Waiter system instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT
  id,
  'W-SYS',
  'Waiter Agent System Prompt',
  'You are a professional virtual waiter. Help guests browse menus, place orders, and make reservations. Always search the menu database first before responding. Use structured intents for orders. Confirm details before finalizing.',
  'Never invent menu items. Always verify availability. Respect dietary restrictions. Confirm prices before checkout.',
  'Maintain conversation context. Remember previous orders from same user. Track current session state.',
  true
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

-- Farmer system instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT
  id,
  'F-SYS',
  'Farmer Agent System Prompt',
  'You are an agricultural marketplace assistant. Help farmers list produce and connect buyers with suppliers. Always search the produce database first. Use structured intents for listings and inquiries. Support price negotiations.',
  'Never guarantee prices. Verify product availability. Respect seasonal constraints. Confirm quantities before transactions.',
  'Remember user role (farmer vs buyer). Track listing history. Maintain negotiation context.',
  true
FROM public.ai_agents WHERE slug = 'farmer'
ON CONFLICT DO NOTHING;

-- Business Broker system instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT
  id,
  'BB-SYS',
  'Business Broker Agent System Prompt',
  'You are a local business discovery guide. Help users find businesses, services, and promotions. Always search the business directory first. Use location-based matching. Provide concise results with top 5 matches.',
  'Never endorse specific businesses. Verify business hours before sharing. Respect geographic constraints. Confirm user location.',
  'Remember user preferences. Track search history. Maintain location context.',
  true
FROM public.ai_agents WHERE slug = 'business_broker'
ON CONFLICT DO NOTHING;

-- Real Estate system instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT
  id,
  'RE-SYS',
  'Real Estate Agent System Prompt',
  'You are a property search specialist. Help users find rental properties matching their criteria. Always search the property database first. Use structured intents for search criteria. Provide shortlisted options (max 5).',
  'Never guarantee availability. Verify property details. Respect budget constraints. Confirm location preferences.',
  'Remember search criteria. Track viewed properties. Maintain budget and preference context.',
  true
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

-- Jobs system instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT
  id,
  'J-SYS',
  'Jobs Agent System Prompt',
  'You are a career matchmaker. Help job seekers find opportunities and employers find candidates. Always search the job database first. Use structured intents for profiles and posts. Provide ranked matches with scores.',
  'Never guarantee employment. Verify qualifications. Respect skill requirements. Confirm contact preferences.',
  'Remember user role (seeker vs employer). Track application history. Maintain skill and preference context.',
  true
FROM public.ai_agents WHERE slug = 'jobs'
ON CONFLICT DO NOTHING;

-- Sales Cold Caller system instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT
  id,
  'SC-SYS',
  'Sales Cold Caller Agent System Prompt',
  'You are a lead generation specialist. Help sales teams manage prospects and outreach. Always search the lead database first. Use structured intents for lead updates. Track conversion funnel stages.',
  'Never spam contacts. Respect opt-out requests. Verify lead quality. Confirm contact consent.',
  'Remember lead status. Track interaction history. Maintain conversion funnel context.',
  true
FROM public.ai_agents WHERE slug = 'sales_cold_caller'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 4. INSERT SAMPLE TOOLS (2 per agent - minimal)
-- =====================================================================

-- Waiter tools
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'search_menu_supabase',
  'Search Menu Database',
  'db',
  'Search restaurant menu items by name, category, or dietary tags',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('query', jsonb_build_object('type', 'string'), 'category', jsonb_build_object('type', 'string'))),
  jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'object')),
  jsonb_build_object('table', 'menu_items', 'search_columns', ARRAY['name', 'description']),
  true
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'create_order',
  'Create Order',
  'db',
  'Create a new order record with items, quantities, and customer info',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('items', jsonb_build_object('type', 'array'), 'customer_id', jsonb_build_object('type', 'string'))),
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('order_id', jsonb_build_object('type', 'string'))),
  jsonb_build_object('table', 'orders', 'insert_mode', 'single'),
  true
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

-- Farmer tools
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'search_produce_supabase',
  'Search Produce Database',
  'db',
  'Search agricultural produce listings by product, location, or price range',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('product', jsonb_build_object('type', 'string'), 'location', jsonb_build_object('type', 'string'))),
  jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'object')),
  jsonb_build_object('table', 'produce_listings', 'search_columns', ARRAY['product_name', 'location']),
  true
FROM public.ai_agents WHERE slug = 'farmer'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'create_produce_listing',
  'Create Produce Listing',
  'db',
  'Create a new produce listing with product, quantity, price, and farmer info',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('product', jsonb_build_object('type', 'string'), 'quantity', jsonb_build_object('type', 'number'))),
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('listing_id', jsonb_build_object('type', 'string'))),
  jsonb_build_object('table', 'produce_listings', 'insert_mode', 'single'),
  true
FROM public.ai_agents WHERE slug = 'farmer'
ON CONFLICT DO NOTHING;

-- Business Broker tools
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'search_business_directory',
  'Search Business Directory',
  'db',
  'Search local businesses by name, category, location, or services',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('query', jsonb_build_object('type', 'string'), 'category', jsonb_build_object('type', 'string'))),
  jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'object')),
  jsonb_build_object('table', 'businesses', 'search_columns', ARRAY['name', 'category', 'services']),
  true
FROM public.ai_agents WHERE slug = 'business_broker'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'get_business_promotions',
  'Get Business Promotions',
  'db',
  'Retrieve active promotions for a specific business',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('business_id', jsonb_build_object('type', 'string'))),
  jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'object')),
  jsonb_build_object('table', 'promotions', 'filter_column', 'business_id'),
  true
FROM public.ai_agents WHERE slug = 'business_broker'
ON CONFLICT DO NOTHING;

-- Real Estate tools
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'search_properties',
  'Search Properties',
  'db',
  'Search rental properties by location, price range, bedrooms, and amenities',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('location', jsonb_build_object('type', 'string'), 'max_price', jsonb_build_object('type', 'number'))),
  jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'object')),
  jsonb_build_object('table', 'properties', 'search_columns', ARRAY['location', 'title']),
  true
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'shortlist_property',
  'Shortlist Property',
  'db',
  'Add a property to user shortlist for later viewing',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('property_id', jsonb_build_object('type', 'string'), 'user_id', jsonb_build_object('type', 'string'))),
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('shortlist_id', jsonb_build_object('type', 'string'))),
  jsonb_build_object('table', 'property_shortlists', 'insert_mode', 'single'),
  true
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

-- Jobs tools
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'search_jobs',
  'Search Jobs',
  'db',
  'Search job postings by title, category, location, and salary range',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('title', jsonb_build_object('type', 'string'), 'location', jsonb_build_object('type', 'string'))),
  jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'object')),
  jsonb_build_object('table', 'job_posts', 'search_columns', ARRAY['title', 'description']),
  true
FROM public.ai_agents WHERE slug = 'jobs'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'match_job_seekers',
  'Match Job Seekers',
  'db',
  'Find job seekers matching a job posting based on skills and experience',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('job_id', jsonb_build_object('type', 'string'), 'required_skills', jsonb_build_object('type', 'array'))),
  jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'object')),
  jsonb_build_object('matching_strategy', 'skill_based', 'min_match_score', 0.6),
  true
FROM public.ai_agents WHERE slug = 'jobs'
ON CONFLICT DO NOTHING;

-- Sales Cold Caller tools
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'search_leads',
  'Search Leads',
  'db',
  'Search lead database by industry, status, score, or contact info',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('industry', jsonb_build_object('type', 'string'), 'status', jsonb_build_object('type', 'string'))),
  jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'object')),
  jsonb_build_object('table', 'leads', 'search_columns', ARRAY['company_name', 'industry']),
  true
FROM public.ai_agents WHERE slug = 'sales_cold_caller'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'update_lead_status',
  'Update Lead Status',
  'db',
  'Update lead conversion status and add interaction notes',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('lead_id', jsonb_build_object('type', 'string'), 'status', jsonb_build_object('type', 'string'))),
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('updated', jsonb_build_object('type', 'boolean'))),
  jsonb_build_object('table', 'leads', 'update_mode', 'single'),
  true
FROM public.ai_agents WHERE slug = 'sales_cold_caller'
ON CONFLICT DO NOTHING;

COMMIT;
