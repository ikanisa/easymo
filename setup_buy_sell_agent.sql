-- Simple setup for buy_sell agent
BEGIN;

-- Create/update agent
INSERT INTO ai_agents (
  slug, name, description,
  default_persona_code, default_system_instruction_code,
  default_language, default_channel, is_active,
  metadata
)
VALUES (
  'buy_sell',
  'Buy & Sell AI Agent',
  'AI-powered business finder using natural language and tag-based search across 8,232+ businesses in 17 categories',
  'helpful_finder',
  'buy_sell_main',
  'en', 'whatsapp', true,
  '{"capabilities": ["business_search", "tag_matching", "natural_language"], "total_businesses": 8232, "categories": 17}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true,
  metadata = EXCLUDED.metadata;

-- Get agent ID
DO $$
DECLARE v_agent_id UUID;
BEGIN
  SELECT id INTO v_agent_id FROM ai_agents WHERE slug = 'buy_sell';

  -- Clear existing docs for clean slate
  DELETE FROM ai_agent_personas WHERE agent_id = v_agent_id;
  DELETE FROM ai_agent_system_instructions WHERE agent_id = v_agent_id;
  DELETE FROM ai_agent_tasks WHERE agent_id = v_agent_id;
  DELETE FROM ai_agent_tools WHERE agent_id = v_agent_id;

  -- Add persona
  INSERT INTO ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
  VALUES (
    v_agent_id, 'helpful_finder', 'Helpful Business Finder',
    'Friendly and knowledgeable. Casual but professional. Moderate emoji usage.',
    ARRAY['en'],
    '{"personality": "warm and helpful", "approach": "ask clarifying questions", "response_style": "concise with emojis"}'::jsonb,
    true
  );

  -- Add system instructions
  INSERT INTO ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, is_active)
  VALUES (
    v_agent_id, 'buy_sell_main', 'Business Finder Instructions',
    E'You help users find local businesses in Rwanda (8,232 businesses, 17 categories).

SEARCH: Map user query to tags, search businesses table, sort by distance.
CATEGORIES: Pharmacies, Restaurants, Salons, Electronics, Hardware, Groceries, Fashion, Auto, Notaries, Accountants, Banks, Hospitals, Hotels, Real Estate, Schools, Transport, Other Services.
RESPONSE: Show 5-9 results with name, distance, address, phone, WhatsApp. Use emojis.
RULES: English only (no Kinyarwanda). Only show real businesses. Be helpful and concise.',
    'English only. No fake data. Business finding only.',
    true
  );

  -- Add tasks
  INSERT INTO ai_agent_tasks (agent_id, code, name, description, tools_used)
  VALUES
    (v_agent_id, 'search_businesses', 'Search Businesses', 'Tag-based business search', ARRAY['search_businesses_by_tags']),
    (v_agent_id, 'clarify_intent', 'Clarify Intent', 'Ask clarifying questions', ARRAY[]::text[]),
    (v_agent_id, 'show_categories', 'Show Categories', 'List 17 business categories', ARRAY[]::text[]);

  -- Add tool
  INSERT INTO ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, is_active)
  VALUES (
    v_agent_id, 'search_businesses_by_tags', 'Search Businesses by Tags', 'database_query',
    'Search businesses using tag matching',
    '{"type": "object", "properties": {"tags": {"type": "array"}, "latitude": {"type": "number"}, "longitude": {"type": "number"}, "limit": {"type": "integer", "default": 9}}, "required": ["tags"]}'::jsonb,
    true
  );
END $$;

-- Deactivate old agents
UPDATE ai_agents SET is_active = false WHERE slug IN ('business_broker', 'marketplace', 'buy_and_sell');

-- Update menu
UPDATE whatsapp_home_menu_items SET key = 'buy_sell_agent' WHERE key IN ('business_broker_agent', 'general_broker', 'marketplace');

-- Verify
SELECT slug, name, 
  (SELECT COUNT(*) FROM ai_agent_personas WHERE agent_id = ai_agents.id) as personas,
  (SELECT COUNT(*) FROM ai_agent_system_instructions WHERE agent_id = ai_agents.id) as instructions,
  (SELECT COUNT(*) FROM ai_agent_tasks WHERE agent_id = ai_agents.id) as tasks,
  (SELECT COUNT(*) FROM ai_agent_tools WHERE agent_id = ai_agents.id) as tools
FROM ai_agents WHERE slug = 'buy_sell';

COMMIT;
