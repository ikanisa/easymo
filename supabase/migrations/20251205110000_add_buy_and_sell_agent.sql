-- =====================================================================
-- ADD BUY & SELL AI AGENT AND DEPRECATE MARKETPLACE/BUSINESS_BROKER
-- =====================================================================
-- This migration creates a unified 'buy_and_sell' agent that merges:
-- - Marketplace Agent (pharmacy, hardware, grocery commerce)
-- - Business Broker Agent (business sales, acquisitions, legal intake)
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. ADD BUY_AND_SELL AGENT
-- =====================================================================

INSERT INTO public.ai_agents (slug, name, description, default_persona_code, default_system_instruction_code, default_language, default_channel, is_active, metadata)
VALUES
  (
    'buy_and_sell',
    'Buy & Sell AI Agent',
    'Unified commerce and business discovery agent. Handles marketplace transactions (buying/selling products), business discovery, business brokerage (sales/acquisitions), and legal intake.',
    'BAS-PERSONA',
    'BAS-SYS',
    'multi',
    'whatsapp',
    true,
    jsonb_build_object(
      'categories', ARRAY['marketplace', 'commerce', 'buy', 'sell', 'business', 'broker', 'legal'],
      'merges', ARRAY['marketplace', 'business_broker'],
      'version', '1.0',
      'keywords', ARRAY['buy', 'sell', 'product', 'shop', 'store', 'purchase', 'selling', 'buying', 'market', 'item', 'goods', 'trade', 'merchant', 'business', 'service', 'company', 'enterprise', 'startup', 'venture', 'broker', 'investment', 'partner', 'opportunity', 'pharmacy', 'medicine', 'drug', 'quincaillerie', 'hardware', 'grocery', 'order', 'legal', 'contract', 'lawyer', 'attorney']
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
-- 2. ADD BUY_AND_SELL PERSONA
-- =====================================================================

INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT
  id,
  'BAS-PERSONA',
  'Commerce & Business Concierge',
  'Friendly, professional, commerce-focused. Assists buyers, sellers, and entrepreneurs. Promotes local transactions and business opportunities.',
  ARRAY['en', 'fr', 'rw', 'sw'],
  jsonb_build_object(
    'greeting', 'Warm and welcoming',
    'focus', 'Quick transactions and business connections',
    'style', 'Practical and action-oriented',
    'expertise', ARRAY['commerce', 'local_business', 'negotiation', 'business_brokerage', 'product_knowledge']
  ),
  true
FROM public.ai_agents WHERE slug = 'buy_and_sell'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 3. ADD BUY_AND_SELL SYSTEM INSTRUCTIONS
-- =====================================================================

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
- Handle OTC pharmacy products; for RX items, request photo and escalate to pharmacist
- No medical advice, dosing, or contraindication information

BUSINESS DISCOVERY:
- Map user needs → business categories → specific nearby businesses
- Use maps_geocode for location-based search
- Return ranked list with reasons (open now, distance, rating)
- Only recommend businesses from the database; respect opening hours

BUSINESS BROKERAGE:
- For sellers: Collect business details, financials (sanitized), asking price, terms
- For buyers: Understand acquisition criteria, budget, industry preferences
- Match parties; facilitate introductions; schedule meetings
- Generate NDAs and LOIs via generate_pdf when parties proceed

LEGAL INTAKE (handoff required):
- Triage case category (business, contract, IP, employment, etc.)
- Collect facts: who/what/when/where and desired outcome
- Prepare scope summary; generate engagement letter PDF
- Take retainer via momo_charge; open case file
- All substantive matters require human associate review

GUARDRAILS:
- No medical advice beyond finding a pharmacy
- No legal, tax, or financial advice—only logistics and intake
- Protect user privacy and confidentiality
- Sensitive topics require handoff to staff

FLOW:
1) Identify intent: product search, business discovery, business sale/purchase, or legal intake
2) For products: search_supabase/inventory_check; present options; build basket
3) For business discovery: maps_geocode + search_businesses; present ranked options
4) For business transactions: collect details; match parties; generate documents
5) For all orders: momo_charge; confirm after settlement; track via order_status_update
6) Notify fulfillment (notify_staff); escalate sensitive topics immediately

Type "menu" to return to main services menu.',
  E'GUARDRAILS:
