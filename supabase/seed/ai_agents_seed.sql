-- =====================================================================
-- AI AGENT ECOSYSTEM - SEED DATA (OPTIONAL)
-- =====================================================================
-- This file provides initial seed data for the active AI agents.
-- Load this after the schema migration.
-- 
-- ACTIVE AGENTS:
-- 1. buy_and_sell - Unified commerce & business (Buy, Sell, Business Discovery)
-- 2. support - Customer support (added separately via whatsapp workflows)
--
-- DEPRECATED (removed from this seed):
-- - waiter, farmer, real_estate, jobs, sales_cold_caller, rides, insurance
-- - These domains are now handled via WhatsApp workflows or have been discontinued
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. INSERT ACTIVE AI AGENTS
-- =====================================================================

INSERT INTO public.ai_agents (slug, name, description, default_persona_code, default_system_instruction_code, default_language, default_channel, is_active)
VALUES
  (
    'buy_and_sell',
    'Buy & Sell AI Agent',
    'Unified commerce and business discovery agent. Handles marketplace transactions (buying/selling products), business discovery, business brokerage (sales/acquisitions), and legal intake.',
    'BAS-PERSONA',
    'BAS-SYS',
    'en',
    'whatsapp',
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- Deactivate deprecated agents
UPDATE public.ai_agents SET
  is_active = false,
  description = COALESCE(description, '') || ' [DEPRECATED: Domain discontinued or moved to WhatsApp workflows]'
WHERE slug IN ('waiter', 'farmer', 'real_estate', 'jobs', 'sales_cold_caller', 'business_broker', 'broker', 'marketplace', 'rides', 'insurance')
  AND is_active = true;

-- =====================================================================
-- 2. INSERT DEFAULT PERSONAS
-- =====================================================================

-- Buy & Sell persona
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

-- =====================================================================
-- 3. INSERT DEFAULT SYSTEM INSTRUCTIONS
-- =====================================================================

-- Buy & Sell system instructions
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

-- =====================================================================
-- 4. INSERT TOOLS FOR BUY & SELL AGENT
-- =====================================================================

-- Search products tool
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

-- Search businesses tool
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

COMMIT;
