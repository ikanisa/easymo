-- =====================================================
-- AI AGENTS CLEANUP & CONSOLIDATION
-- =====================================================
-- 
-- OBJECTIVE: Consolidate to 8 live agents only:
-- 1. waiter_agent (Bars & Restaurants)
-- 2. rides_agent (Mobility & Transport)
-- 3. jobs_agent (Jobs & Gigs)
-- 4. buy_sell_agent (Business Broker + Marketplace - MERGED)
-- 5. real_estate_agent (Property Rentals)
-- 6. farmer_agent (Agriculture)
-- 7. insurance_agent (Insurance)
-- 8. sales_agent (Sales & Marketing)
--
-- ACTIONS:
-- - Merge: business_broker_agent + marketplace_agent → buy_sell_agent
-- - Delete: Deprecated agents (insurance_advisor, etc.)
-- - Consolidate documentation from all 3 agents into buy_sell_agent
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Analyze current state
-- =====================================================

-- Check all current agents
SELECT 
  slug,
  name,
  is_active,
  (SELECT COUNT(*) FROM ai_agent_personas WHERE agent_id = ai_agents.id) as personas_count,
  (SELECT COUNT(*) FROM ai_agent_system_instructions WHERE agent_id = ai_agents.id) as instructions_count,
  (SELECT COUNT(*) FROM ai_agent_tasks WHERE agent_id = ai_agents.id) as tasks_count,
  (SELECT COUNT(*) FROM ai_agent_tools WHERE agent_id = ai_agents.id) as tools_count
FROM ai_agents
ORDER BY slug;

-- =====================================================
-- STEP 2: Create buy_sell_agent if not exists
-- =====================================================