- Never share personal contact info without consent
- Verify listings are real before recommending
- Avoid scams - report suspicious activity
- Don''t facilitate illegal transactions
- Mask phone numbers in logs
- Respect privacy - only share necessary info
- Encourage safe meetup locations for transactions
- Don''t guarantee product quality or seller reliability
- Never provide legal, tax, or financial advice
- Protect confidentiality of business transactions',
  'context_window',
  true
FROM public.ai_agents WHERE slug = 'buy_and_sell'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 4. ADD BUY_AND_SELL TOOLS (Combined from marketplace + business_broker)
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
    -- Marketplace Tools
    (
      'search_products',
      'Search Products',
      'db',
      'Search for products in the marketplace across all categories',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'query', jsonb_build_object('type', 'string', 'description', 'Search query for products'),
          'category', jsonb_build_object('type', 'string', 'description', 'Product category filter (pharmacy, hardware, grocery)'),
          'price_max', jsonb_build_object('type', 'number'),
          'limit', jsonb_build_object('type', 'number', 'default', 10)
        ),
        'required', jsonb_build_array('query')
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'products', jsonb_build_object('type', 'array')
        )
      ),
      jsonb_build_object('table', 'products', 'limit', 10)
    ),
    (
      'inventory_check',
      'Check Inventory',
      'db',
      'Check inventory/stock levels for a specific product',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'product_id', jsonb_build_object('type', 'string', 'description', 'Product ID to check'),
          'store_id', jsonb_build_object('type', 'string', 'description', 'Optional store ID')
        ),
        'required', jsonb_build_array('product_id')
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'inventory', jsonb_build_object('type', 'array')
        )
      ),
      jsonb_build_object('table', 'inventory')
    ),
    (
      'create_listing',
      'Create Product Listing',
      'db',
      'Create a new product or business listing',
      jsonb_build_object(
        'type', 'object',
        'required', jsonb_build_array('title', 'category', 'listing_type'),
        'properties', jsonb_build_object(
          'title', jsonb_build_object('type', 'string'),
          'description', jsonb_build_object('type', 'string'),
          'price', jsonb_build_object('type', 'number'),
          'category', jsonb_build_object('type', 'string'),
          'listing_type', jsonb_build_object('type', 'string', 'enum', jsonb_build_array('product', 'service', 'business'))
        )
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'listing', jsonb_build_object('type', 'object'),
          'message', jsonb_build_object('type', 'string')
        )
      ),
      jsonb_build_object('table', 'unified_listings', 'operation', 'insert')
    ),
    (
      'order_create',
      'Create Order',
      'db',
      'Create a new order for products',
      jsonb_build_object(
        'type', 'object',
        'required', jsonb_build_array('items'),
        'properties', jsonb_build_object(
          'items', jsonb_build_object('type', 'array', 'description', 'Array of items with product_id and quantity'),
          'delivery_address', jsonb_build_object('type', 'string')
        )
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'order', jsonb_build_object('type', 'object'),
          'message', jsonb_build_object('type', 'string')
        )
      ),
      jsonb_build_object('table', 'orders', 'operation', 'insert')
    ),
    (
      'order_status_update',
      'Update Order Status',
      'db',
      'Update the status of an order',
      jsonb_build_object(
        'type', 'object',
        'required', jsonb_build_array('order_id', 'status'),
        'properties', jsonb_build_object(
          'order_id', jsonb_build_object('type', 'string'),
          'status', jsonb_build_object('type', 'string', 'enum', jsonb_build_array('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'))
        )
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'order', jsonb_build_object('type', 'object'),
          'message', jsonb_build_object('type', 'string')
        )
      ),
      jsonb_build_object('table', 'orders', 'operation', 'update')
    ),
    -- Business Discovery Tools (from BusinessBrokerAgent)
    (
      'search_businesses',
      'Search Businesses',
      'db',
      'Find businesses by location and category. Returns sorted list with distance.',
      jsonb_build_object(
        'type', 'object',
        'required', jsonb_build_array('category', 'lat', 'lng'),
        'properties', jsonb_build_object(
          'category', jsonb_build_object('type', 'string', 'description', 'Business category (e.g., pharmacy, restaurant, hardware)'),
          'lat', jsonb_build_object('type', 'number'),
          'lng', jsonb_build_object('type', 'number'),
          'radius_km', jsonb_build_object('type', 'number', 'default', 5),
          'limit', jsonb_build_object('type', 'number', 'default', 5)
        )
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'businesses', jsonb_build_object('type', 'array')
        )
      ),
      jsonb_build_object('rpc', 'search_businesses_nearby', 'location_search', true)
    ),
    (
      'maps_geocode',
      'Geocode Address',
      'api',
      'Convert address or place name to coordinates (lat/lng)',
      jsonb_build_object(
        'type', 'object',
        'required', jsonb_build_array('address'),
        'properties', jsonb_build_object(
          'address', jsonb_build_object('type', 'string')
        )
      ),
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'lat', jsonb_build_object('type', 'number'),
          'lng', jsonb_build_object('type', 'number'),
          'formatted_address', jsonb_build_object('type', 'string')
        )
      ),
      jsonb_build_object('api', 'serpapi', 'engine', 'google_maps')
    ),
    (
      'business_details',
      'Get Business Details',
      'db',
      'Fetch full details for a specific business by ID',
      jsonb_build_object(
        'type', 'object',
        'required', jsonb_build_array('business_id'),
        'properties', jsonb_build_object(
          'business_id', jsonb_build_object('type', 'string')
        )
      ),
      jsonb_build_object(
        'type', 'object'
      ),
      jsonb_build_object('table', 'business_directory')
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
    )
) AS tool(name, display_name, tool_type, description, input_schema, output_schema, config)
WHERE a.slug = 'buy_and_sell'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 5. ADD BUY_AND_SELL TASKS
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
      ARRAY['search_products', 'inventory_check'],
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
      ARRAY['search_businesses', 'maps_geocode', 'business_details'],
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
    ),
    (
      'BUSINESS_BROKERAGE',
      'Business Brokerage',
      'Facilitate business sales and acquisitions',
      'User wants to buy or sell a business',
      ARRAY['search_businesses', 'business_details'],
      'Business matching or intake information collected',
      true,
      jsonb_build_object('priority', 'high', 'avg_duration_seconds', 300)
    ),
    (
      'LEGAL_INTAKE',
      'Legal Intake',
      'Collect initial information for legal services',
      'User has legal question or needs contract help',
      ARRAY['business_details'],
      'Case summary for human review',
      true,
      jsonb_build_object('priority', 'medium', 'avg_duration_seconds', 180)
    )
) AS task(code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
WHERE a.slug = 'buy_and_sell'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 6. DEPRECATE MARKETPLACE AND BUSINESS_BROKER AGENTS
-- =====================================================================

-- Deprecate marketplace agent
UPDATE public.ai_agents
SET
  is_active = false,
  description = 'DEPRECATED: Merged into buy_and_sell agent. Use buy_and_sell instead.',
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'deprecated', true,
    'deprecated_at', now(),
    'replaced_by', 'buy_and_sell',
    'reason', 'Unified buy_and_sell agent now handles all marketplace functionality'
  ),
  updated_at = now()
