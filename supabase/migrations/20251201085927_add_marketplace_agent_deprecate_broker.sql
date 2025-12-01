-- =====================================================================
-- ADD MARKETPLACE AI AGENT AND DEPRECATE BROKER
-- =====================================================================
-- The marketplace agent is the unified commerce agent that:
-- - Replaces/merges the business_broker functionality
-- - Handles buying, selling, product listings
-- - Supports local commerce and business discovery
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. ADD MARKETPLACE AGENT
-- =====================================================================

INSERT INTO public.ai_agents (slug, name, description, default_persona_code, default_system_instruction_code, default_language, default_channel, is_active, metadata)
VALUES
  (
    'marketplace',
    'Marketplace AI Agent',
    'Unified marketplace for buying, selling, discovering businesses, and local commerce. Merges business broker functionality.',
    'MKTPL-PERSONA',
    'MKTPL-SYS',
    'multi',
    'whatsapp',
    true,
    jsonb_build_object(
      'categories', ARRAY['marketplace', 'commerce', 'buy', 'sell', 'business'],
      'replaces', 'broker',
      'version', '2.0'
    )
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  default_persona_code = EXCLUDED.default_persona_code,
  default_system_instruction_code = EXCLUDED.default_system_instruction_code,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- =====================================================================
-- 2. ADD MARKETPLACE PERSONA
-- =====================================================================

INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT
  id,
  'MKTPL-PERSONA',
  'Marketplace Concierge',
  'Friendly, helpful, commerce-focused. Assists buyers and sellers equally. Promotes local transactions.',
  ARRAY['en', 'fr', 'rw', 'sw'],
  jsonb_build_object(
    'greeting', 'Warm and welcoming',
    'focus', 'Quick, successful transactions',
    'style', 'Practical and action-oriented',
    'expertise', ARRAY['commerce', 'local_business', 'negotiation', 'product_knowledge']
  ),
  true
FROM public.ai_agents WHERE slug = 'marketplace'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 3. ADD MARKETPLACE SYSTEM INSTRUCTIONS
-- =====================================================================

INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT
  id,
  'MKTPL-SYS',
  'Marketplace Agent System Prompt',
  E'You are the easyMO Marketplace assistant. Help users:

FOR BUYERS:
- Search products by name, category, location
- Find nearby sellers
- Compare prices
- Contact sellers via WhatsApp
- Discover local businesses and services

FOR SELLERS:
- List products with photos, descriptions, prices
- Manage inventory
- Respond to buyer inquiries
- Promote their business

CATEGORIES:
- Electronics & Gadgets
- Vehicles & Auto parts
- Home & Furniture
- Fashion & Clothing
- Services (repair, cleaning, etc.)
- Business opportunities
- Wholesale products
- Handmade & crafts
- Books & Education
- Sports & Fitness

TOOLS AVAILABLE:
- search_listings: Search marketplace for products
- create_listing: Help sellers list new items
- search_businesses: Find local businesses
- contact_seller: Generate WhatsApp link to contact seller
- get_nearby_listings: Location-based product search

Always use the search tools to find real listings from the database.
Connect buyers and sellers quickly via WhatsApp links.
Focus on local, nearby transactions.

For listings, gather:
1. What are you selling/looking for?
2. Category
3. Condition (new/used)
4. Price or budget
5. Location
6. Photos (if selling)
7. Description/specifications

Type "menu" to return to main services menu.',
  E'GUARDRAILS:
- Never share personal contact info without consent
- Verify listings are real before recommending
- Avoid scams - report suspicious activity
- Don''t facilitate illegal transactions
- Mask phone numbers in logs
- Respect privacy - only share necessary info
- Encourage safe meetup locations for transactions
- Don''t guarantee product quality or seller reliability',
  'context_window',
  true
FROM public.ai_agents WHERE slug = 'marketplace'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 4. ADD MARKETPLACE TOOLS
-- =====================================================================

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT
  a.id,
  tool.name,
  tool.display_name,
  tool.tool_type,
  tool.description,
  tool.input_schema,
  tool.output_schema,
  tool.config,
  true
FROM public.ai_agents a,
LATERAL (
  VALUES
    (
      'search_listings',
      'Search Marketplace Listings',
      'db',
      'Search for products and services in the marketplace',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'query', jsonb_build_object('type', 'string', 'description', 'Search query'),
          'category', jsonb_build_object('type', 'string'),
          'price_min', jsonb_build_object('type', 'number'),
          'price_max', jsonb_build_object('type', 'number'),
          'condition', jsonb_build_object('type', 'string', 'enum', jsonb_build_array('new', 'like_new', 'used'))
        )
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'count', jsonb_build_object('type', 'number'),
          'listings', jsonb_build_object('type', 'array')
        )
      ),
      jsonb_build_object('table', 'marketplace_listings', 'limit', 15)
    ),
    (
      'create_listing',
      'Create Product Listing',
      'db',
      'Create a new product listing for sale',
      jsonb_build_object(
        'type', 'object',
        'required', jsonb_build_array('title', 'price', 'category'),
        'properties', jsonb_build_object(
          'title', jsonb_build_object('type', 'string'),
          'description', jsonb_build_object('type', 'string'),
          'price', jsonb_build_object('type', 'number'),
          'category', jsonb_build_object('type', 'string'),
          'condition', jsonb_build_object('type', 'string'),
          'location', jsonb_build_object('type', 'string'),
          'negotiable', jsonb_build_object('type', 'boolean')
        )
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'listing_id', jsonb_build_object('type', 'string'),
          'status', jsonb_build_object('type', 'string')
        )
      ),
      jsonb_build_object('table', 'marketplace_listings', 'operation', 'insert')
    ),
    (
      'search_businesses',
      'Search Local Businesses',
      'db',
      'Find local businesses and service providers',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'query', jsonb_build_object('type', 'string'),
          'category', jsonb_build_object('type', 'string'),
          'location', jsonb_build_object('type', 'string'),
          'radius_km', jsonb_build_object('type', 'number')
        )
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'count', jsonb_build_object('type', 'number'),
          'businesses', jsonb_build_object('type', 'array')
        )
      ),
      jsonb_build_object('table', 'business_directory', 'location_search', true)
    ),
    (
      'contact_seller',
      'Contact Seller',
      'whatsapp',
      'Generate WhatsApp link to contact a seller',
      jsonb_build_object(
        'type', 'object',
        'required', jsonb_build_array('listing_id'),
        'properties', jsonb_build_object(
          'listing_id', jsonb_build_object('type', 'string'),
          'message', jsonb_build_object('type', 'string')
        )
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'whatsapp_link', jsonb_build_object('type', 'string'),
          'seller_name', jsonb_build_object('type', 'string')
        )
      ),
      jsonb_build_object('generate_wa_link', true)
    ),
    (
      'get_nearby_listings',
      'Get Nearby Listings',
      'location',
      'Search for listings near user''s location',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'category', jsonb_build_object('type', 'string'),
          'radius_km', jsonb_build_object('type', 'number', 'default', 10),
          'limit', jsonb_build_object('type', 'number', 'default', 10)
        )
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'listings', jsonb_build_object('type', 'array'),
          'user_location', jsonb_build_object('type', 'object')
        )
      ),
      jsonb_build_object('requires_location', true)
    )
) AS tool(name, display_name, tool_type, description, input_schema, output_schema, config)
WHERE a.slug = 'marketplace'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 5. ADD MARKETPLACE TASKS
-- =====================================================================

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT
  a.id,
  task.code,
  task.name,
  task.description,
  task.trigger_description,
  task.tools_used,
  task.output_description,
  task.requires_human_handoff,
  task.metadata