INSERT INTO ai_agents (
  slug,
  name,
  description,
  default_persona_code,
  default_system_instruction_code,
  default_language,
  default_channel,
  is_active,
  metadata
)
VALUES (
  'buy_sell_agent',
  'Buy & Sell AI Agent',
  'AI-powered business finder and marketplace assistant. Helps users discover local businesses, products, and services through natural language conversation. Combines business directory search with marketplace listings.',
  'buy_sell_helpful',
  'buy_sell_system',
  'en',
  'whatsapp',
  true,
  jsonb_build_object(
    'capabilities', array['business_search', 'marketplace', 'recommendations', 'natural_language'],
    'supported_categories', array['pharmacies', 'restaurants', 'salons', 'electronics', 'hardware', 'groceries', 'fashion', 'auto_services', 'notaries', 'accountants', 'banks', 'hospitals', 'hotels', 'transport', 'other_services'],
    'search_methods', array['tag_based', 'semantic', 'location_based', 'category_based'],
    'version', '2.0'
  )
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- =====================================================
-- STEP 3: Merge personas from all 3 agents into buy_sell_agent
-- =====================================================

-- Get buy_sell_agent id
DO $$
DECLARE
  v_buy_sell_id UUID;
  v_business_broker_id UUID;
  v_marketplace_id UUID;
BEGIN
  SELECT id INTO v_buy_sell_id FROM ai_agents WHERE slug = 'buy_sell_agent';
  SELECT id INTO v_business_broker_id FROM ai_agents WHERE slug = 'business_broker_agent';
  SELECT id INTO v_marketplace_id FROM ai_agents WHERE slug = 'marketplace_agent';

  -- Copy personas from business_broker_agent
  INSERT INTO ai_agent_personas (agent_id, code, name, description, tone, style, examples, is_active)
  SELECT 
    v_buy_sell_id,
    code,
    name,
    description,
    tone,
    style,
    examples,
    is_active
  FROM ai_agent_personas
  WHERE agent_id = v_business_broker_id
  ON CONFLICT (agent_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    tone = EXCLUDED.tone,
    style = EXCLUDED.style,
    examples = EXCLUDED.examples,
    is_active = EXCLUDED.is_active;

  -- Copy personas from marketplace_agent
  INSERT INTO ai_agent_personas (agent_id, code, name, description, tone, style, examples, is_active)
  SELECT 
    v_buy_sell_id,
    code || '_marketplace' as code, -- Avoid conflicts
    name || ' (Marketplace)',
    description,
    tone,
    style,
    examples,
    is_active
  FROM ai_agent_personas
  WHERE agent_id = v_marketplace_id
  ON CONFLICT (agent_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    tone = EXCLUDED.tone,
    style = EXCLUDED.style,
    examples = EXCLUDED.examples,
    is_active = EXCLUDED.is_active;
END $$;

-- =====================================================
-- STEP 4: Merge system instructions
-- =====================================================

DO $$
DECLARE
  v_buy_sell_id UUID;
  v_business_broker_id UUID;
  v_marketplace_id UUID;
BEGIN
  SELECT id INTO v_buy_sell_id FROM ai_agents WHERE slug = 'buy_sell_agent';
  SELECT id INTO v_business_broker_id FROM ai_agents WHERE slug = 'business_broker_agent';
  SELECT id INTO v_marketplace_id FROM ai_agents WHERE slug = 'marketplace_agent';

  -- Merge instructions from business_broker_agent
  INSERT INTO ai_agent_system_instructions (agent_id, code, content, priority, is_active)
  SELECT 
    v_buy_sell_id,
    code,
    content,
    priority,
    is_active
  FROM ai_agent_system_instructions
  WHERE agent_id = v_business_broker_id
  ON CONFLICT (agent_id, code) DO UPDATE SET
    content = EXCLUDED.content,
    priority = EXCLUDED.priority,
    is_active = EXCLUDED.is_active;

  -- Merge instructions from marketplace_agent
  INSERT INTO ai_agent_system_instructions (agent_id, code, content, priority, is_active)
  SELECT 
    v_buy_sell_id,
    code || '_marketplace' as code,
    content,
    priority,
    is_active
  FROM ai_agent_system_instructions
  WHERE agent_id = v_marketplace_id
  ON CONFLICT (agent_id, code) DO UPDATE SET
    content = EXCLUDED.content,
    priority = EXCLUDED.priority,
    is_active = EXCLUDED.is_active;
END $$;

-- =====================================================
-- STEP 5: Merge tasks
-- =====================================================

DO $$
DECLARE
  v_buy_sell_id UUID;
  v_business_broker_id UUID;
  v_marketplace_id UUID;
BEGIN
  SELECT id INTO v_buy_sell_id FROM ai_agents WHERE slug = 'buy_sell_agent';
  SELECT id INTO v_business_broker_id FROM ai_agents WHERE slug = 'business_broker_agent';
  SELECT id INTO v_marketplace_id FROM ai_agents WHERE slug = 'marketplace_agent';

  -- Merge tasks from business_broker_agent
  INSERT INTO ai_agent_tasks (agent_id, code, name, description, expected_input, expected_output, examples, is_active)
  SELECT 
    v_buy_sell_id,
    code,
    name,
    description,
    expected_input,
    expected_output,
    examples,
    is_active
  FROM ai_agent_tasks
  WHERE agent_id = v_business_broker_id
  ON CONFLICT (agent_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    expected_input = EXCLUDED.expected_input,
    expected_output = EXCLUDED.expected_output,
    examples = EXCLUDED.examples,
    is_active = EXCLUDED.is_active;

  -- Merge tasks from marketplace_agent
  INSERT INTO ai_agent_tasks (agent_id, code, name, description, expected_input, expected_output, examples, is_active)
  SELECT 
    v_buy_sell_id,
    code || '_marketplace' as code,
    name || ' (Marketplace)',
    description,
    expected_input,
    expected_output,
    examples,
    is_active
  FROM ai_agent_tasks
  WHERE agent_id = v_marketplace_id
  ON CONFLICT (agent_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    expected_input = EXCLUDED.expected_input,
    expected_output = EXCLUDED.expected_output,
    examples = EXCLUDED.examples,
    is_active = EXCLUDED.is_active;
END $$;

-- =====================================================
-- STEP 6: Merge tools
-- =====================================================

DO $$
DECLARE
  v_buy_sell_id UUID;
  v_business_broker_id UUID;
  v_marketplace_id UUID;
BEGIN
  SELECT id INTO v_buy_sell_id FROM ai_agents WHERE slug = 'buy_sell_agent';
  SELECT id INTO v_business_broker_id FROM ai_agents WHERE slug = 'business_broker_agent';
  SELECT id INTO v_marketplace_id FROM ai_agents WHERE slug = 'marketplace_agent';

  -- Merge tools from business_broker_agent
  INSERT INTO ai_agent_tools (agent_id, code, name, description, parameters_schema, is_active)
  SELECT 
    v_buy_sell_id,
    code,
    name,
    description,
    parameters_schema,
    is_active
  FROM ai_agent_tools
  WHERE agent_id = v_business_broker_id
  ON CONFLICT (agent_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    parameters_schema = EXCLUDED.parameters_schema,
    is_active = EXCLUDED.is_active;

  -- Merge tools from marketplace_agent
  INSERT INTO ai_agent_tools (agent_id, code, name, description, parameters_schema, is_active)
  SELECT 
    v_buy_sell_id,
    code,
    name,
    description,
    parameters_schema,
    is_active
  FROM ai_agent_tools
  WHERE agent_id = v_marketplace_id
  ON CONFLICT (agent_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    parameters_schema = EXCLUDED.parameters_schema,
    is_active = EXCLUDED.is_active;
END $$;

-- =====================================================
-- STEP 7: Add comprehensive buy_sell_agent documentation
-- =====================================================

-- Insert core personas
INSERT INTO ai_agent_personas (agent_id, code, name, description, tone, style, examples, is_active)
SELECT 
  id as agent_id,
  'buy_sell_helpful' as code,
  'Helpful Business Finder' as name,
  'Friendly, knowledgeable assistant that helps users find local businesses and services through natural conversation' as description,
  jsonb_build_object(
    'personality', 'warm, helpful, patient',
    'language_style', 'casual but professional',
    'emoji_usage', 'moderate - use relevant emojis'
  ) as tone,
  jsonb_build_object(
    'response_length', 'concise',
    'formatting', 'use bullet points and emojis',
    'questions', 'ask clarifying questions when needed'
  ) as style,
  jsonb_build_array(
    'User: I need medicine → Agent: I can help! What type of medicine are you looking for? 💊',
    'User: phone repair → Agent: Got it! Let me find phone repair shops near you 📱'
  ) as examples,
  true as is_active
FROM ai_agents 
WHERE slug = 'buy_sell_agent'
ON CONFLICT (agent_id, code) DO UPDATE SET
  description = EXCLUDED.description,
  tone = EXCLUDED.tone,
  style = EXCLUDED.style;

-- Insert system instructions
INSERT INTO ai_agent_system_instructions (agent_id, code, content, priority, is_active)
SELECT 
  id as agent_id,
  'buy_sell_system' as code,
  'You are a helpful AI assistant that helps users find local businesses and services in Rwanda.

CAPABILITIES:
- Search 8,000+ businesses across all categories using tags
- Understand natural language queries (e.g., "need medicine", "hungry", "haircut")
- Find businesses by location, category, or specific needs
- Provide business details: name, address, phone, WhatsApp

SEARCH APPROACH:
1. Extract intent from user message (what they need)
2. Map to relevant tags from business categories
3. Search businesses table using tags column
4. Return top matches sorted by distance

CATEGORIES & TAGS:
- Pharmacies: pharmacy, medicine, drugs, prescriptions
- Restaurants: restaurant, food, bar, nyama choma
- Salons: salon, barber, haircut, beauty
- Electronics: phone, laptop, electronics, repair
- Hardware: hardware, construction, cement, paint
- And 12 more categories with rich tags

CONVERSATION FLOW:
1. Greet user warmly
2. Understand what they need
3. Search using tags
4. Present results clearly
5. Offer to help further

RESPONSE FORMAT:
- Use emojis for clarity
- Show top 5-9 results
- Include distance, contact info
- Offer pagination if many results

IMPORTANT:
- NEVER translate to Kinyarwanda
- Always use English
- Be concise and helpful
- Focus on finding the right businesses' as content,
  1 as priority,
  true as is_active
FROM ai_agents 
WHERE slug = 'buy_sell_agent'
ON CONFLICT (agent_id, code) DO UPDATE SET
  content = EXCLUDED.content;

-- Insert tasks
INSERT INTO ai_agent_tasks (agent_id, code, name, description, expected_input, expected_output, examples, is_active)
SELECT 
  id as agent_id,
  'search_businesses' as code,
  'Search Businesses by Tags' as name,
  'Search businesses table using natural language query mapped to tags' as description,
  jsonb_build_object(
    'user_query', 'string - what user is looking for',
    'location', 'optional - user location for distance sorting'
  ) as expected_input,
  jsonb_build_object(
    'businesses', 'array of matching businesses',
    'count', 'total matches',
    'formatted_message', 'WhatsApp-ready message with results'
  ) as expected_output,
  jsonb_build_array(
    jsonb_build_object('input', 'need medicine', 'tags', array['pharmacy', 'medicine', 'drugs']),
    jsonb_build_object('input', 'hungry pizza', 'tags', array['restaurant', 'pizza', 'food']),
    jsonb_build_object('input', 'phone repair', 'tags', array['electronics', 'phone', 'repair'])
  ) as examples,
  true as is_active
FROM ai_agents 
WHERE slug = 'buy_sell_agent'
ON CONFLICT (agent_id, code) DO UPDATE SET
  description = EXCLUDED.description;

-- Insert tools
INSERT INTO ai_agent_tools (agent_id, code, name, description, parameters_schema, is_active)
SELECT 
  id as agent_id,
  'search_businesses_by_tags' as code,
  'Search Businesses by Tags' as name,
  'Search businesses table using tag-based matching. Supports natural language queries.' as description,
  jsonb_build_object(
    'type', 'object',
    'properties', jsonb_build_object(
      'query', jsonb_build_object('type', 'string', 'description', 'User search query'),
      'tags', jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'string'), 'description', 'Tags to search for'),
      'latitude', jsonb_build_object('type', 'number', 'description', 'User latitude'),
      'longitude', jsonb_build_object('type', 'number', 'description', 'User longitude'),
      'limit', jsonb_build_object('type', 'integer', 'default', 9)
    ),
    'required', array['tags']
  ) as parameters_schema,
  true as is_active
FROM ai_agents 
WHERE slug = 'buy_sell_agent'
ON CONFLICT (agent_id, code) DO UPDATE SET
  description = EXCLUDED.description,
  parameters_schema = EXCLUDED.parameters_schema;

-- =====================================================
-- STEP 8: Deactivate deprecated agents
-- =====================================================

-- Mark as inactive (DO NOT DELETE - preserve data)
UPDATE ai_agents 
SET 
  is_active = false,
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{deprecated}',
    'true'::jsonb
  ),
  metadata = jsonb_set(
    metadata,
    '{deprecated_date}',
    to_jsonb(NOW()::text)
  ),
  metadata = jsonb_set(
    metadata,
    '{merged_into}',
    '"buy_sell_agent"'::jsonb
  ),
  updated_at = NOW()
WHERE slug IN ('business_broker_agent', 'marketplace_agent');

-- Also deactivate any other deprecated agents
UPDATE ai_agents 
SET 
  is_active = false,
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{deprecated}',
    'true'::jsonb
  ),
  updated_at = NOW()
WHERE slug IN (
  'insurance_advisor',
  'insurance_advisor_agent',
  'call_center_agent',
  'universal_agent'
) AND is_active = true;

-- =====================================================
-- STEP 9: Verify final state - Only 8 active agents
-- =====================================================

SELECT 
  '=== ACTIVE AI AGENTS (SHOULD BE 8) ===' as status;

SELECT 
  slug,
  name,
  is_active,
  (SELECT COUNT(*) FROM ai_agent_personas WHERE agent_id = ai_agents.id AND is_active = true) as personas,
  (SELECT COUNT(*) FROM ai_agent_system_instructions WHERE agent_id = ai_agents.id AND is_active = true) as instructions,
  (SELECT COUNT(*) FROM ai_agent_tasks WHERE agent_id = ai_agents.id AND is_active = true) as tasks,
  (SELECT COUNT(*) FROM ai_agent_tools WHERE agent_id = ai_agents.id AND is_active = true) as tools
FROM ai_agents
WHERE is_active = true
ORDER BY slug;

SELECT 
  '=== DEPRECATED AGENTS ===' as status;

SELECT 
  slug,
  name,
  metadata->>'merged_into' as merged_into,
  metadata->>'deprecated_date' as deprecated_date
FROM ai_agents
WHERE is_active = false
ORDER BY slug;

-- =====================================================
-- STEP 10: Update home menu to use buy_sell_agent
-- =====================================================

UPDATE whatsapp_home_menu_items
SET 
  key = 'buy_sell_agent',
  updated_at = NOW()
WHERE key IN ('business_broker_agent', 'general_broker', 'marketplace');

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check buy_sell_agent documentation richness
SELECT 
  '=== BUY & SELL AGENT DOCUMENTATION ===' as status;

SELECT 
  'Personas: ' || COUNT(*)::text as metric
FROM ai_agent_personas p
JOIN ai_agents a ON a.id = p.agent_id
WHERE a.slug = 'buy_sell_agent' AND p.is_active = true;

SELECT 
  'System Instructions: ' || COUNT(*)::text as metric
FROM ai_agent_system_instructions si
JOIN ai_agents a ON a.id = si.agent_id
WHERE a.slug = 'buy_sell_agent' AND si.is_active = true;

SELECT 
  'Tasks: ' || COUNT(*)::text as metric
FROM ai_agent_tasks t
JOIN ai_agents a ON a.id = t.agent_id
WHERE a.slug = 'buy_sell_agent' AND t.is_active = true;

SELECT 
  'Tools: ' || COUNT(*)::text as metric
FROM ai_agent_tools t
JOIN ai_agents a ON a.id = t.agent_id
WHERE a.slug = 'buy_sell_agent' AND t.is_active = true;
