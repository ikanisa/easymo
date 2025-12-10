-- =====================================================================
-- QUICK WIN: AI Agent Tools - Top 10 Tools
-- =====================================================================
-- Registers the most commonly used tools across all agents
-- This enables database-driven tool activation/deactivation
-- Timeline: Part of Quick Wins (3 hours estimated)
-- =====================================================================

BEGIN;

-- Sales Agent Tools
INSERT INTO public.ai_agent_tools (
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
  -- Tool 1: Log Sales Interaction
  (
    (SELECT id FROM public.ai_agents WHERE slug = 'sales_cold_caller'),
    'log_sales_interaction',
    'Log Sales Interaction',
    'database_write',
    'Log sales interaction details including lead status, notes, and follow-up actions',
    '{
      "type": "object",
      "properties": {
        "business_id": {"type": "string", "description": "Business ID from directory"},
        "outcome": {"type": "string", "enum": ["interested", "not_interested", "callback", "demo_scheduled", "converted"], "description": "Result of interaction"},
        "notes": {"type": "string", "description": "Detailed notes about the conversation"},
        "follow_up_date": {"type": "string", "format": "date", "description": "When to follow up"},
        "priority": {"type": "string", "enum": ["low", "medium", "high"], "default": "medium"}
      },
      "required": ["outcome", "notes"]
    }'::jsonb,
    '{
      "type": "object",
      "properties": {
        "success": {"type": "boolean"},
        "interaction_id": {"type": "string"},
        "message": {"type": "string"}
      }
    }'::jsonb,
    '{
      "table": "business_directory",
      "log_table": "sales_interactions",
      "auto_schedule_followup": true
    }'::jsonb,
    true
  ),

  -- Tool 2: Lookup Business
  (
    (SELECT id FROM public.ai_agents WHERE slug = 'sales_cold_caller'),
    'lookup_business',
    'Lookup Business Information',
    'database_query',
    'Retrieve business details from the directory by ID, name, or phone number',
    '{
      "type": "object",
      "properties": {
        "business_id": {"type": "string"},
        "business_name": {"type": "string"},
        "phone_number": {"type": "string"}
      },
      "oneOf": [
        {"required": ["business_id"]},
        {"required": ["business_name"]},
        {"required": ["phone_number"]}
      ]
    }'::jsonb,
    '{
      "type": "object",
      "properties": {
        "id": {"type": "string"},
        "name": {"type": "string"},
        "category": {"type": "string"},
        "location": {"type": "string"},
        "contact_person": {"type": "string"},
        "phone_number": {"type": "string"}
      }
    }'::jsonb,
    '{
      "table": "business_directory",
      "cache_ttl": 3600
    }'::jsonb,
    true
  );

-- Business Broker Tools
INSERT INTO public.ai_agent_tools (
  agent_id,
  name,
  display_name,
  tool_type,
  description,
  input_schema,
  config,
  is_active
)
VALUES
  -- Tool 3: Search Vendors
  (
    (SELECT id FROM public.ai_agents WHERE slug = 'broker'),
    'search_vendors',
    'Search Business Directory',
    'database_query',
    'Search for vendors/service providers by category, location, or service type',
    '{
      "type": "object",
      "properties": {
        "category": {"type": "string", "description": "Service category (e.g., Plumbing, IT, Catering)"},
        "location": {"type": "string", "description": "City or area"},
        "service_type": {"type": "string", "description": "Specific service needed"},
        "limit": {"type": "integer", "default": 5, "minimum": 1, "maximum": 10}
      }
    }'::jsonb,
    '{
      "table": "business_directory",
      "max_results": 10,
      "order_by": "rating DESC, created_at DESC"
    }'::jsonb,
    true
  ),

  -- Tool 4: Create Service Request
  (
    (SELECT id FROM public.ai_agents WHERE slug = 'broker'),
    'create_service_request',
    'Create Service Request',
    'database_write',
    'Log a customer service request for follow-up and vendor matching',
    '{
      "type": "object",
      "properties": {
        "customer_phone": {"type": "string"},
        "service_needed": {"type": "string"},
        "description": {"type": "string"},
        "location": {"type": "string"},
        "urgency": {"type": "string", "enum": ["low", "medium", "high"], "default": "medium"},
        "budget_range": {"type": "string"}
      },
      "required": ["customer_phone", "service_needed", "description"]
    }'::jsonb,
    '{
      "table": "service_requests",
      "auto_notify_vendors": true
    }'::jsonb,
    true
  );

