-- =====================================================================
-- AI AGENT ECOSYSTEM - COMPREHENSIVE DATA POPULATION PART 2
-- =====================================================================
-- Populates tools, tasks, and knowledge bases for all 6 agents
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. WAITER AGENT TOOLS
-- =====================================================================

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config)
SELECT 
  id,
  'search_menu_supabase',
  'Menu Search',
  'db',
  'Search restaurant menu items with filters (vegan, spicy, etc.). Ground all menu answers.',
  '{"type": "object", "properties": {"restaurant_id": {"type": "string", "format": "uuid"}, "query": {"type": "string"}, "filters": {"type": "object", "properties": {"vegan": {"type": "boolean"}, "spicy": {"type": "boolean"}, "halal": {"type": "boolean"}, "gluten_free": {"type": "boolean"}}}}}'::jsonb,
  '{"type": "array", "items": {"type": "object", "properties": {"id": {"type": "string"}, "name": {"type": "string"}, "price": {"type": "number"}, "description": {"type": "string"}, "tags": {"type": "array"}, "availability": {"type": "boolean"}, "image_url": {"type": "string"}}}}'::jsonb,
  '{"table": "menu_items", "use_vector_search": true, "timeout_ms": 5000}'::jsonb
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'deepsearch',
  'Deep Search',
  'deep_search',
  'Web search for nutrition info, general cuisine info, reviews. Summarized back to model.',
  '{"type": "object", "properties": {"query": {"type": "string"}, "context": {"type": "string"}}}'::jsonb,
  '{"max_results": 5, "summarize": true}'::jsonb
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'momo_charge',
  'MoMo Payment',
  'momo',
  'Initiate MoMo payment for order',
  '{"type": "object", "required": ["phone", "amount", "order_id"], "properties": {"phone": {"type": "string"}, "amount": {"type": "number"}, "order_id": {"type": "string", "format": "uuid"}}}'::jsonb,
  '{"provider": "mtn_momo", "timeout_ms": 30000, "callback_url": "/api/momo/callback"}'::jsonb
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'send_order',
  'Send Order to Kitchen',
  'http',
  'Create kitchen ticket and update order status',
  '{"type": "object", "required": ["order_id", "items"], "properties": {"order_id": {"type": "string"}, "items": {"type": "array"}, "special_instructions": {"type": "string"}, "table_number": {"type": "string"}}}'::jsonb,
  '{"endpoint": "/api/kitchen/orders", "method": "POST", "notify_staff": true}'::jsonb
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'lookup_loyalty',
  'Check Loyalty Points',
  'db',
  'Check and update customer loyalty points and tier',
  '{"type": "object", "required": ["phone"], "properties": {"phone": {"type": "string"}}}'::jsonb,
  '{"table": "loyalty_programs", "cache_ttl": 300}'::jsonb
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'book_table',
  'Book Table',
  'db',
  'Create restaurant table reservation',
  '{"type": "object", "required": ["restaurant_id", "date", "time", "party_size"], "properties": {"restaurant_id": {"type": "string"}, "date": {"type": "string", "format": "date"}, "time": {"type": "string"}, "party_size": {"type": "number"}, "special_requests": {"type": "string"}}}'::jsonb,
  '{"table": "reservations", "send_confirmation": true}'::jsonb
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'sora_generate_video',
  'Generate Dish Video',
  'external',
  'Generate short promotional videos for dishes using Sora-2',
  '{"type": "object", "required": ["dish_name", "description"], "properties": {"dish_name": {"type": "string"}, "description": {"type": "string"}, "style": {"type": "string", "enum": ["appetizing", "elegant", "rustic"]}}}'::jsonb,
  '{"provider": "openai_sora", "duration_seconds": 10, "quality": "hd"}'::jsonb
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 2. FARMER AGENT TOOLS
-- =====================================================================

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'create_or_update_produce_listing',
  'Create/Update Produce Listing',
  'db',
  'Save structured produce listing with all details',
  '{"type": "object", "required": ["farmer_id", "crop", "quantity", "unit"], "properties": {"farmer_id": {"type": "string"}, "crop": {"type": "string"}, "quantity": {"type": "number"}, "unit": {"type": "string"}, "min_price": {"type": "number"}, "location": {"type": "string"}, "harvest_date": {"type": "string", "format": "date"}, "quality": {"type": "string"}, "photos": {"type": "array"}}}'::jsonb,
  '{"table": "produce_listings", "notify_buyers": true}'::jsonb
