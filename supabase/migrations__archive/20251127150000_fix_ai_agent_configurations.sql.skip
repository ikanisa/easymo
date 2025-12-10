BEGIN;

-- ========================================
-- AI Agent Configuration Fixes
-- ========================================
-- This migration ensures all AI agents have proper linkage to:
-- - Personas
-- - System Instructions  
-- - Tools
-- - Tasks
-- - Intents
-- ========================================

-- 1. Fix broker agent duplication issue
-- Transfer all tools and tasks from business_broker to broker agent
UPDATE ai_agent_tools 
SET agent_id = (SELECT id FROM ai_agents WHERE slug = 'broker')
WHERE agent_id = (SELECT id FROM ai_agents WHERE slug = 'business_broker');

UPDATE ai_agent_tasks 
SET agent_id = (SELECT id FROM ai_agents WHERE slug = 'broker')
WHERE agent_id = (SELECT id FROM ai_agents WHERE slug = 'business_broker');

UPDATE ai_agent_intents 
SET agent_id = (SELECT id FROM ai_agents WHERE slug = 'broker')
WHERE agent_id = (SELECT id FROM ai_agents WHERE slug = 'business_broker');

UPDATE ai_agent_knowledge_bases 
SET agent_id = (SELECT id FROM ai_agents WHERE slug = 'broker')
WHERE agent_id = (SELECT id FROM ai_agents WHERE slug = 'business_broker');

-- Set proper defaults for broker agent
UPDATE ai_agents 
SET 
  default_persona_code = 'BB-PERSONA',
  default_system_instruction_code = 'BB-SYS'
WHERE slug = 'broker' AND default_persona_code IS NULL;

-- Deactivate the duplicate business_broker agent
UPDATE ai_agents 
SET is_active = false 
WHERE slug = 'business_broker';

-- 2. Ensure support agent has proper tasks for marketplace/sales/support
INSERT INTO ai_agent_tasks (agent_id, code, name, description, trigger_description)
SELECT 
  a.id,
  'HANDLE_MARKETPLACE_INQUIRY',
  'Handle Marketplace Inquiries',
  'Help users with marketplace product/service listings and transactions',
  'User asks about buying, selling, or marketplace features'
FROM ai_agents a
WHERE a.slug = 'support'
AND NOT EXISTS (
  SELECT 1 FROM ai_agent_tasks t 
  WHERE t.agent_id = a.id AND t.code = 'HANDLE_MARKETPLACE_INQUIRY'
);

INSERT INTO ai_agent_tasks (agent_id, code, name, description, trigger_description)
SELECT 
  a.id,
  'HANDLE_SALES_INQUIRY',
  'Handle Sales Inquiries',
  'Provide pricing information, packages, and sales support',
  'User asks about pricing, packages, subscriptions, or purchasing easyMO services'
FROM ai_agents a
WHERE a.slug = 'support'
AND NOT EXISTS (
  SELECT 1 FROM ai_agent_tasks t 
  WHERE t.agent_id = a.id AND t.code = 'HANDLE_SALES_INQUIRY'
);

INSERT INTO ai_agent_tasks (agent_id, code, name, description, trigger_description)
SELECT 
  a.id,
  'HANDLE_MARKETING_INQUIRY',
  'Handle Marketing & Partnership Inquiries',
  'Assist with partnership opportunities, marketing collaborations, and advertising',
  'User asks about partnerships, marketing, advertising, or business collaboration'
FROM ai_agents a
WHERE a.slug = 'support'
AND NOT EXISTS (
  SELECT 1 FROM ai_agent_tasks t 
  WHERE t.agent_id = a.id AND t.code = 'HANDLE_MARKETING_INQUIRY'
);

-- 3. Add marketplace tools for support agent
INSERT INTO ai_agent_tools (agent_id, name, display_name, tool_type, description, is_active)
SELECT 
  a.id,
  'search_marketplace_listings',
  'Search Marketplace Listings',
  'database_query',
  'Search for products or services in the marketplace',
  true
FROM ai_agents a
WHERE a.slug = 'support'
AND NOT EXISTS (
  SELECT 1 FROM ai_agent_tools t 
  WHERE t.agent_id = a.id AND t.name = 'search_marketplace_listings'
);

INSERT INTO ai_agent_tools (agent_id, name, display_name, tool_type, description, is_active)
SELECT 
  a.id,
  'create_marketplace_listing',
  'Create Marketplace Listing',
  'database_write',
  'Help users create a new marketplace listing',
  true
