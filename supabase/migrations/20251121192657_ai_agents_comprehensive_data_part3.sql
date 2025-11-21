-- =====================================================================
-- AI AGENT ECOSYSTEM - COMPREHENSIVE DATA POPULATION PART 3
-- =====================================================================
-- Populates tasks and knowledge bases for all 6 agents
-- =====================================================================

BEGIN;

-- =====================================================================
-- TASKS - ALL AGENTS
-- =====================================================================

-- Waiter Tasks
INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'menu_qa',
  'Menu Q&A',
  'Answer questions about dishes, ingredients, dietary restrictions',
  'User asks about dishes, ingredients, diet options',
  ARRAY['search_menu_supabase', 'deepsearch']::text[],
  'Natural-language answer with 2-3 suggested options and prices',
  false,
  '{"complexity": "low", "avg_duration_seconds": 30}'::jsonb
FROM public.ai_agents WHERE slug = 'waiter';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'take_order',
  'Take Order',
  'Capture order, confirm items and quantities, send to kitchen',
  'User says "I want to order" or similar intent',
  ARRAY['search_menu_supabase', 'send_order', 'lookup_loyalty']::text[],
  'Structured order in DB + WhatsApp confirmation recapping items',
  false,
  '{"complexity": "medium", "avg_duration_seconds": 120}'::jsonb
FROM public.ai_agents WHERE slug = 'waiter';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'momo_payment',
  'Process MoMo Payment',
  'Initiate and confirm MoMo payment for order',
  'User confirms order and wants to pay',
  ARRAY['momo_charge', 'lookup_loyalty']::text[],
  'MoMo prompt triggered, payment status stored, loyalty points updated',
  false,
  '{"complexity": "medium", "avg_duration_seconds": 60, "escalate_on_failure": true}'::jsonb
FROM public.ai_agents WHERE slug = 'waiter';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'table_booking',
  'Table Booking',
  'Create restaurant table reservation',
  'User asks to book/reserve a table',
  ARRAY['book_table']::text[],
  'Reservation created + confirmation message with optional calendar .ics',
  true,
  '{"complexity": "low", "handoff_reason": "venue may require manual approval"}'::jsonb
FROM public.ai_agents WHERE slug = 'waiter';

-- Farmer Tasks
INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'create_produce_listing',
  'Create Produce Listing',
  'Help farmer create structured produce listing from description',
  'Farmer describes harvest via WhatsApp or voice',
  ARRAY['create_or_update_produce_listing', 'price_estimator']::text[],
  'Clean DB row + suggested price range + simple confirmation text',
  false,
  '{"complexity": "medium", "avg_duration_seconds": 180}'::jsonb
FROM public.ai_agents WHERE slug = 'farmer';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'match_to_buyers',
  'Match to Buyers',
  'Find and notify potential buyers for produce listing',
  'New or updated produce listing created',
  ARRAY['search_buyers', 'matchmaker_job']::text[],
  'Internal offers created; WhatsApp pings to potential buyers',
  false,
  '{"complexity": "medium", "coop_officer_review": "optional"}'::jsonb
FROM public.ai_agents WHERE slug = 'farmer';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'deal_confirmation',
  'Deal Confirmation',
  'Record confirmed transaction between farmer and buyer',
  'Farmer or buyer says "we agreed" or confirms deal',
  ARRAY['log_deal']::text[],
  'Deal stored; volumes updated; future price hints improved',
  false,
  '{"complexity": "low", "audit_suspicious": true}'::jsonb
FROM public.ai_agents WHERE slug = 'farmer';

-- Business Broker Tasks
INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'find_nearby_business',
  'Find Nearby Business',
  'Help user discover businesses based on need and location',
  'User says "I need pharmacy near..." or similar',
  ARRAY['maps_geocode', 'search_businesses', 'business_details']::text[],
  'List of 3-5 businesses with distance, open/closed, MoMo QR flags',
  false,
  '{"complexity": "low", "avg_duration_seconds": 45}'::jsonb
FROM public.ai_agents WHERE slug = 'business_broker';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'save_favourite',
  'Save Favourite Business',
  'Store business as user favorite for quick future access',
  'User says "save this" or "remember this place"',
  ARRAY[]::text[],
  'Business added to user favorites',
  false,
  '{"complexity": "trivial"}'::jsonb
