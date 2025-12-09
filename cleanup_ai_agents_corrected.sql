-- =====================================================
-- AI AGENTS CLEANUP & CONSOLIDATION (CORRECTED SCHEMA)
-- =====================================================
-- 
-- OBJECTIVE: Consolidate to 8 live agents only
-- =====================================================

BEGIN;

-- First, check current state
SELECT 
  slug,
  name,
  is_active,
  (SELECT COUNT(*) FROM ai_agent_personas WHERE agent_id = ai_agents.id) as personas,
  (SELECT COUNT(*) FROM ai_agent_system_instructions WHERE agent_id = ai_agents.id AND is_active = true) as instructions,
  (SELECT COUNT(*) FROM ai_agent_tasks WHERE agent_id = ai_agents.id) as tasks,
  (SELECT COUNT(*) FROM ai_agent_tools WHERE agent_id = ai_agents.id AND is_active = true) as tools
FROM ai_agents
WHERE is_active = true
ORDER BY slug;

-- =====================================================
-- Create/Update buy_sell_agent
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
  'buy_sell',
  'Buy & Sell AI Agent',
  'AI-powered business finder and marketplace assistant. Helps users discover local businesses (8,232+) using natural language. Tag-based search across 17 categories.',
  'helpful_finder',
  'buy_sell_main',
  'en',
  'whatsapp',
  true,
  jsonb_build_object(
    'capabilities', array['business_search', 'tag_matching', 'natural_language', 'location_based'],
    'total_businesses', 8232,
    'categories', 17,
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
-- Add Buy & Sell Agent Documentation
-- =====================================================

-- Get buy_sell agent ID
DO $$
DECLARE
  v_agent_id UUID;
BEGIN
  SELECT id INTO v_agent_id FROM ai_agents WHERE slug = 'buy_sell';

  -- Insert Persona
  INSERT INTO ai_agent_personas (
    agent_id,
    code,
    role_name,
    tone_style,
    languages,
    traits,
    is_default
  )
  VALUES (
    v_agent_id,
    'helpful_finder',
    'Helpful Business Finder',
    'Friendly, knowledgeable, and patient. Uses casual but professional language with moderate emoji usage.',
    ARRAY['en'],
    jsonb_build_object(
      'personality', 'warm and helpful',
      'approach', 'ask clarifying questions when needed',
      'response_style', 'concise with bullet points',
      'emoji_usage', 'moderate - use relevant emojis like 💊🍔✂️📱'
    ),
    true
  )
  ON CONFLICT (agent_id, code) DO UPDATE SET
    role_name = EXCLUDED.role_name,
    tone_style = EXCLUDED.tone_style,
    traits = EXCLUDED.traits,
    is_default = EXCLUDED.is_default;

  -- Insert System Instructions
  INSERT INTO ai_agent_system_instructions (
    agent_id,
    code,
    title,
    instructions,
    guardrails,
    memory_strategy,
    is_active
  )
  VALUES (
    v_agent_id,
    'buy_sell_main',
    'Buy & Sell Business Finder Instructions',
    E'You are a helpful AI assistant that helps users find local businesses and services in Rwanda.

CAPABILITIES:
- Search 8,232 businesses across 17 categories
- Understand natural language (e.g., "need medicine", "hungry", "haircut")  
- Tag-based matching from rich business tags database
- Location-aware results with distance sorting

SEARCH APPROACH:
1. Extract user intent from message
2. Map to relevant tags (e.g., "medicine" → pharmacy, drugs, prescriptions)
3. Query businesses table using tags column (text[])
4. Sort by distance if location available
5. Return top 5-9 matches

CATEGORIES & SAMPLE TAGS:
- Pharmacies: pharmacy, medicine, drugs, prescriptions, chemist
- Restaurants/Bars: restaurant, food, bar, nyama choma, pizza
- Salons: salon, barber, haircut, beauty, braids
- Electronics: phone, laptop, electronics, repair, charger
- Hardware: hardware, construction, cement, paint, tools
- Groceries: supermarket, grocery, fruits, vegetables, meat
- Fashion: boutique, clothes, tailor, shoes, bags
- Auto Services: garage, mechanic, tyres, car wash, parts
- (9 more categories with rich tags)

CONVERSATION FLOW:
1. Greet warmly: "I can help! What are you looking for?"
2. Understand need: Ask for specifics if unclear
3. Search businesses: Use tag matching
4. Present results: Top matches with distance, contact
5. Offer help: "Need anything else?"

RESPONSE FORMAT:
✅ Use emojis for visual clarity
✅ Show business name, distance, address, phone, WhatsApp
✅ List 5-9 results (more if requested)
✅ Offer pagination if 20+ matches

IMPORTANT RULES:
❌ NEVER translate to Kinyarwanda - English only
❌ Don''t make up businesses - only show real data
❌ Don''t share personal opinions about businesses
✅ Be helpful, accurate, and concise',
    E'CRITICAL GUARDRAILS:
1. Language: ONLY English - no Kinyarwanda translation
2. Data: Only return actual businesses from database
3. Privacy: Don''t save or share user location data
4. Scope: Business finding only - no payments, booking, ordering
5. Accuracy: Verify tags match user intent before searching',
    'short_term',
    true
  )
  ON CONFLICT (agent_id, code) DO UPDATE SET
    title = EXCLUDED.title,
    instructions = EXCLUDED.instructions,
    guardrails = EXCLUDED.guardrails,
    memory_strategy = EXCLUDED.memory_strategy,
    is_active = EXCLUDED.is_active;

  -- Insert Tasks
  INSERT INTO ai_agent_tasks (
    agent_id,
    code,
    name,
    description,
    trigger_description,
    tools_used,
    output_description,
    requires_human_handoff,
    metadata
  )
  VALUES
  (
    v_agent_id,
    'search_businesses',
    'Search Businesses by Tags',
    'Search businesses table using natural language query mapped to tags',
    'User asks for a business, product, or service',
    ARRAY['search_businesses_by_tags'],
    'List of matching businesses with name, address, phone, distance',
    false,
    jsonb_build_object(
      'examples', jsonb_build_array(
        jsonb_build_object('input', 'I need medicine', 'tags', array['pharmacy', 'medicine', 'drugs']),
        jsonb_build_object('input', 'hungry pizza', 'tags', array['restaurant', 'pizza', 'food']),
        jsonb_build_object('input', 'phone repair', 'tags', array['electronics', 'phone', 'repair'])
      )
    )
  ),
  (
    v_agent_id,
    'clarify_intent',
    'Clarify User Intent',
    'Ask clarifying questions when user request is vague or ambiguous',
    'User message is too vague or has multiple interpretations',
    ARRAY[]::text[],
    'Clarifying question to help narrow down search',
    false,
    jsonb_build_object(
      'examples', jsonb_build_array(
        jsonb_build_object('input', 'shop', 'question', 'What kind of shop are you looking for? (e.g., grocery, electronics, clothing)'),
        jsonb_build_object('input', 'food', 'question', 'What type of food? Restaurant, fast food, or grocery shopping?')
      )
    )
  ),
  (
    v_agent_id,
    'show_category_options',
    'Show Category Options',
    'Present business categories when user wants to browse',
    'User wants to see all options or browse categories',
    ARRAY[]::text[],
    'List of 17 business categories',
    false,
    jsonb_build_object()
  )
  ON CONFLICT DO NOTHING;

  -- Insert Tools
  INSERT INTO ai_agent_tools (
    agent_id,
    name,
    display_name,
    tool_type,
    description,
    input_schema,
    output_schema,
    config,
    is_active
  )
  VALUES
  (
    v_agent_id,
    'search_businesses_by_tags',
    'Search Businesses by Tags',
    'database_query',
    'Search businesses table using tag-based matching. Maps natural language to tags and finds matching businesses sorted by distance.',
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'query', jsonb_build_object('type', 'string', 'description', 'User search query'),
        'tags', jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'string'), 'description', 'Tags to search for'),
        'latitude', jsonb_build_object('type', 'number', 'description', 'User latitude (optional)'),
        'longitude', jsonb_build_object('type', 'number', 'description', 'User longitude (optional)'),
        'limit', jsonb_build_object('type', 'integer', 'default', 9, 'description', 'Max results to return')
      ),
      'required', array['tags']
    ),
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'businesses', jsonb_build_object('type', 'array', 'description', 'Matching businesses'),
        'total', jsonb_build_object('type', 'integer', 'description', 'Total matches'),
        'formatted_message', jsonb_build_object('type', 'string', 'description', 'WhatsApp-ready message')
      )
    ),
    jsonb_build_object(
      'table', 'businesses',
      'search_column', 'tags',
      'return_columns', array['id', 'name', 'buy_sell_category', 'address', 'phone', 'owner_whatsapp', 'lat', 'lng', 'tags']
    ),
    true
  )
  ON CONFLICT (agent_id, name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    input_schema = EXCLUDED.input_schema,
    output_schema = EXCLUDED.output_schema,
    config = EXCLUDED.config,
    is_active = EXCLUDED.is_active;

END $$;

-- =====================================================
-- Deactivate deprecated agents (preserve data)
-- =====================================================

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
    '{reason}',
    '"Merged into buy_sell agent"'::jsonb
  ),
  updated_at = NOW()