FROM ai_agents a
WHERE a.slug = 'support'
AND NOT EXISTS (
  SELECT 1 FROM ai_agent_tools t 
  WHERE t.agent_id = a.id AND t.name = 'create_marketplace_listing'
);

-- 4. Ensure all agents have at least one persona and system instruction
-- Check and log agents without proper configuration
DO $$
DECLARE
  agent_record RECORD;
  missing_config TEXT := '';
BEGIN
  FOR agent_record IN 
    SELECT 
      a.slug,
      a.name,
      (SELECT COUNT(*) FROM ai_agent_personas p WHERE p.agent_id = a.id AND p.is_default = true) as persona_count,
      (SELECT COUNT(*) FROM ai_agent_system_instructions s WHERE s.agent_id = a.id AND s.is_active = true) as instruction_count
    FROM ai_agents a
    WHERE a.is_active = true
  LOOP
    IF agent_record.persona_count = 0 THEN
      missing_config := missing_config || 'Agent ' || agent_record.slug || ' missing default persona. ';
    END IF;
    
    IF agent_record.instruction_count = 0 THEN
      missing_config := missing_config || 'Agent ' || agent_record.slug || ' missing system instructions. ';
    END IF;
  END LOOP;
  
  IF missing_config != '' THEN
    RAISE NOTICE 'Configuration Issues: %', missing_config;
  END IF;
END $$;

-- 5. Create marketplace agent if not exists
INSERT INTO ai_agents (slug, name, description, default_language, default_channel, is_active)
SELECT 
  'marketplace',
  'Marketplace AI Agent',
  'Handles marketplace product and service listings, buyer-seller connections',
  'en',
  'whatsapp',
  true
WHERE NOT EXISTS (SELECT 1 FROM ai_agents WHERE slug = 'marketplace');

-- Add default persona for marketplace
INSERT INTO ai_agent_personas (agent_id, code, role_name, tone_style, languages, is_default)
SELECT 
  a.id,
  'MARKETPLACE-PERSONA',
  'Marketplace Facilitator',
  'Helpful, professional, transaction-focused, neutral mediator',
  ARRAY['en', 'fr', 'rw'],
  true
FROM ai_agents a
WHERE a.slug = 'marketplace'
AND NOT EXISTS (
  SELECT 1 FROM ai_agent_personas p 
  WHERE p.agent_id = a.id AND p.code = 'MARKETPLACE-PERSONA'
);

-- Add default system instructions for marketplace
INSERT INTO ai_agent_system_instructions (agent_id, code, title, instructions, is_active)
SELECT 
  a.id,
  'MARKETPLACE-SYS',
  'Marketplace Agent System Instructions',
  'You are the easyMO Marketplace Agent. Your role is to help users buy and sell products and services.

Key Responsibilities:
1. Help sellers create clear, complete listings with photos, pricing, location
2. Help buyers search and filter marketplace listings
3. Facilitate communication between buyers and sellers
4. Ensure safe transactions and follow marketplace policies
5. Handle inquiries, negotiations, and post-sale support

Always:
- Be neutral and fair to both buyers and sellers
- Verify listing details are complete before posting
- Encourage safe meetups and payment methods
- Flag suspicious activity or policy violations
- Provide clear next steps after each interaction',
  true
FROM ai_agents a
WHERE a.slug = 'marketplace'
AND NOT EXISTS (
  SELECT 1 FROM ai_agent_system_instructions s 
  WHERE s.agent_id = a.id AND s.code = 'MARKETPLACE-SYS'
);

-- Update marketplace agent defaults
UPDATE ai_agents 
SET 
  default_persona_code = 'MARKETPLACE-PERSONA',
  default_system_instruction_code = 'MARKETPLACE-SYS'
WHERE slug = 'marketplace' AND default_persona_code IS NULL;

-- 6. Ensure waiter agent has proper menu and ordering tools
INSERT INTO ai_agent_tools (agent_id, name, display_name, tool_type, description, config, is_active)
SELECT 
  a.id,
  'search_menu_items',
  'Search Menu Items',
  'database_query',
  'Search for dishes and drinks in restaurant menus',
  '{"cache_ttl": 300}'::jsonb,
  true
FROM ai_agents a
WHERE a.slug = 'waiter'
AND NOT EXISTS (
  SELECT 1 FROM ai_agent_tools t 
  WHERE t.agent_id = a.id AND t.name = 'search_menu_items'
);