FROM public.ai_agents WHERE slug = 'farmer'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'search_buyers',
  'Search Buyers',
  'db',
  'Match farmers to buyers based on crop, location, volumes',
  '{"type": "object", "required": ["crop", "location"], "properties": {"crop": {"type": "string"}, "location": {"type": "string"}, "quantity": {"type": "number"}, "min_volume": {"type": "number"}}}'::jsonb,
  '{"table": "buyers", "use_vector_search": true, "max_results": 10}'::jsonb
FROM public.ai_agents WHERE slug = 'farmer'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'price_estimator',
  'Price Estimator',
  'http',
  'Suggest price ranges based on past deals and market data',
  '{"type": "object", "required": ["crop", "region"], "properties": {"crop": {"type": "string"}, "region": {"type": "string"}, "quality": {"type": "string"}, "season": {"type": "string"}}}'::jsonb,
  '{"endpoint": "/api/market-prices/estimate", "method": "POST", "disclaimer": "Estimate only, not guaranteed"}'::jsonb
FROM public.ai_agents WHERE slug = 'farmer'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'matchmaker_job',
  'Create Match Job',
  'http',
  'Create notification task to ping buyers for this crop',
  '{"type": "object", "required": ["listing_id"], "properties": {"listing_id": {"type": "string"}, "buyer_ids": {"type": "array"}}}'::jsonb,
  '{"endpoint": "/api/matching/notify-buyers", "method": "POST", "async": true}'::jsonb
FROM public.ai_agents WHERE slug = 'farmer'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'log_deal',
  'Log Deal',
  'db',
  'Record confirmed deal for analytics and future price hints',
  '{"type": "object", "required": ["buyer_id", "farmer_id", "crop", "quantity", "price"], "properties": {"buyer_id": {"type": "string"}, "farmer_id": {"type": "string"}, "crop": {"type": "string"}, "quantity": {"type": "number"}, "price": {"type": "number"}, "date": {"type": "string", "format": "date"}}}'::jsonb,
  '{"table": "deals", "update_analytics": true}'::jsonb
FROM public.ai_agents WHERE slug = 'farmer'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 3. BUSINESS BROKER AGENT TOOLS
-- =====================================================================

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'search_businesses',
  'Search Businesses',
  'db',
  'Search businesses by location, category, and tags with ranking',
  '{"type": "object", "required": ["user_location"], "properties": {"user_location": {"type": "object", "properties": {"lat": {"type": "number"}, "lon": {"type": "number"}}}, "category": {"type": "string"}, "tags": {"type": "array"}, "max_distance_km": {"type": "number"}}}'::jsonb,
  '{"table": "business_directory", "use_vector_search": true, "max_results": 5, "rank_by": ["distance", "rating", "open_now"]}'::jsonb
FROM public.ai_agents WHERE slug = 'business_broker'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'maps_geocode',
  'Geocode Address',
  'maps',
  'Convert area name to coordinates',
  '{"type": "object", "required": ["address"], "properties": {"address": {"type": "string"}}}'::jsonb,
  '{"provider": "google_maps", "api_key_env": "GOOGLE_MAPS_API_KEY"}'::jsonb
FROM public.ai_agents WHERE slug = 'business_broker'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'maps_reverse_geocode',
  'Reverse Geocode',
  'maps',
  'Convert coordinates to area name',
  '{"type": "object", "required": ["lat", "lon"], "properties": {"lat": {"type": "number"}, "lon": {"type": "number"}}}'::jsonb,
  '{"provider": "google_maps", "api_key_env": "GOOGLE_MAPS_API_KEY"}'::jsonb
FROM public.ai_agents WHERE slug = 'business_broker'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'business_details',
  'Get Business Details',
  'db',
  'Fetch full business profile including MoMo QR and easyMO status',
  '{"type": "object", "required": ["business_id"], "properties": {"business_id": {"type": "string", "format": "uuid"}}}'::jsonb,
  '{"table": "business_directory", "include_hours": true, "include_reviews": true}'::jsonb