-- Waiter Agent Tools
INSERT INTO public.ai_agent_tools (
  agent_id,
  name,
  display_name,
  tool_type,
  description,
  input_schema,
  config,
  is_active
)
VALUES
  -- Tool 5: Search Bars/Restaurants
  (
    (SELECT id FROM public.ai_agents WHERE slug = 'waiter'),
    'search_bars',
    'Search Bars & Restaurants',
    'database_query',
    'Find bars and restaurants by location, name, or area',
    '{
      "type": "object",
      "properties": {
        "city_area": {"type": "string", "description": "City area or neighborhood"},
        "location": {"type": "string", "description": "General location query"},
        "name": {"type": "string", "description": "Bar/restaurant name"},
        "limit": {"type": "integer", "default": 5}
      }
    }'::jsonb,
    '{
      "table": "bars",
      "filters": ["is_active = true"],
      "max_results": 10
    }'::jsonb,
    true
  ),

  -- Tool 6: Place Order
  (
    (SELECT id FROM public.ai_agents WHERE slug = 'waiter'),
    'place_order',
    'Place Food/Drink Order',
    'database_write',
    'Create an order for the customer at a specific bar/restaurant',
    '{
      "type": "object",
      "properties": {
        "bar_id": {"type": "string"},
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": {"type": "string"},
              "qty": {"type": "integer", "minimum": 1},
              "price": {"type": "integer", "description": "Price in minor units"}
            }
          }
        },
        "total": {"type": "integer"},
        "customer_phone": {"type": "string"}
      },
      "required": ["bar_id", "items", "total"]
    }'::jsonb,
    '{
      "table": "orders",
      "items_table": "order_items",
      "generate_qr": true
    }'::jsonb,
    true
  );

-- Real Estate Agent Tools
INSERT INTO public.ai_agent_tools (
  agent_id,
  name,
  display_name,
  tool_type,
  description,
  input_schema,
  config,
  is_active
)
VALUES
  -- Tool 7: Search Properties
  (
    (SELECT id FROM public.ai_agents WHERE slug = 'real_estate'),
    'search_properties',
    'Search Properties',
    'database_query',
    'Search for rental properties by location, price range, bedrooms, etc.',
    '{
      "type": "object",
      "properties": {
        "location": {"type": "string"},
        "min_price": {"type": "integer"},
        "max_price": {"type": "integer"},
        "bedrooms": {"type": "integer"},
        "property_type": {"type": "string", "enum": ["apartment", "house", "studio", "villa"]},
        "limit": {"type": "integer", "default": 5}
      }
    }'::jsonb,
    '{
      "table": "properties",
      "use_location_search": true,
      "max_results": 10
    }'::jsonb,
    true
  );

-- Jobs Agent Tools
INSERT INTO public.ai_agent_tools (
  agent_id,
  name,
  display_name,
  tool_type,
  description,
  input_schema,
  config,
  is_active
)
VALUES
  -- Tool 8: Search Jobs
  (
    (SELECT id FROM public.ai_agents WHERE slug = 'jobs'),
    'search_jobs',
    'Search Job Listings',
    'database_query',
    'Find job openings by title, location, category, or salary range',
    '{
      "type": "object",
      "properties": {
        "title": {"type": "string"},
        "location": {"type": "string"},
        "category": {"type": "string"},
        "min_salary": {"type": "integer"},
        "employment_type": {"type": "string", "enum": ["full_time", "part_time", "contract", "internship"]},
        "limit": {"type": "integer", "default": 5}
      }
    }'::jsonb,
    '{
      "table": "job_listings",
      "filters": ["is_active = true"],
      "order_by": "created_at DESC"
    }'::jsonb,
    true
  ),

  -- Tool 9: Parse CV
  (
    (SELECT id FROM public.ai_agents WHERE slug = 'jobs'),
    'parse_cv',
    'Parse CV/Resume',
    'ai_processing',
    'Extract skills, experience, education from uploaded CV using OCR and AI',
    '{
      "type": "object",
      "properties": {
        "cv_url": {"type": "string", "format": "uri"},
        "cv_text": {"type": "string"}
      },
      "oneOf": [
        {"required": ["cv_url"]},
        {"required": ["cv_text"]}
      ]
    }'::jsonb,
    '{
      "use_ocr": true,
      "extract_fields": ["skills", "experience", "education", "contact"]
    }'::jsonb,
    true
  );

-- Farmer Agent Tools
INSERT INTO public.ai_agent_tools (
  agent_id,
  name,
  display_name,
  tool_type,
  description,
  input_schema,
  config,
  is_active
)
VALUES
  -- Tool 10: Search Produce
  (
    (SELECT id FROM public.ai_agents WHERE slug = 'farmer'),
    'search_produce',
    'Search Produce Listings',
    'database_query',
    'Find available produce by type, location, quantity, or price',
    '{
      "type": "object",
      "properties": {
        "produce_type": {"type": "string"},
        "location": {"type": "string"},
        "min_quantity": {"type": "number"},
        "max_price_per_unit": {"type": "integer"},
        "limit": {"type": "integer", "default": 5}
      }
    }'::jsonb,
    '{
      "table": "produce_listings",
      "filters": ["is_active = true", "quantity_available > 0"],
      "order_by": "created_at DESC"
    }'::jsonb,
    true
  );

-- Verify insertion
DO $$
DECLARE
  tool_count integer;
BEGIN
  SELECT COUNT(*) INTO tool_count FROM public.ai_agent_tools WHERE is_active = true;
  RAISE NOTICE 'Inserted % active agent tools', tool_count;
END $$;

COMMIT;

-- =====================================================================
-- VERIFICATION QUERY
-- =====================================================================
/*
SELECT 
  a.slug as agent,
  at.name as tool_name,
  at.display_name,
  at.tool_type,
  at.description,
  at.is_active
FROM ai_agents a
JOIN ai_agent_tools at ON at.agent_id = a.id
WHERE at.is_active = true
ORDER BY a.slug, at.name;
*/