WHERE slug = 'marketplace';

-- Deprecate business_broker agent
UPDATE public.ai_agents
SET
  is_active = false,
  description = 'DEPRECATED: Merged into buy_and_sell agent. Use buy_and_sell instead.',
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'deprecated', true,
    'deprecated_at', now(),
    'replaced_by', 'buy_and_sell',
    'reason', 'Unified buy_and_sell agent now handles all business broker functionality'
  ),
  updated_at = now()
WHERE slug IN ('business_broker', 'broker');

-- Deactivate tools for deprecated agents
UPDATE public.ai_agent_tools
SET is_active = false
WHERE agent_id IN (SELECT id FROM public.ai_agents WHERE slug IN ('marketplace', 'business_broker', 'broker'));

-- =====================================================================
-- 7. UPDATE HOME MENU TO USE BUY_AND_SELL
-- =====================================================================

-- Remove old menu items
DELETE FROM public.whatsapp_home_menu_items
WHERE key IN ('marketplace_agent', 'business_broker_agent', 'broker_agent');

-- Add buy_and_sell menu item
INSERT INTO public.whatsapp_home_menu_items (key, name, icon, description, is_active, display_order, created_at)
VALUES ('buy_and_sell_agent', 'Buy & Sell', '🛒', 'Buy and sell products, find businesses, business opportunities', true, 5, now())
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  is_active = true,
  display_order = EXCLUDED.display_order;

COMMIT;