FROM public.ai_agents WHERE slug = 'business_broker'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 4. REAL ESTATE AGENT TOOLS
-- =====================================================================

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'search_listings',
  'Search Internal Listings',
  'db',
  'Query internal property listings with filters',
  '{"type": "object", "properties": {"price_min": {"type": "number"}, "price_max": {"type": "number"}, "area": {"type": "string"}, "dates": {"type": "object"}, "beds": {"type": "number"}, "amenities": {"type": "array"}}}'::jsonb,
  '{"table": "property_listings", "use_vector_search": true, "max_results": 20}'::jsonb
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'deep_listing_search',
  'Deep Web Search',
  'deep_search',
  'Scrape external platforms (Airbnb, Booking, local portals) and normalize results',
  '{"type": "object", "properties": {"location": {"type": "string"}, "check_in": {"type": "string"}, "check_out": {"type": "string"}, "guests": {"type": "number"}, "price_max": {"type": "number"}}}'::jsonb,
  '{"sources": ["airbnb", "booking", "local_portals"], "normalize": true, "remove_branding": true, "max_results": 50}'::jsonb
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'contact_owner_whatsapp',
  'Contact Owner via WhatsApp',
  'whatsapp',
  'Send templated intro and manage conversation with property owner',
  '{"type": "object", "required": ["owner_phone", "property_id", "message"], "properties": {"owner_phone": {"type": "string"}, "property_id": {"type": "string"}, "message": {"type": "string"}, "template_id": {"type": "string"}}}'::jsonb,
  '{"use_templates": true, "track_session": true}'::jsonb
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'call_owner_voice',
  'Call Owner via Voice',
  'sip',
  'Place voice call to owner, stream to LLM for real-time conversation',
  '{"type": "object", "required": ["owner_phone", "property_id"], "properties": {"owner_phone": {"type": "string"}, "property_id": {"type": "string"}, "script_type": {"type": "string"}}}'::jsonb,
  '{"sip_trunk": "twilio", "use_realtime_api": true, "record": true}'::jsonb
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'generate_shortlist_doc',
  'Generate Shortlist Document',
  'external',
  'Build 5-property mini brochure PDF/image to send via WhatsApp',
  '{"type": "object", "required": ["property_ids"], "properties": {"property_ids": {"type": "array", "maxItems": 5}, "user_id": {"type": "string"}, "format": {"type": "string", "enum": ["pdf", "image"]}}}'::jsonb,
  '{"template": "property_shortlist_v2", "include_map": true, "include_pros_cons": true}'::jsonb
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'store_user_profile',
  'Store User Profile',
  'db',
  'Save renter profile and preferences',
  '{"type": "object", "required": ["user_id", "preferences"], "properties": {"user_id": {"type": "string"}, "preferences": {"type": "object"}, "search_history": {"type": "array"}}}'::jsonb,
  '{"table": "renter_profiles", "use_embeddings": true}'::jsonb
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 5. JOBS AGENT TOOLS
-- =====================================================================

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'upsert_job_seeker',
  'Create/Update Job Seeker',
  'db',
  'Store structured job seeker profile with skills and preferences',
  '{"type": "object", "required": ["user_id", "skills"], "properties": {"user_id": {"type": "string"}, "skills": {"type": "array"}, "experience_years": {"type": "number"}, "availability": {"type": "string"}, "expected_pay": {"type": "number"}, "location": {"type": "string"}, "languages": {"type": "array"}}}'::jsonb,
  '{"table": "job_seekers", "create_embeddings": true, "update_match_pool": true}'::jsonb
FROM public.ai_agents WHERE slug = 'jobs'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'upsert_job_post',
  'Create/Update Job Post',
  'db',
  'Store structured job posting with requirements',
  '{"type": "object", "required": ["poster_id", "title", "type"], "properties": {"poster_id": {"type": "string"}, "title": {"type": "string"}, "type": {"type": "string", "enum": ["gig", "short_term", "long_term"]}, "duration": {"type": "string"}, "pay": {"type": "number"}, "location": {"type": "string"}, "requirements": {"type": "object"}}}'::jsonb,
  '{"table": "job_posts", "create_embeddings": true, "trigger_matching": true}'::jsonb
FROM public.ai_agents WHERE slug = 'jobs'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'match_jobs',
  'Match Jobs & Seekers',
  'db',
  'Two-way matching using embeddings and filters',
  '{"type": "object", "properties": {"job_id": {"type": "string"}, "seeker_id": {"type": "string"}, "match_type": {"type": "string", "enum": ["job_to_seekers", "seeker_to_jobs", "full"]}}}'::jsonb,
  '{"use_embeddings": true, "use_filters": true, "min_score": 0.6, "max_results": 20}'::jsonb
FROM public.ai_agents WHERE slug = 'jobs'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'daily_deep_job_search',
  'Daily Web Job Search',
  'deep_search',
  'Scheduled scraping of online job boards, normalize and store',
  '{"type": "object", "properties": {"regions": {"type": "array"}, "categories": {"type": "array"}, "max_age_days": {"type": "number"}}}'::jsonb,
  '{"sources": ["indeed", "linkedin", "local_boards"], "dedupe": true, "schedule": "0 2 * * *", "tag_external": true}'::jsonb