INSERT INTO ai_agent_tools (agent_id, name, display_name, tool_type, description, is_active)
SELECT 
  a.id,
  'create_order',
  'Create Order',
  'database_write',
  'Create a new food/drink order for a customer',
  true
FROM ai_agents a
WHERE a.slug = 'waiter'
AND NOT EXISTS (
  SELECT 1 FROM ai_agent_tools t 
  WHERE t.agent_id = a.id AND t.name = 'create_order'
);

INSERT INTO ai_agent_tools (agent_id, name, display_name, tool_type, description, is_active)
SELECT 
  a.id,
  'check_order_status',
  'Check Order Status',
  'database_query',
  'Check the status of an existing order',
  true
FROM ai_agents a
WHERE a.slug = 'waiter'
AND NOT EXISTS (
  SELECT 1 FROM ai_agent_tools t 
  WHERE t.agent_id = a.id AND t.name = 'check_order_status'
);

-- 7. Ensure property/rental agent has all needed tools
INSERT INTO ai_agent_tools (agent_id, name, display_name, tool_type, description, is_active)
SELECT 
  a.id,
  'schedule_viewing',
  'Schedule Property Viewing',
  'database_write',
  'Schedule a property viewing appointment',
  true
FROM ai_agents a
WHERE a.slug = 'real_estate'
AND NOT EXISTS (
  SELECT 1 FROM ai_agent_tools t 
  WHERE t.agent_id = a.id AND t.name = 'schedule_viewing'
);

INSERT INTO ai_agent_tools (agent_id, name, display_name, tool_type, description, is_active)
SELECT 
  a.id,
  'create_rental_application',
  'Create Rental Application',
  'database_write',
  'Submit a rental application for a property',
  true
FROM ai_agents a
WHERE a.slug = 'real_estate'
AND NOT EXISTS (
  SELECT 1 FROM ai_agent_tools t 
  WHERE t.agent_id = a.id AND t.name = 'create_rental_application'
);

-- 8. Add knowledge base entries for each agent domain
INSERT INTO ai_agent_knowledge_bases (agent_id, code, name, storage_type, access_method, description, config)
SELECT 
  a.id,
  'platform_overview',
  'easyMO Platform Overview',
  'inline',
  'direct',
  'General platform information for support agent',
  jsonb_build_object(
    'content', '# easyMO Platform Overview

easyMO is a WhatsApp-based super-app platform offering:

## Services:
- **Property Rental**: Find and rent apartments, houses, commercial spaces
- **Jobs Board**: Job postings and job seeker matching  
- **Mobility/Rides**: Book rides, become a driver
- **Insurance**: Get quotes, file claims, manage policies
- **Marketplace**: Buy and sell products and services
- **Restaurant/Waiter**: Order food and drinks via WhatsApp
- **Farmer/Agri**: Connect farmers with buyers

## How It Works:
1. Users chat via WhatsApp
2. AI agents understand requests
3. Agents help complete transactions
4. All managed through simple chat interface

## Contact:
- WhatsApp: +250 788 123 456
- Support available 24/7',
    'tags', ARRAY['platform', 'overview', 'services']
  )::jsonb
FROM ai_agents a
WHERE a.slug = 'support'
AND NOT EXISTS (
  SELECT 1 FROM ai_agent_knowledge_bases k 
  WHERE k.agent_id = a.id AND k.code = 'platform_overview'
);

-- 9. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_agents_default_configs 
ON ai_agents(default_persona_code, default_system_instruction_code) 
WHERE is_active = true;

-- 10. Add agent metadata for routing and display
UPDATE ai_agents 
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{icon}',
  '"🏪"'::jsonb
)
WHERE slug = 'marketplace';

UPDATE ai_agents 
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{icon}',
  '"🍽️"'::jsonb
)
WHERE slug = 'waiter';

UPDATE ai_agents 
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{icon}',
  '"🏠"'::jsonb
)
WHERE slug = 'real_estate';

UPDATE ai_agents 
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{icon}',
  '"💼"'::jsonb
)
WHERE slug = 'jobs';

UPDATE ai_agents 
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{icon}',
  '"🤝"'::jsonb
)
WHERE slug = 'support';

UPDATE ai_agents 
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{icon}',
  '"🚗"'::jsonb
)
WHERE slug = 'rides';

COMMIT;
