-- =====================================================================
-- ADD SEARCH_SUPPLIERS TOOL TO CALL CENTER AGI
-- =====================================================================
-- Adds the search_suppliers tool to the Call Center AGI agent
-- so it can intelligently recommend preferred suppliers with benefits
-- =====================================================================

BEGIN;

-- Add search_suppliers tool to ai_agent_tools table
INSERT INTO public.ai_agent_tools (
  id,
  slug,
  name,
  description,
  tool_type,
  input_schema,
  config,
  is_active
) VALUES (
  gen_random_uuid(),
  'search_suppliers',
  'Search Suppliers',
  'Search for preferred suppliers of goods/products. Returns TOP 5 suppliers prioritized by: 1) Partnership tier (Platinum > Gold > Silver > Standard), 2) Distance from user, 3) Benefits offered (discounts, free delivery). Use this when users want to buy goods like groceries, produce, pharmacy items, hardware, etc.',
  'db',
  jsonb_build_object(
    'type', 'object',
    'properties', jsonb_build_object(
      'product_query', jsonb_build_object(
        'type', 'string',
        'description', 'Product name to search for (e.g., "potatoes", "paracetamol", "cement")'
      ),
      'quantity', jsonb_build_object(
        'type', 'number',
        'description', 'Quantity needed (in the product''s standard unit)'
      ),
      'unit', jsonb_build_object(
        'type', 'string',
        'description', 'Unit of measurement (kg, pieces, liters, bags)'
      ),
      'user_lat', jsonb_build_object(
        'type', 'number',
        'description', 'User latitude for distance calculation (optional, will use profile location if not provided)'
      ),
      'user_lng', jsonb_build_object(
        'type', 'number',
        'description', 'User longitude for distance calculation (optional, will use profile location if not provided)'
      ),
      'max_radius_km', jsonb_build_object(
        'type', 'number',
        'description', 'Maximum search radius in km (default: 10)'
      ),
      'category', jsonb_build_object(
        'type', 'string',
        'description', 'Product category filter (grocery, pharmacy, hardware, farm_produce)'
      )
    ),
    'required', jsonb_build_array('product_query')
  ),
  jsonb_build_object(
    'rpc', 'search_preferred_suppliers',
    'table', 'preferred_suppliers',
    'priority_order', jsonb_build_array('partnership_tier', 'priority_score', 'distance')
  ),
  true
) ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  input_schema = EXCLUDED.input_schema,
  config = EXCLUDED.config,
  updated_at = now();

-- Link search_suppliers tool to Call Center AGI agent
INSERT INTO public.ai_agent_tool_links (
  agent_id,
  tool_id,
  is_enabled,
  priority
)
SELECT 
  a.id,
  t.id,
  true,
  40  -- Priority after other search tools
FROM public.ai_agents a
CROSS JOIN public.ai_agent_tools t
WHERE a.slug = 'easymo-callcenter-agi'
  AND t.slug = 'search_suppliers'
ON CONFLICT (agent_id, tool_id) DO UPDATE SET
  is_enabled = true,
  priority = 40,
  updated_at = now();

-- Also add to Buy & Sell agent
INSERT INTO public.ai_agent_tool_links (
  agent_id,
  tool_id,
  is_enabled,
  priority
)
SELECT 
  a.id,
  t.id,
  true,
  10  -- High priority for Buy & Sell agent
FROM public.ai_agents a
CROSS JOIN public.ai_agent_tools t
WHERE a.slug = 'buy_and_sell'
  AND t.slug = 'search_suppliers'
ON CONFLICT (agent_id, tool_id) DO UPDATE SET
  is_enabled = true,
  priority = 10,
  updated_at = now();

-- Update Call Center AGI system instructions to mention supplier search
UPDATE public.ai_agents
SET system_instructions = system_instructions || E'\n\nSUPPLIER SEARCH CAPABILITIES:
- When users ask to buy products (groceries, medicines, hardware, produce), use the search_suppliers tool
- This will return PREFERRED SUPPLIERS with special benefits:
  * EasyMO Partner discounts (usually 5-15% off)
  * Free delivery options (typically over 5,000 RWF orders)
  * Priority/faster service
  * Verified quality and reliability
  
SUPPLIER RECOMMENDATION FLOW:
1. Extract: product name, quantity, unit (e.g., "10kg of potatoes")
2. Call: search_suppliers with the product_query
3. Present results highlighting:
   - RECOMMENDED supplier (marked 🏆, usually has best benefits)
   - Price breakdown with discounts applied
   - Distance from user
   - Delivery availability and fees
   - Other options for comparison

Example response format:
"🏆 RECOMMENDED (EasyMO Partner):
Kigali Fresh Market - 2.3km away
✅ 10% discount for EasyMO users
✅ Free delivery over 5,000 RWF
💰 800 RWF/kg → 7,200 RWF for 10kg (with discount: 6,480 RWF)

Other options:
2. Kimironko Market - 3.1km - 8,500 RWF
3. Remera Grocers - 4.5km - 9,000 RWF

Would you like me to connect you with Kigali Fresh Market?"

Always prioritize preferred suppliers but show alternatives for transparency.'
WHERE slug = 'easymo-callcenter-agi';

COMMIT;