WHERE slug IN ('business_broker', 'marketplace', 'buy_and_sell')
AND is_active = true;

-- =====================================================
-- Update home menu to use buy_sell
-- =====================================================

UPDATE whatsapp_home_menu_items
SET 
  key = 'buy_sell_agent',
  updated_at = NOW()
WHERE key IN ('business_broker_agent', 'general_broker', 'marketplace', 'buy_and_sell');

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT '=== ACTIVE AI AGENTS ===' as info;

SELECT 
  slug,
  name,
  (SELECT COUNT(*) FROM ai_agent_personas WHERE agent_id = ai_agents.id) as personas,
  (SELECT COUNT(*) FROM ai_agent_system_instructions WHERE agent_id = ai_agents.id AND is_active = true) as instructions,
  (SELECT COUNT(*) FROM ai_agent_tasks WHERE agent_id = ai_agents.id) as tasks,
  (SELECT COUNT(*) FROM ai_agent_tools WHERE agent_id = ai_agents.id AND is_active = true) as tools
FROM ai_agents
WHERE is_active = true
ORDER BY slug;

SELECT '=== BUY & SELL DOCUMENTATION ===' as info;

SELECT 
  'Personas: ' || COUNT(*)::text as metric
FROM ai_agent_personas p
JOIN ai_agents a ON a.id = p.agent_id
WHERE a.slug = 'buy_sell';

SELECT 
  'Instructions: ' || COUNT(*)::text as metric
FROM ai_agent_system_instructions si
JOIN ai_agents a ON a.id = si.agent_id
WHERE a.slug = 'buy_sell' AND si.is_active = true;

SELECT 
  'Tasks: ' || COUNT(*)::text as metric
FROM ai_agent_tasks t
JOIN ai_agents a ON a.id = t.agent_id
WHERE a.slug = 'buy_sell';

SELECT 
  'Tools: ' || COUNT(*)::text as metric
FROM ai_agent_tools t
JOIN ai_agents a ON a.id = t.agent_id
WHERE a.slug = 'buy_sell' AND t.is_active = true;

COMMIT;