FROM public.ai_agents a,
LATERAL (
  VALUES
    (
      'BUYER_SEARCH',
      'Help Buyer Search Products',
      'Assist buyers in finding products matching their needs',
      'User says "I want to buy...", "looking for...", "need..."',
      ARRAY['search_listings', 'get_nearby_listings'],
      'List of matching products with prices and seller contact',
      false,
      jsonb_build_object('priority', 'high', 'avg_duration_seconds', 60)
    ),
    (
      'SELLER_LISTING',
      'Help Seller Create Listing',
      'Guide sellers through creating a new product listing',
      'User says "I want to sell...", "list my...", "sell..."',
      ARRAY['create_listing'],
      'Confirmed listing with ID and next steps',
      false,
      jsonb_build_object('priority', 'high', 'avg_duration_seconds', 120)
    ),
    (
      'FIND_BUSINESS',
      'Find Local Business',
      'Help users discover local businesses and services',
      'User asks about services, repair shops, stores nearby',
      ARRAY['search_businesses', 'get_nearby_listings'],
      'List of relevant businesses with contact info',
      false,
      jsonb_build_object('priority', 'medium', 'avg_duration_seconds', 45)
    ),
    (
      'CONNECT_BUYER_SELLER',
      'Connect Buyer and Seller',
      'Facilitate connection between interested buyer and seller',
      'User wants to contact seller or arrange purchase',
      ARRAY['contact_seller'],
      'WhatsApp link to contact seller directly',
      false,
      jsonb_build_object('priority', 'high', 'avg_duration_seconds', 30)
    )
) AS task(code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
WHERE a.slug = 'marketplace'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 6. DEPRECATE BROKER AGENT (Keep for backward compatibility)
-- =====================================================================

UPDATE public.ai_agents
SET
  is_active = false,
  description = 'DEPRECATED: Merged into marketplace agent. Use marketplace instead.',
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'deprecated', true,
    'deprecated_at', now(),
    'replaced_by', 'marketplace',
    'reason', 'Unified marketplace agent now handles all buy/sell functionality'
  ),
  updated_at = now()
WHERE slug = 'broker';

-- =====================================================================
-- 7. UPDATE HOME MENU TO USE MARKETPLACE
-- =====================================================================

-- Update any menu items pointing to broker to use marketplace
UPDATE public.whatsapp_home_menu_items
SET
  key = 'marketplace_agent',
  updated_at = now()
WHERE key IN ('broker_agent', 'business_broker_agent', 'broker')
  AND key != 'marketplace_agent';

COMMIT;