FROM public.ai_agents WHERE slug = 'business_broker';

-- Real Estate Tasks
INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'capture_requirements',
  'Capture Rental Requirements',
  'Structured Q&A to understand user rental needs',
  'New chat with "I need a place" or rental intent',
  ARRAY['store_user_profile']::text[],
  'Structured JSON of requirements stored against user',
  false,
  '{"complexity": "medium", "avg_questions": 8}'::jsonb
FROM public.ai_agents WHERE slug = 'real_estate';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'deep_property_search',
  'Deep Property Search',
  'Search internal and external listings, rank candidates',
  'Requirements confirmed by user',
  ARRAY['search_listings', 'deep_listing_search', 'maps_geocode']::text[],
  'Candidate list (10-20) ranked internally',
  false,
  '{"complexity": "high", "avg_duration_seconds": 300}'::jsonb
FROM public.ai_agents WHERE slug = 'real_estate';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'owner_outreach',
  'Owner Outreach',
  'Contact property owners to verify availability and negotiate',
  'Candidate shortlist built',
  ARRAY['contact_owner_whatsapp', 'call_owner_voice']::text[],
  'Availabilities, updated prices, rules (pets, etc.) stored per listing',
  false,
  '{"complexity": "high", "escalate_tricky_negotiations": true}'::jsonb
FROM public.ai_agents WHERE slug = 'real_estate';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'shortlist_creation',
  'Shortlist Creation',
  'Generate top 5 property recommendations document',
  'Owner replies received or timeout reached',
  ARRAY['generate_shortlist_doc']::text[],
  'Top 5 options (message + optional PDF/image) shared with user',
  false,
  '{"complexity": "medium"}'::jsonb
FROM public.ai_agents WHERE slug = 'real_estate';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'viewings_coordination',
  'Coordinate Viewings',
  'Schedule property viewings with owners and user',
  'User picks properties from shortlist to view',
  ARRAY['contact_owner_whatsapp']::text[],
  'Confirmed viewing times + map pins',
  true,
  '{"complexity": "medium", "handoff_reason": "owner may prefer human coordination"}'::jsonb
FROM public.ai_agents WHERE slug = 'real_estate';

-- Jobs Tasks
INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'register_job_seeker',
  'Register Job Seeker',
  'Capture structured job seeker profile',
  'User says "I\'m looking for work" or similar',
  ARRAY['upsert_job_seeker']::text[],
  'Seeker profile stored; confirmation with summary & edit options',
  false,
  '{"complexity": "medium", "avg_questions": 6}'::jsonb
FROM public.ai_agents WHERE slug = 'jobs';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'register_job_post',
  'Register Job Post',
  'Capture structured job posting from employer',
  'User says "I need a driver for 2 days" or posts job',
  ARRAY['upsert_job_post']::text[],
  'Clean job record; status "pending candidates"',
  false,
  '{"complexity": "medium", "avg_questions": 7}'::jsonb
FROM public.ai_agents WHERE slug = 'jobs';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'matching_cycle',
  'Run Matching Cycle',
  'Match job seekers with job posts and vice versa',
  'New seeker/post created or daily cron trigger',
  ARRAY['match_jobs', 'notify_matches']::text[],
  'Ranked matches; WhatsApp notifications to both sides',
  false,
  '{"complexity": "high", "review_suspicious": true}'::jsonb
FROM public.ai_agents WHERE slug = 'jobs';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'daily_web_jobs_import',
  'Daily Web Jobs Import',
  'Nightly import of online job postings from boards',
  'Nightly cron at 2 AM',
  ARRAY['daily_deep_job_search']::text[],
  'Fresh online jobs into DB tagged by location/skills',
  false,
  '{"complexity": "high", "schedule": "0 2 * * *"}'::jsonb
FROM public.ai_agents WHERE slug = 'jobs';

-- Sales SDR Tasks
INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'lead_onboarding',
  'Lead Onboarding',
  'Import and enrich new leads from various sources',
  'CSV upload or manual entry by sales team',
  ARRAY['import_leads', 'enrich_lead']::text[],
  'Leads enriched and segmented (pharmacy, bar, farmer, etc.)',
  false,
  '{"complexity": "medium", "avg_duration_seconds": 120}'::jsonb
