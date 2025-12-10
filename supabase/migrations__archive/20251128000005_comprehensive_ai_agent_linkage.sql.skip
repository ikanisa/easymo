BEGIN;

-- =====================================================================
-- COMPREHENSIVE AI AGENT LINKAGE
-- =====================================================================
-- This migration creates a complete linkage between all AI agents and 
-- their configurations from all relevant tables:
-- - ai_agent_personas
-- - ai_agent_system_instructions
-- - ai_agent_tools
-- - ai_agent_tasks
-- - ai_agent_intents
-- - ai_agent_knowledge_bases
-- - ai_agent_configs (master configuration table)
--
-- Each agent will be fully configured and operational.
-- =====================================================================

-- =====================================================================
-- 1. MARKETPLACE AGENT - Complete Configuration
-- =====================================================================

-- Insert or update marketplace agent
INSERT INTO public.ai_agents (slug, name, description, default_language, default_channel, is_active, config)
VALUES (
  'marketplace',
  'Marketplace AI Agent',
  'Facilitates buying and selling of products and services on the easyMO marketplace',
  'multi',
  'whatsapp',
  true,
  jsonb_build_object(
    'capabilities', ARRAY['product_listing', 'buyer_matching', 'seller_support', 'transaction_facilitation'],
    'categories', ARRAY['marketplace', 'commerce', 'buying', 'selling'],
    'channels', ARRAY['whatsapp', 'sms'],
    'priority', 'high'
  )
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  config = EXCLUDED.config,
  is_active = EXCLUDED.is_active;

-- Marketplace persona
WITH marketplace_agent AS (SELECT id FROM public.ai_agents WHERE slug = 'marketplace')
INSERT INTO public.ai_agent_personas (
  agent_id, code, name, description, tone, response_style, 
  personality_traits, emoji_usage, is_active
)
SELECT 
  id,
  'MKT-PERSONA',
  'Marketplace Facilitator',
  'Professional marketplace facilitator helping buyers and sellers connect and transact safely',
  'professional',
  'Clear, trustworthy, transaction-focused',
  ARRAY['helpful', 'trustworthy', 'detail-oriented', 'fair', 'professional'],
  jsonb_build_object(
    'frequency', 'moderate',
    'types', ARRAY['🏪', '✅', '💼', '📦', '🤝'],
    'guidelines', 'Use emojis to enhance clarity and trust'
  ),
  true
FROM marketplace_agent
ON CONFLICT (agent_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- Marketplace system instructions
WITH marketplace_agent AS (SELECT id FROM public.ai_agents WHERE slug = 'marketplace')
INSERT INTO public.ai_agent_system_instructions (
  agent_id, code, category, priority, instruction_text, applies_to_countries, is_active
)
SELECT 
  id,
  'MKT-CORE',
  'core_behavior',
  1,
  E'# Marketplace Agent Instructions

You are the easyMO Marketplace Agent. Your role is to help users buy and sell products and services safely and efficiently.

## PRIMARY RESPONSIBILITIES
1. Help sellers create detailed, attractive listings
2. Help buyers find and evaluate products/services
3. Facilitate safe communication between parties
4. Ensure marketplace policies are followed
5. Support transactions from inquiry to completion

## LISTING CREATION (for sellers)
- Collect: title, description, price, location, photos
- Suggest competitive pricing based on similar items
- Ensure clear, honest descriptions
- Verify contact information
- Add relevant tags/categories

## BUYER ASSISTANCE
- Understand buyer needs and preferences
- Search and filter marketplace inventory
- Provide detailed product information
- Facilitate seller contact
- Advise on safe transaction practices

## SAFETY & TRUST
- Encourage meetups in public places
- Recommend secure payment methods (MoMo, verified methods)
- Flag suspicious listings or behavior
- Verify seller credibility when possible
- Document transaction details

## COMMUNICATION STYLE
- Be neutral and fair to both parties
- Use clear, simple language
- Confirm details to avoid misunderstandings
- Be patient with questions
- Follow up on pending transactions',
  ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD', 'SS', 'MT'],
  true
FROM marketplace_agent
ON CONFLICT (agent_id, code) DO UPDATE SET
  instruction_text = EXCLUDED.instruction_text,
  is_active = EXCLUDED.is_active;

-- Marketplace tools
WITH marketplace_agent AS (SELECT id FROM public.ai_agents WHERE slug = 'marketplace')
INSERT INTO public.ai_agent_tools (agent_id, name, description, input_schema, implementation_status, is_active)
SELECT id, tool.* FROM marketplace_agent,
LATERAL (VALUES
  ('create_listing', 'Create a marketplace listing', 
   '{"type":"object","properties":{"title":{"type":"string"},"description":{"type":"string"},"price":{"type":"number"},"category":{"type":"string"},"location":{"type":"string"},"phone_number":{"type":"string"}},"required":["title","description","price","category","phone_number"]}'::jsonb,
   'implemented', true),
  ('search_listings', 'Search marketplace listings',
   '{"type":"object","properties":{"query":{"type":"string"},"category":{"type":"string"},"min_price":{"type":"number"},"max_price":{"type":"number"},"location":{"type":"string"}}}'::jsonb,
   'implemented', true),
  ('get_listing_details', 'Get detailed information about a listing',
   '{"type":"object","properties":{"listing_id":{"type":"string"}},"required":["listing_id"]}'::jsonb,
   'implemented', true),
  ('contact_seller', 'Initiate contact between buyer and seller',
   '{"type":"object","properties":{"listing_id":{"type":"string"},"buyer_phone":{"type":"string"},"message":{"type":"string"}},"required":["listing_id","buyer_phone"]}'::jsonb,
   'implemented', true)
) AS tool(name, description, input_schema, implementation_status, is_active)
ON CONFLICT (agent_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  input_schema = EXCLUDED.input_schema,
  is_active = EXCLUDED.is_active;

-- =====================================================================
-- 2. WAITER AGENT - Link Existing Configurations
-- =====================================================================

WITH waiter_agent AS (SELECT id FROM public.ai_agents WHERE slug = 'waiter')
INSERT INTO public.ai_agent_tools (agent_id, name, description, input_schema, implementation_status, is_active)
SELECT id, tool.* FROM waiter_agent,
LATERAL (VALUES
  ('search_menu', 'Search restaurant menus for dishes and drinks',
   '{"type":"object","properties":{"restaurant_id":{"type":"string"},"query":{"type":"string"},"category":{"type":"string","enum":["appetizer","main","dessert","drink","all"]}}}'::jsonb,
   'implemented', true),
  ('create_order', 'Create a new food/drink order',
   '{"type":"object","properties":{"restaurant_id":{"type":"string"},"items":{"type":"array"},"delivery_address":{"type":"string"},"phone":{"type":"string"},"notes":{"type":"string"}},"required":["restaurant_id","items","phone"]}'::jsonb,
   'implemented', true),
  ('check_order_status', 'Check the status of an existing order',
   '{"type":"object","properties":{"order_id":{"type":"string"}},"required":["order_id"]}'::jsonb,
   'implemented', true),
  ('get_restaurant_info', 'Get restaurant details and location',
   '{"type":"object","properties":{"restaurant_id":{"type":"string"}},"required":["restaurant_id"]}'::jsonb,
   'implemented', true)
) AS tool(name, description, input_schema, implementation_status, is_active)
ON CONFLICT (agent_id, name) DO NOTHING;

-- =====================================================================
-- 3. PROPERTY/REAL ESTATE AGENT - Complete Configuration
-- =====================================================================

WITH property_agent AS (SELECT id FROM public.ai_agents WHERE slug = 'real_estate')
INSERT INTO public.ai_agent_tools (agent_id, name, description, input_schema, implementation_status, is_active)
SELECT id, tool.* FROM property_agent,
LATERAL (VALUES
  ('search_properties', 'Search for available properties',
   '{"type":"object","properties":{"location":{"type":"string"},"property_type":{"type":"string","enum":["apartment","house","commercial","land"]},"min_price":{"type":"number"},"max_price":{"type":"number"},"bedrooms":{"type":"integer"},"bathrooms":{"type":"integer"}}}'::jsonb,
   'implemented', true),
  ('get_property_details', 'Get detailed property information',
   '{"type":"object","properties":{"property_id":{"type":"string"}},"required":["property_id"]}'::jsonb,
   'implemented', true),
  ('schedule_viewing', 'Schedule a property viewing appointment',
   '{"type":"object","properties":{"property_id":{"type":"string"},"preferred_date":{"type":"string"},"preferred_time":{"type":"string"},"phone":{"type":"string"}},"required":["property_id","phone"]}'::jsonb,
   'implemented', true),
  ('create_rental_application', 'Submit a rental application',
   '{"type":"object","properties":{"property_id":{"type":"string"},"applicant_info":{"type":"object"},"move_in_date":{"type":"string"}},"required":["property_id","applicant_info"]}'::jsonb,
   'implemented', true),
  ('create_property_listing', 'Create a new property listing',
   '{"type":"object","properties":{"title":{"type":"string"},"description":{"type":"string"},"property_type":{"type":"string"},"price":{"type":"number"},"location":{"type":"string"},"bedrooms":{"type":"integer"},"bathrooms":{"type":"integer"},"owner_phone":{"type":"string"}},"required":["title","price","location","owner_phone"]}'::jsonb,
   'implemented', true)
) AS tool(name, description, input_schema, implementation_status, is_active)
ON CONFLICT (agent_id, name) DO NOTHING;

-- =====================================================================
-- 4. JOBS AGENT - Complete Configuration
-- =====================================================================

WITH jobs_agent AS (SELECT id FROM public.ai_agents WHERE slug = 'jobs')
INSERT INTO public.ai_agent_tools (agent_id, name, description, input_schema, implementation_status, is_active)
SELECT id, tool.* FROM jobs_agent,
LATERAL (VALUES
  ('search_jobs', 'Search for job listings',
   '{"type":"object","properties":{"keywords":{"type":"string"},"location":{"type":"string"},"category":{"type":"string"},"employment_type":{"type":"string","enum":["full_time","part_time","contract","internship"]}}}'::jsonb,
   'implemented', true),
  ('get_job_details', 'Get detailed job posting information',
   '{"type":"object","properties":{"job_id":{"type":"string"}},"required":["job_id"]}'::jsonb,
   'implemented', true),
  ('submit_application', 'Submit a job application',
   '{"type":"object","properties":{"job_id":{"type":"string"},"applicant_name":{"type":"string"},"phone":{"type":"string"},"email":{"type":"string"},"cv_url":{"type":"string"},"cover_letter":{"type":"string"}},"required":["job_id","applicant_name","phone"]}'::jsonb,
   'implemented', true),
  ('create_job_posting', 'Create a new job posting',
   '{"type":"object","properties":{"title":{"type":"string"},"company":{"type":"string"},"description":{"type":"string"},"requirements":{"type":"string"},"salary":{"type":"string"},"location":{"type":"string"},"employment_type":{"type":"string"},"contact_phone":{"type":"string"}},"required":["title","company","description","contact_phone"]}'::jsonb,
   'implemented', true)
) AS tool(name, description, input_schema, implementation_status, is_active)
ON CONFLICT (agent_id, name) DO NOTHING;

-- =====================================================================
-- 5. UPDATE AI_AGENT_CONFIGS - Master Configuration
-- =====================================================================
-- This links all agents with their personas, instructions, tools, etc.

INSERT INTO public.ai_agent_configs (
  agent_id,
  persona_id,
  system_instruction_ids,
  tool_ids,
  task_ids,
  intent_ids,
  knowledge_base_ids,
  is_active
)
SELECT
  a.id as agent_id,
  (SELECT p.id FROM public.ai_agent_personas p WHERE p.agent_id = a.id AND p.is_active = true ORDER BY p.created_at DESC LIMIT 1) as persona_id,
  COALESCE((SELECT array_agg(s.id) FROM public.ai_agent_system_instructions s WHERE s.agent_id = a.id AND s.is_active = true), ARRAY[]::uuid[]) as system_instruction_ids,
  COALESCE((SELECT array_agg(t.id) FROM public.ai_agent_tools t WHERE t.agent_id = a.id AND t.is_active = true), ARRAY[]::uuid[]) as tool_ids,
  COALESCE((SELECT array_agg(tk.id) FROM public.ai_agent_tasks tk WHERE tk.agent_id = a.id AND tk.is_active = true), ARRAY[]::uuid[]) as task_ids,
  COALESCE((SELECT array_agg(i.id) FROM public.ai_agent_intents i WHERE i.agent_id = a.id AND i.is_active = true), ARRAY[]::uuid[]) as intent_ids,
  COALESCE((SELECT array_agg(k.id) FROM public.ai_agent_knowledge_bases k WHERE k.agent_id = a.id AND k.is_active = true), ARRAY[]::uuid[]) as knowledge_base_ids,
  true
FROM public.ai_agents a
WHERE a.is_active = true
ON CONFLICT (agent_id)
DO UPDATE SET
  persona_id = COALESCE(EXCLUDED.persona_id, ai_agent_configs.persona_id),
  system_instruction_ids = EXCLUDED.system_instruction_ids,
  tool_ids = EXCLUDED.tool_ids,
  task_ids = EXCLUDED.task_ids,
  intent_ids = EXCLUDED.intent_ids,
  knowledge_base_ids = EXCLUDED.knowledge_base_ids,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- =====================================================================
-- 6. CREATE OVERVIEW MATERIALIZED VIEW
-- =====================================================================
-- This provides a quick summary of each agent's configuration status

CREATE MATERIALIZED VIEW IF NOT EXISTS public.ai_agents_overview_v AS
SELECT 
  a.id,
  a.slug,
  a.name,
  a.description,
  a.is_active,
  (SELECT COUNT(*) FROM ai_agent_personas p WHERE p.agent_id = a.id AND p.is_active = true) as persona_count,
  (SELECT COUNT(*) FROM ai_agent_system_instructions s WHERE s.agent_id = a.id AND s.is_active = true) as instruction_count,
  (SELECT COUNT(*) FROM ai_agent_tools t WHERE t.agent_id = a.id AND t.is_active = true) as tool_count,
  (SELECT COUNT(*) FROM ai_agent_tasks tk WHERE tk.agent_id = a.id AND tk.is_active = true) as task_count,
  (SELECT COUNT(*) FROM ai_agent_intents i WHERE i.agent_id = a.id AND i.is_active = true) as intent_count,
  (SELECT COUNT(*) FROM ai_agent_knowledge_bases k WHERE k.agent_id = a.id AND k.is_active = true) as knowledge_base_count,
  (SELECT p.name FROM ai_agent_personas p WHERE p.agent_id = a.id AND p.is_active = true LIMIT 1) as primary_persona,
  (SELECT array_agg(DISTINCT t.name) FROM ai_agent_tools t WHERE t.agent_id = a.id AND t.is_active = true) as available_tools,
  (SELECT c.is_active FROM ai_agent_configs c WHERE c.agent_id = a.id) as config_active,
  a.created_at,
  a.updated_at
FROM public.ai_agents a
ORDER BY a.slug;

-- Create index on the view
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_agents_overview_id ON ai_agents_overview_v(id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_overview_slug ON ai_agents_overview_v(slug);

-- =====================================================================
-- 7. VERIFICATION REPORT
-- =====================================================================

DO $$
DECLARE
  agent_record RECORD;
  total_agents INTEGER;
  fully_configured INTEGER := 0;
  report_text TEXT := E'\n=== AI AGENT CONFIGURATION REPORT ===\n\n';
BEGIN
  SELECT COUNT(*) INTO total_agents FROM ai_agents WHERE is_active = true;
  
  report_text := report_text || 'Total Active Agents: ' || total_agents || E'\n\n';
  
  FOR agent_record IN 
    SELECT 
      a.slug,
      a.name,
      (SELECT COUNT(*) FROM ai_agent_personas p WHERE p.agent_id = a.id AND p.is_active = true) as personas,
      (SELECT COUNT(*) FROM ai_agent_system_instructions s WHERE s.agent_id = a.id AND s.is_active = true) as instructions,
      (SELECT COUNT(*) FROM ai_agent_tools t WHERE t.agent_id = a.id AND t.is_active = true) as tools,
      (SELECT COUNT(*) FROM ai_agent_tasks tk WHERE tk.agent_id = a.id AND tk.is_active = true) as tasks,
      (SELECT COUNT(*) FROM ai_agent_intents i WHERE i.agent_id = a.id AND i.is_active = true) as intents,
      (SELECT COUNT(*) FROM ai_agent_knowledge_bases k WHERE k.agent_id = a.id AND k.is_active = true) as knowledge_bases
    FROM ai_agents a
    WHERE a.is_active = true
    ORDER BY a.slug
  LOOP
    report_text := report_text || agent_record.slug || ' (' || agent_record.name || E'):\n';
    report_text := report_text || '  - Personas: ' || agent_record.personas || E'\n';
    report_text := report_text || '  - System Instructions: ' || agent_record.instructions || E'\n';
    report_text := report_text || '  - Tools: ' || agent_record.tools || E'\n';
    report_text := report_text || '  - Tasks: ' || agent_record.tasks || E'\n';
    report_text := report_text || '  - Intents: ' || agent_record.intents || E'\n';
    report_text := report_text || '  - Knowledge Bases: ' || agent_record.knowledge_bases || E'\n';
    
    IF agent_record.personas > 0 AND agent_record.instructions > 0 AND agent_record.tools > 0 THEN
      report_text := report_text || '  ✅ FULLY CONFIGURED' || E'\n';
      fully_configured := fully_configured + 1;
    ELSE
      report_text := report_text || '  ⚠️  NEEDS CONFIGURATION' || E'\n';
    END IF;
    
    report_text := report_text || E'\n';
  END LOOP;
  
  report_text := report_text || E'\n=== SUMMARY ===\n';
  report_text := report_text || 'Fully Configured: ' || fully_configured || ' / ' || total_agents || E'\n';
  
  RAISE NOTICE '%', report_text;
END $$;

COMMIT;
