-- =====================================================================
-- ADD SUPPORT AND MARKETPLACE AGENTS + DEPRECATE BROKER
-- =====================================================================
-- This migration ensures all agents in code have database configurations
-- - Adds 'support' agent (general customer service)
-- - Ensures 'marketplace' agent exists (merges business_broker functionality)
-- - Deprecates 'broker' agent
-- - Adds comprehensive tools for both agents
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. SUPPORT AGENT - General Customer Service
-- =====================================================================

INSERT INTO public.ai_agents (slug, name, description, default_language, default_channel, is_active, metadata)
VALUES (
  'support',
  'Support AI Agent',
  'General customer support agent for help, questions, account issues, and routing to specialized agents',
  'multi',
  'whatsapp',
  true,
  jsonb_build_object(
    'capabilities', ARRAY['general_support', 'account_help', 'routing', 'faq'],
    'categories', ARRAY['support', 'customer_service', 'help'],
    'channels', ARRAY['whatsapp', 'sms'],
    'priority', 'high'
  )
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata,
  is_active = true;

-- Clean up any duplicate persona/system instruction/tool combinations before adding constraints
DELETE FROM public.ai_agent_personas a
USING public.ai_agent_personas b
WHERE a.id > b.id 
  AND a.agent_id = b.agent_id 
  AND a.code = b.code;

DELETE FROM public.ai_agent_system_instructions a
USING public.ai_agent_system_instructions b
WHERE a.id > b.id 
  AND a.agent_id = b.agent_id 
  AND a.code = b.code;

DELETE FROM public.ai_agent_tools a
USING public.ai_agent_tools b
WHERE a.id > b.id 
  AND a.agent_id = b.agent_id 
  AND a.name = b.name;

-- Add unique constraints for ON CONFLICT to work (using DO block to handle IF NOT EXISTS)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_agent_personas_agent_code_unique'
  ) THEN
    ALTER TABLE public.ai_agent_personas 
      ADD CONSTRAINT ai_agent_personas_agent_code_unique 
      UNIQUE (agent_id, code);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_agent_system_instructions_agent_code_unique'
  ) THEN
    ALTER TABLE public.ai_agent_system_instructions 
      ADD CONSTRAINT ai_agent_system_instructions_agent_code_unique 
      UNIQUE (agent_id, code);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_agent_tools_agent_name_unique'
  ) THEN
    ALTER TABLE public.ai_agent_tools 
      ADD CONSTRAINT ai_agent_tools_agent_name_unique 
      UNIQUE (agent_id, name);
  END IF;
END $$;

-- Support agent persona
WITH support_agent AS (SELECT id FROM public.ai_agents WHERE slug = 'support')
INSERT INTO public.ai_agent_personas (
  agent_id, code, role_name, tone_style, languages, traits, is_default
)
SELECT 
  id,
  'SUPPORT-PERSONA',
  'Customer Support Specialist',
  'Patient, helpful, empathetic. Resolves issues efficiently. Escalates when needed.',
  ARRAY['en', 'fr', 'rw', 'sw'],
  jsonb_build_object(
    'patience', 'High',
    'problem_solving', 'Solution-oriented',
    'escalation', 'Knows when to escalate',
    'tone', 'Friendly and professional'
  ),
  true
FROM support_agent
ON CONFLICT (agent_id, code) DO UPDATE SET
  role_name = EXCLUDED.role_name,
  tone_style = EXCLUDED.tone_style,
  is_default = true;

-- Support agent system instructions
WITH support_agent AS (SELECT id FROM public.ai_agents WHERE slug = 'support')
INSERT INTO public.ai_agent_system_instructions (
  agent_id, code, title, instructions, guardrails, memory_strategy, is_active
)
SELECT 
  id,
  'SUPPORT-SYS',
  'Support Agent System Prompt',
  E'You are the easyMO Support assistant. Help users with:

GENERAL QUERIES:
- How to use easyMO services
- Account information and settings
- Wallet and payment questions
- Technical issues and troubleshooting
- Service availability