FROM public.ai_agents WHERE slug = 'sales_cold_caller';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'cold_call_sequence',
  'Cold Call Sequence',
  'Execute outbound calling campaign with script',
  'New lead in "to-contact" stage',
  ARRAY['call_lead_voice', 'crm_log_interaction']::text[],
  'Call attempt; transcript & outcome stored; stage updated',
  false,
  '{"complexity": "high", "max_attempts": 3, "handoff_on_request": true}'::jsonb
FROM public.ai_agents WHERE slug = 'sales_cold_caller';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'whatsapp_followup',
  'WhatsApp Follow-up',
  'Send WhatsApp template after call',
  'Call outcome is "interested" or "no answer"',
  ARRAY['send_whatsapp_template', 'crm_log_interaction']::text[],
  'WhatsApp template sent (info, link, CTA)',
  false,
  '{"complexity": "low", "rate_limit": 10}'::jsonb
FROM public.ai_agents WHERE slug = 'sales_cold_caller';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'demo_booking',
  'Demo Booking',
  'Schedule product demo or meeting',
  'Lead says "ok, show me" or expresses interest',
  ARRAY['book_calendar_slot', 'send_email', 'send_whatsapp_template', 'crm_log_interaction']::text[],
  'Calendar invite + confirmation message',
  true,
  '{"complexity": "medium", "handoff_reason": "assign human owner in CRM"}'::jsonb
FROM public.ai_agents WHERE slug = 'sales_cold_caller';

-- =====================================================================
-- KNOWLEDGE BASES - ALL AGENTS
-- =====================================================================

-- Waiter KBs
INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'restaurant_menus',
  'Restaurant Menus',
  'Menu items, prices, tags (vegan, halal, spicy), images, daily specials',
  'table',
  'tool:search_menu_supabase',
  'Admin dashboard edits; OCR import of PDF menus; WhatsApp admin commands (#soldout); nightly embeddings refresh',
  '{"table": "menu_items", "embedding_model": "text-embedding-3-small", "refresh_schedule": "0 0 * * *"}'::jsonb
FROM public.ai_agents WHERE slug = 'waiter';

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'cuisine_encyclopedia',
  'Cuisine Encyclopedia',
  'Global dishes, ingredients, allergens, pairing hints',
  'vector_store',
  'tool:deepsearch',
  'Periodic batch updates; deepsearch caching for new trends',
  '{"source": "curated_culinary_database", "update_frequency": "monthly"}'::jsonb
FROM public.ai_agents WHERE slug = 'waiter';

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'loyalty_program',
  'Loyalty Program Rules',
  'Tiers, points rules, benefits per venue',
  'table',
  'tool:lookup_loyalty',
  'Manual config by ops team via admin dashboard',
  '{"table": "loyalty_programs", "per_venue": true}'::jsonb
FROM public.ai_agents WHERE slug = 'waiter';

-- Farmer KBs
INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'produce_catalogue',
  'Produce Catalogue',
  'Crop types, quality grades, standard units (kg, sacks, crates), shelf-life',
  'table',
  'direct_db',
  'Curated by agri experts & co-ops; lightweight admin UI',
  '{"table": "produce_catalog", "embeddings_for_synonyms": true, "synonym_examples": {"matoke": "plantain"}}'::jsonb
FROM public.ai_agents WHERE slug = 'farmer';

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'market_prices',
  'Historical Market Prices',
  'Prices per crop, per region, per season',
  'table',
  'tool:price_estimator',
  'Aggregation jobs (daily/weekly) from log_deal + external price feeds',
  '{"table": "market_prices_analytics", "aggregation_schedule": "0 1 * * *"}'::jsonb
FROM public.ai_agents WHERE slug = 'farmer';

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'buyer_profiles',
  'Buyer Profiles',
  'Buyer types (shops, hotels, restaurants, households), typical volumes, preferred crops',
  'table',
  'tool:search_buyers',
  'Updated whenever buyers interact or confirm deals',
  '{"table": "buyers", "auto_update": true}'::jsonb
FROM public.ai_agents WHERE slug = 'farmer';

