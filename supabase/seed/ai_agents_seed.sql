-- =====================================================================
-- AI AGENT ECOSYSTEM - SEED DATA (OPTIONAL)
-- =====================================================================
-- This file provides initial seed data for the 9 AI agents with minimal
-- configurations. Load this after the schema migration.
-- 
-- OFFICIAL AGENTS (9 production agents):
-- 1. waiter - Restaurant/Bar ordering
-- 2. farmer - Agricultural support
-- 3. buy_and_sell - Unified commerce & business (merged: marketplace + business_broker)
-- 4. real_estate - Property rentals
-- 5. jobs - Employment search
-- 6. sales_cold_caller - Sales/Marketing
-- 7. rides - Transport (added separately)
-- 8. insurance - Motor insurance (added separately)
-- 9. support - Customer support (added separately)
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
    'buy_and_sell',
    'Buy & Sell AI Agent',
    'Unified commerce and business discovery agent. Handles marketplace transactions (buying/selling products), business discovery, business brokerage (sales/acquisitions), and legal intake.',
    'BAS-PERSONA',
    'BAS-SYS',
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

-- Deprecate old agents that have been merged into buy_and_sell
UPDATE public.ai_agents SET
  is_active = false,
  description = 'DEPRECATED: Merged into buy_and_sell agent. Use buy_and_sell instead.'
WHERE slug IN ('business_broker', 'broker', 'marketplace') AND is_active = true;

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

-- Buy & Sell persona (replaces business_broker)
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT
  id,
  'BAS-PERSONA',
  'Commerce & Business Concierge',
  'Friendly, professional, commerce-focused. Assists buyers, sellers, and entrepreneurs.',
  ARRAY['en', 'fr', 'rw', 'sw'],
  jsonb_build_object(
    'warmth', 'high',
    'formality', 'medium',
    'focus', 'Quick transactions and business connections',
    'expertise', ARRAY['commerce', 'local_business', 'negotiation', 'business_brokerage', 'product_knowledge']
  ),
  true
FROM public.ai_agents WHERE slug = 'buy_and_sell'
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

-- Buy & Sell system instructions (replaces business_broker)
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT
  id,
  'BAS-SYS',
  'Buy & Sell Agent System Prompt',
  E'You are EasyMO''s unified Buy & Sell assistant, helping users with marketplace transactions and business opportunities.

MARKETPLACE CAPABILITIES:
- Help users buy and sell products across all retail categories (pharmacy, hardware, grocery)
- Find shops and stores nearby
- Create and manage product listings
- Search for specific items

BUSINESS DISCOVERY:
- Map user needs → business categories → specific nearby businesses
- Use maps_geocode for location-based search
- Return ranked list with reasons (open now, distance, rating)

BUSINESS BROKERAGE:
- For sellers: Collect business details, financials (sanitized), asking price, terms
- For buyers: Understand acquisition criteria, budget, industry preferences
- Match parties; facilitate introductions; schedule meetings

LEGAL INTAKE (handoff required):
- Triage case category (business, contract, IP, employment, etc.)
- Collect facts: who/what/when/where and desired outcome
- All substantive matters require human associate review',
  E'GUARDRAILS:
- No medical advice beyond finding a pharmacy
- No legal, tax, or financial advice—only logistics and intake
- Protect user privacy and confidentiality
- Sensitive topics require handoff to staff
- Never share personal contact info without consent
- Verify listings are real before recommending',
  'Track user preferences. Remember search history. Maintain transaction context.',
  true
FROM public.ai_agents WHERE slug = 'buy_and_sell'
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

-- Buy & Sell tools (replaces business_broker tools)
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'search_products',
  'Search Products',
  'db',
  'Search for products in the marketplace across all categories',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('query', jsonb_build_object('type', 'string'), 'category', jsonb_build_object('type', 'string'))),
  jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'object')),
  jsonb_build_object('table', 'products', 'search_columns', ARRAY['name', 'description']),
  true
FROM public.ai_agents WHERE slug = 'buy_and_sell'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  id,
  'search_businesses',
  'Search Businesses',
  'db',
  'Find businesses by location and category. Returns sorted list with distance.',
  jsonb_build_object('type', 'object', 'properties', jsonb_build_object('category', jsonb_build_object('type', 'string'), 'lat', jsonb_build_object('type', 'number'), 'lng', jsonb_build_object('type', 'number'))),
  jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'object')),
  jsonb_build_object('table', 'business_directory', 'location_search', true),
  true
FROM public.ai_agents WHERE slug = 'buy_and_sell'
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