ROUTING TO SPECIALIZED AGENTS:
- If user asks about jobs → suggest "Jobs AI can help you with that"
- If user asks about property/real estate → suggest "Real Estate AI specializes in that"
- If user asks about rides/transport → suggest "Rides AI can assist"
- If user asks about food/restaurants → suggest "Waiter AI can help"
- If user asks about farming/produce → suggest "Farmer AI is expert in that"
- If user asks about buying/selling goods → suggest "Marketplace AI can help"
- If user asks about insurance → suggest "Insurance AI handles that"

SUPPORT ACTIONS:
- Check user account status
- Check wallet balance
- View transaction history
- Create support tickets for complex issues
- Show main menu options
- Reset passwords (via secure link)
- Update user preferences

COMMUNICATION STYLE:
- Always be helpful and patient
- Use simple, clear language
- Confirm understanding before acting
- Provide step-by-step guidance
- If unsure, ask clarifying questions
- Be empathetic to user frustration

TOOLS AVAILABLE:
- get_user_info: Fetch user account details
- check_wallet_balance: Check user wallet
- create_support_ticket: Escalate complex issues
- show_main_menu: Display service menu
- search_faq: Search knowledge base

Always be helpful. If you cannot resolve an issue, create a support ticket and assure the user someone will follow up.',
  'Never share sensitive account data without verification. Never promise what you cannot deliver. Escalate fraud/security concerns immediately. Do not make changes to accounts without explicit user consent.',
  'Track user issues, past tickets, resolution history. Remember user preferences and common questions.',
  true
FROM support_agent
ON CONFLICT (agent_id, code) DO UPDATE SET
  instructions = EXCLUDED.instructions,
  guardrails = EXCLUDED.guardrails,
  is_active = true;

-- Support agent tools
WITH support_agent AS (SELECT id FROM public.ai_agents WHERE slug = 'support')
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, tool.* FROM support_agent,
LATERAL (VALUES
  ('get_user_info', 'Get User Information', 'db',
   'Retrieve user account information',
   '{"type":"object","properties":{"user_id":{"type":"string"}}}'::jsonb,
   '{"table":"whatsapp_users","select":"id,phone_number,preferred_language,user_roles,created_at"}'::jsonb,
   true),
  
  ('check_wallet_balance', 'Check Wallet Balance', 'db',
   'Check user wallet balance and recent transactions',
   '{"type":"object","properties":{"user_id":{"type":"string"}}}'::jsonb,
   '{"rpc":"wallet_get_balance"}'::jsonb,
   true),
  
  ('create_support_ticket', 'Create Support Ticket', 'db',
   'Create a support ticket for complex issues',
   '{"type":"object","required":["issue_type","description"],"properties":{"issue_type":{"type":"string"},"description":{"type":"string"},"priority":{"type":"string","enum":["low","medium","high","urgent"]}}}'::jsonb,
   '{"table":"support_tickets","operation":"insert"}'::jsonb,
   true),
  
  ('show_main_menu', 'Show Main Menu', 'static',
   'Display the main services menu',
   '{"type":"object","properties":{}}'::jsonb,
   '{"menu":["🍽️ Waiter","🌱 Farmer","👔 Jobs","🏠 Property","🛒 Marketplace","🚗 Rides","🛡️ Insurance","📞 Sales","💬 Support"]}'::jsonb,
   true),
  
  ('search_faq', 'Search FAQ', 'db',
   'Search knowledge base for answers',
   '{"type":"object","required":["query"],"properties":{"query":{"type":"string"}}}'::jsonb,
   '{"table":"support_faq","search_columns":["question","answer"]}'::jsonb,
   true)
) AS tool(name, display_name, tool_type, description, input_schema, config, is_active)
ON CONFLICT (agent_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  input_schema = EXCLUDED.input_schema,
  is_active = true;

-- =====================================================================
-- 2. MARKETPLACE AGENT - Ensure Complete Configuration
-- =====================================================================
-- (Most already added in 20251128000005_comprehensive_ai_agent_linkage.sql)
-- This ensures it exists and adds any missing tools

INSERT INTO public.ai_agents (slug, name, description, default_language, default_channel, is_active, metadata)
VALUES (
  'marketplace',
  'Marketplace AI Agent',
  'Unified marketplace for buying, selling, and discovering products, services, and businesses',
  'multi',
  'whatsapp',
  true,
  jsonb_build_object(
    'capabilities', ARRAY['product_listing', 'search', 'buyer_seller_matching', 'business_directory'],
    'categories', ARRAY['marketplace', 'commerce', 'buying', 'selling', 'business'],
    'channels', ARRAY['whatsapp', 'sms'],
    'priority', 'high',
    'replaces', 'broker'
  )
) ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata,
  is_active = true;

-- Add additional marketplace tools if not present
WITH marketplace_agent AS (SELECT id FROM public.ai_agents WHERE slug = 'marketplace')
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, tool.* FROM marketplace_agent,
LATERAL (VALUES
  ('contact_seller', 'Contact Seller', 'whatsapp',
   'Generate WhatsApp link to contact a seller',
   '{"type":"object","required":["listing_id"],"properties":{"listing_id":{"type":"string"},"message":{"type":"string"}}}'::jsonb,
   '{"generate_wa_link":true}'::jsonb,
   true),
  
  ('get_nearby_listings', 'Get Nearby Listings', 'db',
   'Find marketplace listings near user location',
   '{"type":"object","properties":{"category":{"type":"string"},"radius_km":{"type":"number"},"limit":{"type":"integer"}}}'::jsonb,
   '{"table":"marketplace_listings","location_search":true}'::jsonb,
   true),
  
  ('update_listing', 'Update Listing', 'db',
   'Update an existing marketplace listing',
   '{"type":"object","required":["listing_id"],"properties":{"listing_id":{"type":"string"},"price":{"type":"number"},"description":{"type":"string"},"status":{"type":"string","enum":["active","sold","inactive"]}}}'::jsonb,
   '{"table":"marketplace_listings","operation":"update"}'::jsonb,
   true)
) AS tool(name, display_name, tool_type, description, input_schema, config, is_active)
ON CONFLICT (agent_id, name) DO NOTHING;

-- =====================================================================
-- 3. DEPRECATE BUSINESS BROKER AGENT
-- =====================================================================
-- Mark broker as deprecated in favor of marketplace agent

UPDATE public.ai_agents 
SET 
  is_active = false,
  description = 'DEPRECATED: Merged into marketplace agent. Use marketplace instead.',
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{deprecated}',
    'true'::jsonb
  )