-- Business Broker KBs
INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'business_directory',
  'Business Directory',
  'All registered businesses: category, services, MoMo QR, location, hours',
  'table',
  'tool:search_businesses',
  'Initial bulk import + continuous onboarding via easyMO admin',
  '{"table": "business_directory", "vector_tags": true, "location_indexed": true}'::jsonb
FROM public.ai_agents WHERE slug = 'business_broker';

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'category_taxonomy',
  'Business Category Taxonomy',
  'Mapping between user intents ("fix my phone") and business types',
  'table',
  'direct_db',
  'Tuned over time from chat logs and user feedback',
  '{"table": "business_categories", "intent_embeddings": true}'::jsonb
FROM public.ai_agents WHERE slug = 'business_broker';

-- Real Estate KBs
INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'property_listings',
  'Internal Property Listings',
  'Attributes, owner contacts, status, images',
  'table',
  'tool:search_listings',
  'Partner APIs, manual entry, CSV imports; status synced via owner replies',
  '{"table": "property_listings", "vector_search": true, "sync_frequency": "realtime"}'::jsonb
FROM public.ai_agents WHERE slug = 'real_estate';

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'external_listing_cache',
  'External Listing Cache',
  'Normalized snapshots of Airbnb, Booking, etc.',
  'table',
  'tool:deep_listing_search',
  'TTL-based refresh (e.g., 7 days); avoid stale availabilities',
  '{"table": "external_listings_cache", "ttl_days": 7, "sources": ["airbnb", "booking"]}'::jsonb
FROM public.ai_agents WHERE slug = 'real_estate';

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'city_knowledge',
  'City & Area Knowledge',
  'Area descriptions, safety, amenities, typical rents',
  'vector_store',
  'direct_db',
  'Curated docs + web-derived summaries, updated quarterly',
  '{"source": "curated_city_guides", "update_frequency": "quarterly"}'::jsonb
FROM public.ai_agents WHERE slug = 'real_estate';

-- Jobs KBs
INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'job_seekers',
  'Job Seeker Profiles',
  'All structured seeker profiles + embeddings',
  'table',
  'tool:upsert_job_seeker + tool:match_jobs',
  'Updated per chat session; periodic skill inference from history',
  '{"table": "job_seekers", "embedding_model": "text-embedding-3-small"}'::jsonb
FROM public.ai_agents WHERE slug = 'jobs';

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'job_posts_internal',
  'Internal Job Posts',
  'All local/gig jobs posted in ecosystem',
  'table',
  'tool:upsert_job_post',
  'Updated on each post; expiry dates enforced',
  '{"table": "job_posts", "auto_expire": true, "default_ttl_days": 30}'::jsonb
FROM public.ai_agents WHERE slug = 'jobs';

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'job_posts_external',
  'External Job Posts',
  'Imported online jobs (filtered and normalized)',
  'table',
  'tool:daily_deep_job_search',
  'Nightly import; de-duplication; mark expired jobs',
  '{"table": "job_posts_external", "import_schedule": "0 2 * * *", "dedupe": true}'::jsonb
FROM public.ai_agents WHERE slug = 'jobs';

-- Sales SDR KBs
INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'lead_db',
  'Lead Database',
  'Lead info, segments, engagement history',
  'table',
  'tool:crm_log_interaction',
  'Updated on every call/WhatsApp/email interaction',
  '{"table": "crm_leads", "auto_update": true, "track_history": true}'::jsonb
FROM public.ai_agents WHERE slug = 'sales_cold_caller';

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'product_playbooks',
  'EasyMO Product Playbooks',
  'Product descriptions, pricing ranges, objections & answers, call/email scripts',
  'vector_store',
  'direct_db',
  'Maintained by sales/PM teams; versioned; agent uses latest',
  '{"source": "product_documentation", "versioned": true, "update_notification": true}'::jsonb
FROM public.ai_agents WHERE slug = 'sales_cold_caller';

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'market_segments',
  'Market Segment Definitions',
  'Segment definitions (pharmacy vs bar vs farmer, etc.), ICP profiles',
  'table',
  'direct_db',
  'Tuned as product evolves and new segments identified',
  '{"table": "market_segments", "include_icp": true}'::jsonb
FROM public.ai_agents WHERE slug = 'sales_cold_caller';

COMMIT;