FROM public.ai_agents WHERE slug = 'jobs'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'notify_matches',
  'Notify Matches',
  'whatsapp',
  'Send WhatsApp notifications for new job matches',
  '{"type": "object", "required": ["recipients", "match_type"], "properties": {"recipients": {"type": "array"}, "match_type": {"type": "string", "enum": ["new_job", "new_candidate"]}, "details": {"type": "object"}}}'::jsonb,
  '{"use_templates": true, "rate_limit": 10, "include_unsubscribe": true}'::jsonb
FROM public.ai_agents WHERE slug = 'jobs'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 6. SALES SDR AGENT TOOLS
-- =====================================================================

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'import_leads',
  'Import Leads',
  'http',
  'Ingest leads from CSV, CRM, or web forms',
  '{"type": "object", "required": ["source"], "properties": {"source": {"type": "string", "enum": ["csv", "crm_api", "web_form"]}, "data": {"type": "array"}, "segment": {"type": "string"}}}'::jsonb,
  '{"endpoint": "/api/crm/leads/import", "method": "POST", "dedupe": true}'::jsonb
FROM public.ai_agents WHERE slug = 'sales_cold_caller'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'enrich_lead',
  'Enrich Lead Data',
  'external',
  'Company lookup, website scan, guess business size and category',
  '{"type": "object", "required": ["company_name"], "properties": {"company_name": {"type": "string"}, "website": {"type": "string"}, "phone": {"type": "string"}}}'::jsonb,
  '{"providers": ["clearbit", "web_scraper"], "guess_segment": true, "find_socials": true}'::jsonb
FROM public.ai_agents WHERE slug = 'sales_cold_caller'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'call_lead_voice',
  'Call Lead',
  'sip',
  'Place outbound call, run script, log responses in real-time',
  '{"type": "object", "required": ["lead_id", "phone"], "properties": {"lead_id": {"type": "string"}, "phone": {"type": "string"}, "script_id": {"type": "string"}, "attempt_number": {"type": "number"}}}'::jsonb,
  '{"sip_trunk": "twilio", "use_realtime_api": true, "record": true, "max_duration": 600}'::jsonb
FROM public.ai_agents WHERE slug = 'sales_cold_caller'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'send_whatsapp_template',
  'Send WhatsApp Template',
  'whatsapp',
  'Send approved WhatsApp Business templates for cold outreach',
  '{"type": "object", "required": ["phone", "template_id"], "properties": {"phone": {"type": "string"}, "template_id": {"type": "string"}, "parameters": {"type": "array"}}}'::jsonb,
  '{"use_business_api": true, "track_delivery": true, "respect_dnc": true}'::jsonb
FROM public.ai_agents WHERE slug = 'sales_cold_caller'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'send_email',
  'Send Follow-up Email',
  'http',
  'Send follow-up email with pitch deck and links',
  '{"type": "object", "required": ["to", "subject", "template_id"], "properties": {"to": {"type": "string"}, "subject": {"type": "string"}, "template_id": {"type": "string"}, "attachments": {"type": "array"}}}'::jsonb,
  '{"provider": "sendgrid", "track_opens": true, "track_clicks": true}'::jsonb
FROM public.ai_agents WHERE slug = 'sales_cold_caller'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'crm_log_interaction',
  'Log CRM Interaction',
  'db',
  'Log all calls, chats, emails, outcomes, and next steps',
  '{"type": "object", "required": ["lead_id", "interaction_type", "outcome"], "properties": {"lead_id": {"type": "string"}, "interaction_type": {"type": "string", "enum": ["call", "whatsapp", "email"]}, "outcome": {"type": "string"}, "notes": {"type": "string"}, "next_action": {"type": "string"}, "next_date": {"type": "string"}}}'::jsonb,
  '{"table": "crm_interactions", "update_lead_stage": true, "create_reminders": true}'::jsonb
FROM public.ai_agents WHERE slug = 'sales_cold_caller'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'book_calendar_slot',
  'Book Calendar Slot',
  'external',
  'Create demo/meeting events across time zones',
  '{"type": "object", "required": ["lead_id", "datetime", "duration"], "properties": {"lead_id": {"type": "string"}, "datetime": {"type": "string", "format": "date-time"}, "duration": {"type": "number"}, "timezone": {"type": "string"}, "meeting_type": {"type": "string"}}}'::jsonb,
  '{"provider": "calendly", "send_invites": true, "add_zoom_link": true}'::jsonb
FROM public.ai_agents WHERE slug = 'sales_cold_caller'
ON CONFLICT DO NOTHING;

COMMIT;