WHERE slug = 'broker';

-- Add deprecation notice to broker persona (if exists)
UPDATE public.ai_agent_personas
SET 
  role_name = '[DEPRECATED] ' || role_name,
  is_default = false
WHERE agent_id IN (SELECT id FROM public.ai_agents WHERE slug = 'broker');

-- Deactivate broker tools (keep for data migration reference)
UPDATE public.ai_agent_tools
SET is_active = false
WHERE agent_id IN (SELECT id FROM public.ai_agents WHERE slug = 'broker');

-- =====================================================================
-- 4. UPDATE HOME MENU TO MATCH AGENTS
-- =====================================================================

-- Ensure whatsapp_home_menu_items exists and is aligned
INSERT INTO public.whatsapp_home_menu_items (key, name, icon, description, is_active, display_order)
VALUES 
  ('support_agent', 'Support', '💬', 'General help and customer service', true, 9),
  ('marketplace_agent', 'Marketplace', '🛒', 'Buy and sell products and services', true, 5)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  is_active = true;

-- Deprecate broker menu item
UPDATE public.whatsapp_home_menu_items 
SET 
  is_active = false,
  name = name || ' (Deprecated)'
WHERE key IN ('broker_agent', 'business_broker_agent');

-- =====================================================================
-- 5. VALIDATION QUERIES (commented out - for manual verification)
-- =====================================================================

-- Check all active agents
-- SELECT slug, name, is_active, 
--        (SELECT COUNT(*) FROM ai_agent_tools WHERE agent_id = ai_agents.id AND is_active = true) as tool_count
-- FROM ai_agents 
-- WHERE is_active = true 
-- ORDER BY slug;

-- Check support agent config
-- SELECT 
--   a.slug,
--   p.role_name as persona,
--   i.title as instructions,
--   (SELECT COUNT(*) FROM ai_agent_tools WHERE agent_id = a.id AND is_active = true) as tools
-- FROM ai_agents a
-- LEFT JOIN ai_agent_personas p ON p.agent_id = a.id AND p.is_default = true
-- LEFT JOIN ai_agent_system_instructions i ON i.agent_id = a.id AND i.is_active = true
-- WHERE a.slug = 'support';

COMMIT;
