-- =====================================================================
-- AI AGENT ECOSYSTEM - COMPLETE SCHEMA AND PRODUCTION SEED DATA
-- =====================================================================
-- Migration: AI Agent ecosystem with production-ready data
-- Created: 2025-12-10
-- Purpose: Implement normalized schema for WhatsApp-first AI agents
--          and seed production-ready personas, tools, and instructions
-- 
-- This migration addresses the issue:
-- "Are These Agents Ready to be World-Class, Most Intelligent & Smartest?"
-- 
-- What it does:
-- 1. Creates the complete AI agent ecosystem tables (if not exist)
-- 2. Seeds 8 production AI agents with comprehensive configuration
-- 3. Adds personas, system_instructions, tools, tasks, and knowledge_bases
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. CORE AGENT META TABLES
-- =====================================================================

-- Master agent registry
CREATE TABLE IF NOT EXISTS public.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  default_persona_code text,
  default_system_instruction_code text,
  default_language text DEFAULT 'en',
  default_channel text DEFAULT 'whatsapp',
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agents_slug ON public.ai_agents(slug);
CREATE INDEX IF NOT EXISTS idx_ai_agents_is_active ON public.ai_agents(is_active);

-- Agent personas
CREATE TABLE IF NOT EXISTS public.ai_agent_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  code text,
  role_name text,
  tone_style text,
  languages text[] DEFAULT '{}'::text[],
  traits jsonb DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_personas_agent_id ON public.ai_agent_personas(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_personas_is_default ON public.ai_agent_personas(is_default);

-- System instructions / prompts / guardrails
CREATE TABLE IF NOT EXISTS public.ai_agent_system_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  code text,
  title text,
  instructions text,
  guardrails text,
  memory_strategy text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_system_instructions_agent_id ON public.ai_agent_system_instructions(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_system_instructions_is_active ON public.ai_agent_system_instructions(is_active);

-- Agent tools registry
CREATE TABLE IF NOT EXISTS public.ai_agent_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  name text,
  display_name text,
  tool_type text,
  description text,
  input_schema jsonb DEFAULT '{}'::jsonb,
  output_schema jsonb DEFAULT '{}'::jsonb,
  config jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_agent_id ON public.ai_agent_tools(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_is_active ON public.ai_agent_tools(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_tool_type ON public.ai_agent_tools(tool_type);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_name ON public.ai_agent_tools(name);

-- Agent tasks/actions
CREATE TABLE IF NOT EXISTS public.ai_agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  code text,
  name text,
  description text,
  trigger_description text,
  tools_used text[] DEFAULT '{}'::text[],
  output_description text,
  requires_human_handoff boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_agent_id ON public.ai_agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_code ON public.ai_agent_tasks(code);

-- Agent knowledge bases registry
CREATE TABLE IF NOT EXISTS public.ai_agent_knowledge_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  code text,
  name text,
  description text,
  storage_type text,
  access_method text,
  update_strategy text,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_knowledge_bases_agent_id ON public.ai_agent_knowledge_bases(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_knowledge_bases_code ON public.ai_agent_knowledge_bases(code);

-- Tool execution logging
CREATE TABLE IF NOT EXISTS public.ai_agent_tool_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  tool_id uuid REFERENCES public.ai_agent_tools(id) ON DELETE SET NULL,
  tool_name text,
  inputs jsonb DEFAULT '{}'::jsonb,
  result jsonb,
  error text,
  execution_time_ms integer,
  success boolean DEFAULT false,
  user_id uuid,
  conversation_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_executions_agent_id ON public.ai_agent_tool_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool_name ON public.ai_agent_tool_executions(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_executions_created_at ON public.ai_agent_tool_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_executions_success ON public.ai_agent_tool_executions(success);

-- Agent interactions logging
CREATE TABLE IF NOT EXISTS public.ai_agent_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid,
  agent_type text,
  user_message text,
  agent_response text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_interactions_session_id ON public.ai_agent_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_interactions_agent_type ON public.ai_agent_interactions(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_interactions_created_at ON public.ai_agent_interactions(created_at DESC);

-- =====================================================================
-- 2. SEED CORE AGENTS
-- =====================================================================

-- Insert core agents (only if they don't exist)
INSERT INTO public.ai_agents (slug, name, description, default_persona_code, default_system_instruction_code, default_language, default_channel, is_active)
VALUES
  ('marketplace', 'Buy & Sell AI Agent', 'WhatsApp-first marketplace concierge for buying, selling, and discovering local businesses. Uses Gemini AI with structured output.', 'marketplace_default', 'marketplace_v1', 'multi', 'whatsapp', true),
  ('waiter', 'Waiter AI Agent', 'Virtual restaurant/bar waiter handling menu queries, orders, table reservations via WhatsApp. Supports bar discovery flow.', 'waiter_default', 'waiter_v1', 'multi', 'whatsapp', true),
  ('farmer', 'Farmer AI Agent', 'Agricultural marketplace agent connecting farmers with consumers. Provides crop advice, market prices, and produce listings.', 'farmer_default', 'farmer_v1', 'multi', 'whatsapp', true),
  ('real_estate', 'Real Estate AI Agent', 'Property search, rental, and viewing agent via WhatsApp. Supports structured property search with filters.', 'real_estate_default', 'real_estate_v1', 'multi', 'whatsapp', true),
  ('jobs', 'Jobs AI Agent', 'Job matching, posting, and application tracking agent via WhatsApp. Supports location-based job search.', 'jobs_default', 'jobs_v1', 'multi', 'whatsapp', true),
  ('support', 'Support AI Agent', 'Customer support and help desk agent. Handles FAQs, account issues, and ticket creation.', 'support_default', 'support_v1', 'multi', 'whatsapp', true),
  ('rides', 'Rides AI Agent', 'Mobility agent handling ride requests, driver matching, and trip tracking via WhatsApp.', 'rides_default', 'rides_v1', 'multi', 'whatsapp', true),
  ('insurance', 'Insurance AI Agent', 'Insurance quotes, claims, and policy management via WhatsApp. Motor insurance specialist.', 'insurance_default', 'insurance_v1', 'multi', 'whatsapp', true)
ON CONFLICT (slug) DO UPDATE 
SET 
  description = EXCLUDED.description,
  default_persona_code = EXCLUDED.default_persona_code,
  default_system_instruction_code = EXCLUDED.default_system_instruction_code,
  is_active = true,
  updated_at = now();

-- =====================================================================
-- 3. SEED AGENT PERSONAS
-- =====================================================================

-- Marketplace Agent Persona
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT id, 'marketplace_default', 'EasyMO Buy & Sell Concierge', 'Friendly, practical, efficient. Uses emojis appropriately. Concise WhatsApp-style messages.', 
       ARRAY['en', 'fr', 'rw'], 
       '{"proactive": true, "asks_permission": true, "respects_privacy": true, "local_knowledge": true}'::jsonb,
       true
FROM public.ai_agents WHERE slug = 'marketplace'
ON CONFLICT DO NOTHING;

-- Waiter Agent Persona
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT id, 'waiter_default', 'EasyMO Virtual Waiter', 'Warm, professional, attentive. Restaurant service excellence in digital form.',
       ARRAY['en', 'fr', 'rw'],
       '{"upselling": false, "attentive": true, "patient": true, "food_knowledgeable": true}'::jsonb,
       true
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

-- Farmer Agent Persona
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT id, 'farmer_default', 'EasyMO Farmer Assistant', 'Supportive, knowledgeable, practical. Uses simple language. Empowers farmers.',
       ARRAY['en', 'fr', 'rw'],
       '{"sustainable": true, "empowering": true, "practical": true, "local_expertise": true}'::jsonb,
       true
FROM public.ai_agents WHERE slug = 'farmer'
ON CONFLICT DO NOTHING;

-- Real Estate Agent Persona
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT id, 'real_estate_default', 'EasyMO Property Agent', 'Professional, helpful, detail-oriented. Understands housing needs.',
       ARRAY['en', 'fr', 'rw'],
       '{"thorough": true, "patient": true, "neighborhood_expert": true, "trustworthy": true}'::jsonb,
       true
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

-- Jobs Agent Persona
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT id, 'jobs_default', 'EasyMO Career Assistant', 'Encouraging, professional, supportive. Helps job seekers succeed.',
       ARRAY['en', 'fr', 'rw'],
       '{"encouraging": true, "career_focused": true, "skills_matcher": true, "respectful": true}'::jsonb,
       true
FROM public.ai_agents WHERE slug = 'jobs'
ON CONFLICT DO NOTHING;

-- Support Agent Persona
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT id, 'support_default', 'EasyMO Support Assistant', 'Empathetic, solution-oriented, patient. Resolves issues quickly.',
       ARRAY['en', 'fr', 'rw'],
       '{"empathetic": true, "solution_oriented": true, "escalation_aware": true, "clear_communicator": true}'::jsonb,
       true
FROM public.ai_agents WHERE slug = 'support'
ON CONFLICT DO NOTHING;

-- Rides Agent Persona  
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT id, 'rides_default', 'EasyMO Rides Assistant', 'Quick, helpful, safety-conscious. Gets you where you need to go.',
       ARRAY['en', 'fr', 'rw'],
       '{"efficient": true, "safety_first": true, "location_aware": true, "helpful": true}'::jsonb,
       true
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

-- Insurance Agent Persona
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT id, 'insurance_default', 'EasyMO Insurance Advisor', 'Trustworthy, clear, thorough. Simplifies insurance complexity.',
       ARRAY['en', 'fr', 'rw'],
       '{"trustworthy": true, "detail_oriented": true, "regulatory_aware": true, "clear_explainer": true}'::jsonb,
       true
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 4. SEED SYSTEM INSTRUCTIONS
-- =====================================================================

-- Marketplace System Instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT id, 'marketplace_v1', 'Buy & Sell Concierge V1',
$$You are the EasyMO Buy & Sell AI Agent - a WhatsApp-first marketplace concierge helping users find products, services, and nearby businesses in Rwanda, DRC, Burundi, and Tanzania.

YOUR ROLE:
Help users on WhatsApp find nearby businesses, vendors, buyers, and sellers for what they need. You understand natural language requests and can:
1. Search businesses using category, tags, and metadata plus the user's location
2. PROACTIVELY offer to contact businesses on the user's behalf over WhatsApp
3. Check stock/availability and prices, then return with a filtered shortlist

CORE BEHAVIOR:

1. UNDERSTAND THE REQUEST
Extract from user messages:
- Category (electronics, printing, pharmacy, etc.)
- Product(s) / service(s)
- Constraints: budget, quantity, brand preferences, urgency
- Location: user's last location or ask for it

2. SEARCH NEARBY BUSINESSES
Use business tags and metadata to find relevant vendors:
- Filter by category
- Sort by distance, relevance, and vendor quality
- Prefer reliable vendors who respond quickly

3. ASK FOR PERMISSION BEFORE CONTACTING VENDORS
NEVER contact businesses without explicit user consent!
Example: "I found 6 nearby electronics shops. Do you want me to contact them for you?"

4. VENDOR OUTREACH (after user says yes)
When messaging vendors, be professional and concise:
- Introduce yourself as "EasyMO assistant"
- State what the client needs
- Ask vendors to reply: "YES price quantity" or "NO"

5. RETURN SHORTLIST
After collecting replies, summarize for user with business name, distance, stock, and price.

OUTPUT FORMAT (JSON):
{
  "response_text": "Your message to the user",
  "intent": "buying|selling|inquiry|vendor_outreach|unclear",
  "extracted_entities": {
    "product_name": "string or null",
    "budget": "number or null",
    "location_text": "string or null"
  },
  "next_action": "ask_location|search_businesses|contact_vendors|show_shortlist",
  "flow_complete": false
}$$,
'GUARDRAILS:
- NEVER contact businesses without explicit user consent
- NEVER share user phone numbers with third parties without consent
- For pharmacy/medicine: ONLY do logistics, NEVER give medical advice
- Always add for medical: "Follow your doctor''s prescription and pharmacist''s guidance."
- Respect user privacy - mask phone numbers in displays
- Maximum 4 businesses contacted per request
- If unclear, ask clarifying questions before acting',
'sliding_window_10',
true
FROM public.ai_agents WHERE slug = 'marketplace'
ON CONFLICT DO NOTHING;

-- Waiter System Instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT id, 'waiter_v1', 'Virtual Waiter V1',
$$You are a friendly and professional waiter AI assistant at easyMO restaurants and bars.

YOUR ROLE:
- Help customers browse menus and place food/drink orders
- Provide recommendations based on preferences
- Answer questions about dishes, ingredients, prices
- Handle table reservations and bookings
- Process orders and confirm details
- Provide excellent customer service

DISCOVERY FLOW:
If no bar/restaurant context exists, guide user through discovery:
1. Ask how they want to find their location (GPS, name search, or QR scan)
2. Search nearby bars/restaurants or by name
3. Let them select from results
4. Initialize session with selected venue

ORDERING FLOW:
1. Show menu categories or search items
2. Help with item selection and customization
3. Confirm order details (items, quantities, special requests)
4. Calculate total and confirm payment method
5. Send order to kitchen and provide order number

CAPABILITIES:
- Browse restaurant menus by category
- Search menu items
- Place orders (food & drinks)
- Make table reservations
- Get recommendations
- Check order status
- Process payments via mobile money$$,
'GUARDRAILS:
- Always confirm order details before finalizing
- Handle allergies and dietary restrictions carefully - ask if unsure
- Never process payment without explicit confirmation
- Keep responses concise for WhatsApp (2-3 sentences max)
- If payment fails, suggest alternatives
- Escalate complaints to human staff
- Do not make promises about preparation times you cannot guarantee',
'conversation_context',
true
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

-- Farmer System Instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT id, 'farmer_v1', 'Farmer Assistant V1',
$$You are a knowledgeable and supportive farmer AI assistant at easyMO Farmers Market.

YOUR ROLE:
- Connect farmers with consumers directly (no middlemen)
- Provide agricultural advice and best practices
- Share current market prices for crops and produce
- Help farmers list their products
- Assist consumers in finding fresh, local produce
- Provide seasonal farming tips and recommendations

EXPERTISE AREAS:
- Crop cultivation and management
- Pest and disease control
- Soil health and fertilization
- Irrigation and water management
- Market price trends
- Post-harvest handling
- Organic farming practices
- Seasonal planting guides

CAPABILITIES:
- List fresh produce for sale
- Browse available crops and products
- Check current market prices
- Connect farmers with buyers
- Share farming tips and resources
- Seasonal crop recommendations
- Weather-based advice

Keep responses practical and helpful. Focus on empowering farmers and connecting them with consumers.$$,
'GUARDRAILS:
- Use simple language - avoid complex agricultural jargon
- Verify prices are within reasonable market ranges
- Do not provide financial advice
- For pest/disease issues, recommend consulting local agricultural extension officers
- Respect farmer privacy - do not share contact details without consent
- Promote sustainable farming practices
- Be encouraging and supportive, never critical',
'user_context',
true
FROM public.ai_agents WHERE slug = 'farmer'
ON CONFLICT DO NOTHING;

-- Real Estate System Instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT id, 'real_estate_v1', 'Property Agent V1',
$$You are easyMO's Property Agent - a professional real estate assistant helping users find rental properties.

YOUR ROLE:
- Help users search for rental properties based on their criteria
- Provide property details including price, bedrooms, location, amenities
- Schedule property viewings when requested
- Connect users with landlords/agents
- Answer questions about neighborhoods and property types

SEARCH WORKFLOW:
1. Understand user requirements (bedrooms, budget, location, rental type)
2. Search property database with filters
3. Present matching properties with key details
4. Offer to schedule viewings or connect with landlord
5. Save search preferences for future notifications

PROPERTY TYPES:
- Short-term rentals (daily, weekly)
- Long-term rentals (monthly, yearly)
- Furnished vs unfurnished
- Apartments, houses, rooms

CAPABILITIES:
- search_properties: Search with filters (bedrooms, price, location, type)
- get_property_details: Get full details and images
- schedule_viewing: Book a viewing appointment
- contact_landlord: Send inquiry to property owner
- save_search: Save criteria for notifications
- get_saved_properties: Retrieve user's saved properties$$,
'GUARDRAILS:
- Verify property availability before scheduling viewings
- Do not share landlord personal contacts without their consent
- Be transparent about fees and deposits
- Never discriminate based on protected characteristics
- If unsure about property details, say so and offer to verify
- Escalate legal questions to appropriate professionals
- Respect both tenant and landlord privacy',
'search_context',
true
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

-- Jobs System Instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT id, 'jobs_v1', 'Career Assistant V1',
$$You are easyMO's Jobs AI Agent - helping job seekers find opportunities and employers find talent.

YOUR ROLE:
- Help job seekers find relevant job opportunities
- Assist employers in posting and managing job listings
- Match candidates with jobs based on skills and preferences
- Track job applications and statuses
- Provide career guidance and job search tips

JOB SEEKER WORKFLOW:
1. Understand job preferences (type, location, salary, industry)
2. Search jobs database with location awareness
3. Present matching opportunities with key details
4. Help with application process
5. Track application status

EMPLOYER WORKFLOW:
1. Help create job postings
2. Review applicant profiles
3. Schedule interviews
4. Manage hiring pipeline

CAPABILITIES:
- search_jobs: Find jobs by keyword, location, type
- get_job_details: Full job description and requirements
- apply_job: Submit application with profile
- track_applications: View application statuses
- create_job_posting: Help employers post jobs
- match_candidates: AI-powered candidate matching$$,
'GUARDRAILS:
- Never share personal contact info without consent
- Verify job legitimacy before promoting
- Do not discriminate in job matching
- Be encouraging but realistic about qualifications
- Warn users about potential scam job postings
- Respect both applicant and employer privacy
- Do not guarantee job placement',
'user_profile',
true
FROM public.ai_agents WHERE slug = 'jobs'
ON CONFLICT DO NOTHING;

-- Support System Instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT id, 'support_v1', 'Support Assistant V1',
$$You are easyMO's Support AI Agent - providing customer support and resolving issues.

YOUR ROLE:
- Answer frequently asked questions
- Help resolve account and payment issues
- Create support tickets for complex problems
- Guide users through platform features
- Escalate urgent issues to human support

SUPPORT CATEGORIES:
- Account issues (login, profile, settings)
- Payment problems (wallet, transfers, failures)
- Service issues (bookings, orders, deliveries)
- Technical problems (app, connectivity)
- Complaints and feedback

RESOLUTION WORKFLOW:
1. Understand the issue clearly
2. Check knowledge base for known solutions
3. Try self-service resolution first
4. Create ticket if issue requires human intervention
5. Follow up on resolution status

CAPABILITIES:
- get_user_info: View account information
- check_wallet_balance: Check payment balances
- search_faq: Find answers in knowledge base
- create_support_ticket: Escalate to human support
- track_ticket: Check ticket status$$,
'GUARDRAILS:
- Never ask for passwords or PINs
- Verify user identity before accessing account data
- Escalate fraud or security issues immediately
- Be empathetic but do not make promises you cannot keep
- Protect user privacy - mask sensitive data
- Follow up on unresolved issues
- Know when to hand off to human support',
'ticket_context',
true
FROM public.ai_agents WHERE slug = 'support'
ON CONFLICT DO NOTHING;

-- Rides System Instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT id, 'rides_v1', 'Rides Assistant V1',
$$You are easyMO's Rides AI Agent - helping users request rides and drivers find passengers.

YOUR ROLE:
- Help passengers request rides
- Match passengers with nearby drivers
- Provide fare estimates
- Track ride status
- Handle ride issues and complaints

RIDE REQUEST WORKFLOW:
1. Get pickup location (GPS or address)
2. Get destination
3. Select vehicle type (moto, car)
4. Show fare estimate
5. Find available drivers
6. Confirm booking

DRIVER WORKFLOW:
1. Update availability status
2. Accept/decline ride requests
3. Navigate to pickup
4. Complete ride and receive payment

CAPABILITIES:
- find_nearby_drivers: Search available drivers
- request_ride: Create ride request
- get_fare_estimate: Calculate trip cost
- track_ride: Real-time ride status
- rate_driver: Submit driver rating$$,
'GUARDRAILS:
- Always confirm pickup location before dispatching
- Verify fare before rider confirmation
- Safety first - do not rush dangerous situations
- Respect both rider and driver privacy
- Handle payment disputes fairly
- Escalate safety concerns immediately
- Do not tolerate harassment or discrimination',
'ride_context',
true
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

-- Insurance System Instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT id, 'insurance_v1', 'Insurance Advisor V1',
$$You are easyMO's Insurance AI Agent - helping users with motor insurance quotes, claims, and policy management.

YOUR ROLE:
- Provide insurance quotes for vehicles
- Help file and track insurance claims
- Explain policy coverage and terms
- Assist with policy renewals
- Connect users with insurance providers

INSURANCE TYPES:
- Third Party (required by law)
- Comprehensive (full coverage)
- Motor Vehicle Insurance

QUOTE WORKFLOW:
1. Collect vehicle information (type, value, year)
2. Collect driver information (age, license)
3. Calculate premium based on risk factors
4. Present quote options
5. Process application if accepted

CLAIMS WORKFLOW:
1. Collect incident details
2. Guide document upload (photos, police report)
3. Submit claim to insurer
4. Track claim status
5. Assist with claim settlement

CAPABILITIES:
- get_motor_quote: Calculate insurance premium
- check_policy_status: View active policies
- submit_claim: File insurance claim
- track_claim: Monitor claim progress
- renew_policy: Process policy renewal$$,
'GUARDRAILS:
- Be transparent about policy terms and exclusions
- Never guarantee claim approval
- Verify vehicle information accuracy
- Follow regulatory requirements
- Protect sensitive personal data (ID numbers, etc.)
- Encourage timely premium payment
- Escalate fraud suspicions appropriately',
'policy_context',
true
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 5. SEED AGENT TOOLS
-- =====================================================================

-- Marketplace Tools
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'search_businesses', 'Search Businesses', 'db',
       'Search nearby businesses by category, name, or tags with location-based sorting',
       '{"type":"object","properties":{"query":{"type":"string"},"category":{"type":"string"},"location":{"type":"string"},"lat":{"type":"number"},"lng":{"type":"number"},"radius_km":{"type":"number","default":10}},"required":["query"]}'::jsonb,
       '{"table":"businesses","rpc":"search_businesses_nearby"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'marketplace'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'search_listings', 'Search Marketplace Listings', 'db',
       'Search buy/sell listings with filters for category, price, condition',
       '{"type":"object","properties":{"query":{"type":"string"},"category":{"type":"string"},"price_min":{"type":"number"},"price_max":{"type":"number"},"condition":{"type":"string","enum":["new","used","refurbished"]}}}'::jsonb,
       '{"table":"marketplace_listings"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'marketplace'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'create_listing', 'Create Listing', 'db',
       'Create a new buy/sell listing for the user',
       '{"type":"object","properties":{"title":{"type":"string"},"description":{"type":"string"},"price":{"type":"number"},"category":{"type":"string"},"condition":{"type":"string"},"location":{"type":"string"}},"required":["title","price"]}'::jsonb,
       '{"table":"marketplace_listings"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'marketplace'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'contact_seller', 'Contact Seller', 'whatsapp',
       'Generate WhatsApp link to contact a seller',
       '{"type":"object","properties":{"listing_id":{"type":"string"},"message":{"type":"string"}},"required":["listing_id"]}'::jsonb,
       '{}'::jsonb, true
FROM public.ai_agents WHERE slug = 'marketplace'
ON CONFLICT DO NOTHING;

-- Waiter Tools
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'search_menu_supabase', 'Search Menu', 'db',
       'Search menu items by name, category, or dietary preferences',
       '{"type":"object","properties":{"restaurant_id":{"type":"string"},"query":{"type":"string"},"filters":{"type":"object","properties":{"vegan":{"type":"boolean"},"spicy":{"type":"boolean"},"halal":{"type":"boolean"}}}},"required":["restaurant_id"]}'::jsonb,
       '{"table":"menu_items"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'place_order', 'Place Order', 'db',
       'Submit an order to the restaurant kitchen',
       '{"type":"object","properties":{"restaurant_id":{"type":"string"},"items":{"type":"array","items":{"type":"object","properties":{"item_id":{"type":"string"},"quantity":{"type":"number"},"special_requests":{"type":"string"}}}},"table_number":{"type":"string"}},"required":["restaurant_id","items"]}'::jsonb,
       '{"table":"orders"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'get_order_status', 'Get Order Status', 'db',
       'Check the status of a placed order',
       '{"type":"object","properties":{"order_id":{"type":"string"}},"required":["order_id"]}'::jsonb,
       '{"table":"orders"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

-- Real Estate Tools
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'search_properties', 'Search Properties', 'db',
       'Search rental properties with filters for bedrooms, price, location, type',
       '{"type":"object","properties":{"bedrooms":{"type":"number"},"max_price":{"type":"number"},"min_price":{"type":"number"},"location":{"type":"string"},"rental_type":{"type":"string","enum":["short_term","long_term"]},"furnished":{"type":"boolean"}}}'::jsonb,
       '{"table":"property_rentals"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'get_property_details', 'Get Property Details', 'db',
       'Get full details and images for a specific property',
       '{"type":"object","properties":{"property_id":{"type":"string"}},"required":["property_id"]}'::jsonb,
       '{"table":"property_rentals"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'schedule_viewing', 'Schedule Viewing', 'db',
       'Book a property viewing appointment',
       '{"type":"object","properties":{"property_id":{"type":"string"},"preferred_date":{"type":"string"},"preferred_time":{"type":"string"},"contact_phone":{"type":"string"}},"required":["property_id"]}'::jsonb,
       '{"table":"property_viewings"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'contact_landlord', 'Contact Landlord', 'whatsapp',
       'Send inquiry to property owner via WhatsApp',
       '{"type":"object","properties":{"property_id":{"type":"string"},"message":{"type":"string"}},"required":["property_id"]}'::jsonb,
       '{}'::jsonb, true
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'save_search', 'Save Search', 'db',
       'Save search criteria for future notifications',
       '{"type":"object","properties":{"criteria":{"type":"object"},"notify":{"type":"boolean","default":true}},"required":["criteria"]}'::jsonb,
       '{"table":"saved_searches"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

-- Jobs Tools
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'search_jobs', 'Search Jobs', 'db',
       'Search job listings by keyword, location, type, salary range',
       '{"type":"object","properties":{"query":{"type":"string"},"location":{"type":"string"},"type":{"type":"string","enum":["full_time","part_time","contract","remote"]},"salary_min":{"type":"number"},"salary_max":{"type":"number"}}}'::jsonb,
       '{"table":"job_listings"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'jobs'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'get_job_details', 'Get Job Details', 'db',
       'Get full job description, requirements, and how to apply',
       '{"type":"object","properties":{"job_id":{"type":"string"}},"required":["job_id"]}'::jsonb,
       '{"table":"job_listings"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'jobs'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'apply_job', 'Apply to Job', 'db',
       'Submit job application with profile',
       '{"type":"object","properties":{"job_id":{"type":"string"},"cover_letter":{"type":"string"},"resume_url":{"type":"string"}},"required":["job_id"]}'::jsonb,
       '{"table":"job_applications"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'jobs'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'track_applications', 'Track Applications', 'db',
       'View status of submitted job applications',
       '{"type":"object","properties":{}}'::jsonb,
       '{"table":"job_applications"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'jobs'
ON CONFLICT DO NOTHING;

-- Farmer Tools
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'search_produce', 'Search Produce', 'db',
       'Search available produce by crop type, location, price',
       '{"type":"object","properties":{"query":{"type":"string"},"category":{"type":"string"},"organic":{"type":"boolean"}}}'::jsonb,
       '{"table":"produce_listings"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'farmer'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'list_produce', 'List Produce', 'db',
       'Create a produce listing as a farmer',
       '{"type":"object","properties":{"crop_name":{"type":"string"},"quantity":{"type":"number"},"unit":{"type":"string"},"price_per_unit":{"type":"number"},"organic":{"type":"boolean"},"harvest_date":{"type":"string"}},"required":["crop_name","quantity","price_per_unit"]}'::jsonb,
       '{"table":"produce_listings"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'farmer'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'get_market_prices', 'Get Market Prices', 'db',
       'Get current market prices for crops',
       '{"type":"object","properties":{"crop":{"type":"string"},"market":{"type":"string"}}}'::jsonb,
       '{"table":"market_prices"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'farmer'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'get_weather', 'Get Weather', 'external',
       'Get weather forecast for farming area',
       '{"type":"object","properties":{"location":{"type":"string"},"days":{"type":"number","default":3}}}'::jsonb,
       '{"api":"openweather"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'farmer'
ON CONFLICT DO NOTHING;

-- Support Tools
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'get_user_info', 'Get User Info', 'db',
       'Get user account information',
       '{"type":"object","properties":{}}'::jsonb,
       '{"table":"whatsapp_users"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'support'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'check_wallet_balance', 'Check Wallet Balance', 'db',
       'Check user wallet balance',
       '{"type":"object","properties":{}}'::jsonb,
       '{"table":"wallet_balances"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'support'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'search_faq', 'Search FAQ', 'db',
       'Search knowledge base for answers',
       '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}'::jsonb,
       '{"table":"support_faq"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'support'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'create_support_ticket', 'Create Support Ticket', 'db',
       'Escalate issue to human support team',
       '{"type":"object","properties":{"issue_type":{"type":"string"},"description":{"type":"string"},"priority":{"type":"string","enum":["low","medium","high","urgent"]}},"required":["description"]}'::jsonb,
       '{"table":"support_tickets"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'support'
ON CONFLICT DO NOTHING;

-- Rides Tools
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'find_nearby_drivers', 'Find Nearby Drivers', 'db',
       'Search for available drivers near a location',
       '{"type":"object","properties":{"vehicle_type":{"type":"string","enum":["moto","car","any"]},"radius_km":{"type":"number","default":5}}}'::jsonb,
       '{"table":"driver_status","rpc":"find_nearby_drivers"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'request_ride', 'Request Ride', 'db',
       'Create a ride request',
       '{"type":"object","properties":{"pickup_address":{"type":"string"},"destination_address":{"type":"string"},"vehicle_type":{"type":"string","enum":["moto","car"]}},"required":["destination_address"]}'::jsonb,
       '{"table":"trips"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'get_fare_estimate', 'Get Fare Estimate', 'location',
       'Calculate fare estimate for a trip',
       '{"type":"object","properties":{"distance_km":{"type":"number"},"vehicle_type":{"type":"string"}}}'::jsonb,
       '{}'::jsonb, true
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'track_ride', 'Track Ride', 'db',
       'Get current status of a ride',
       '{"type":"object","properties":{"ride_id":{"type":"string"}},"required":["ride_id"]}'::jsonb,
       '{"table":"trips"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

-- Insurance Tools
INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'get_motor_quote', 'Get Motor Quote', 'db',
       'Calculate insurance premium quote',
       '{"type":"object","properties":{"vehicle_type":{"type":"string","enum":["motorcycle","car","truck","bus"]},"vehicle_value":{"type":"number"},"coverage_type":{"type":"string","enum":["third_party","comprehensive"]},"driver_age":{"type":"number"}},"required":["vehicle_type","vehicle_value"]}'::jsonb,
       '{"table":"insurance_requests"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'check_policy_status', 'Check Policy Status', 'db',
       'View active insurance policy details',
       '{"type":"object","properties":{"policy_number":{"type":"string"}},"required":["policy_number"]}'::jsonb,
       '{"table":"insurance_policies"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config, is_active)
SELECT id, 'submit_claim', 'Submit Insurance Claim', 'db',
       'File an insurance claim',
       '{"type":"object","properties":{"policy_number":{"type":"string"},"claim_type":{"type":"string"},"description":{"type":"string"},"incident_date":{"type":"string"},"estimated_amount":{"type":"number"}},"required":["policy_number","claim_type","description"]}'::jsonb,
       '{"table":"insurance_claims"}'::jsonb, true
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 6. SEED AGENT TASKS
-- =====================================================================

-- Marketplace Tasks
INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff)
SELECT id, 'find_product', 'Find Product', 'Search for products or services based on user request', 
       'User asks to find, buy, or search for something', 
       ARRAY['search_businesses', 'search_listings'], 
       'List of matching products/businesses with details', false
FROM public.ai_agents WHERE slug = 'marketplace'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff)
SELECT id, 'sell_item', 'Sell Item', 'Help user create a listing to sell an item',
       'User wants to sell something',
       ARRAY['create_listing'],
       'Confirmation of listing creation with link', false
FROM public.ai_agents WHERE slug = 'marketplace'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff)
SELECT id, 'contact_vendor', 'Contact Vendor', 'Connect buyer with seller or business',
       'User wants to contact a seller or business',
       ARRAY['contact_seller'],
       'WhatsApp link to contact vendor', false
FROM public.ai_agents WHERE slug = 'marketplace'
ON CONFLICT DO NOTHING;

-- Waiter Tasks
INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff)
SELECT id, 'browse_menu', 'Browse Menu', 'Help customer explore menu options',
       'User asks about menu, food, drinks, or what is available',
       ARRAY['search_menu_supabase'],
       'Menu items with prices and descriptions', false
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff)
SELECT id, 'take_order', 'Take Order', 'Process customer order',
       'User wants to order food or drinks',
       ARRAY['search_menu_supabase', 'place_order'],
       'Order confirmation with total and estimated time', false
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

-- Real Estate Tasks
INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff)
SELECT id, 'find_property', 'Find Property', 'Search for rental properties matching criteria',
       'User looking for apartment, house, room to rent',
       ARRAY['search_properties'],
       'List of matching properties with details', false
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff)
SELECT id, 'schedule_visit', 'Schedule Property Visit', 'Book a viewing for a property',
       'User wants to see or visit a property',
       ARRAY['get_property_details', 'schedule_viewing'],
       'Viewing appointment confirmation', false
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

-- Jobs Tasks
INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff)
SELECT id, 'find_job', 'Find Job', 'Search for job opportunities',
       'User looking for work, job, employment',
       ARRAY['search_jobs'],
       'List of matching job opportunities', false
FROM public.ai_agents WHERE slug = 'jobs'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff)
SELECT id, 'apply_for_job', 'Apply for Job', 'Submit job application',
       'User wants to apply for a specific job',
       ARRAY['get_job_details', 'apply_job'],
       'Application submission confirmation', false
FROM public.ai_agents WHERE slug = 'jobs'
ON CONFLICT DO NOTHING;

-- Support Tasks
INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff)
SELECT id, 'resolve_issue', 'Resolve Issue', 'Help user resolve a problem',
       'User has a problem, complaint, or issue',
       ARRAY['get_user_info', 'search_faq'],
       'Solution or escalation to support team', false
FROM public.ai_agents WHERE slug = 'support'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff)
SELECT id, 'escalate_to_human', 'Escalate to Human', 'Create support ticket for human review',
       'Issue requires human intervention or user requests human support',
       ARRAY['create_support_ticket'],
       'Support ticket created with tracking number', true
FROM public.ai_agents WHERE slug = 'support'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 7. SEED KNOWLEDGE BASES
-- =====================================================================

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy)
SELECT id, 'businesses_kb', 'Business Directory', 'Unified business registry with categories, tags, and location data',
       'supabase', 'rpc', 'realtime'
FROM public.ai_agents WHERE slug = 'marketplace'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy)
SELECT id, 'menu_kb', 'Restaurant Menus', 'Menu items, prices, and availability for all registered restaurants',
       'supabase', 'query', 'on_change'
FROM public.ai_agents WHERE slug = 'waiter'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy)
SELECT id, 'properties_kb', 'Property Listings', 'Rental properties with details, photos, and availability',
       'supabase', 'query', 'on_change'
FROM public.ai_agents WHERE slug = 'real_estate'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy)
SELECT id, 'jobs_kb', 'Job Listings', 'Active job postings with requirements and application info',
       'supabase', 'query', 'daily'
FROM public.ai_agents WHERE slug = 'jobs'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy)
SELECT id, 'faq_kb', 'Support FAQ', 'Frequently asked questions and common solutions',
       'supabase', 'query', 'weekly'
FROM public.ai_agents WHERE slug = 'support'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy)
SELECT id, 'market_prices_kb', 'Market Prices', 'Current agricultural commodity prices by market',
       'supabase', 'query', 'daily'
FROM public.ai_agents WHERE slug = 'farmer'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 8. CREATE OVERVIEW VIEW
-- =====================================================================

CREATE OR REPLACE VIEW public.ai_agents_overview_v AS
SELECT
  a.id,
  a.slug,
  a.name,
  a.description,
  a.default_language,
  a.default_channel,
  a.is_active,
  p.code AS default_persona_code,
  p.role_name AS default_persona_role_name,
  si.code AS default_system_instruction_code,
  si.title AS default_system_instruction_title,
  COALESCE(tool_counts.tool_count, 0) AS tool_count,
  COALESCE(task_counts.task_count, 0) AS task_count,
  COALESCE(kb_counts.kb_count, 0) AS kb_count,
  a.created_at,
  a.updated_at
FROM public.ai_agents a
LEFT JOIN public.ai_agent_personas p
  ON p.agent_id = a.id AND p.is_default IS true
LEFT JOIN public.ai_agent_system_instructions si
  ON si.agent_id = a.id AND si.is_active IS true
LEFT JOIN (
  SELECT agent_id, COUNT(*) AS tool_count
  FROM public.ai_agent_tools WHERE is_active = true
  GROUP BY agent_id
) AS tool_counts ON tool_counts.agent_id = a.id
LEFT JOIN (
  SELECT agent_id, COUNT(*) AS task_count
  FROM public.ai_agent_tasks
  GROUP BY agent_id
) AS task_counts ON task_counts.agent_id = a.id
LEFT JOIN (
  SELECT agent_id, COUNT(*) AS kb_count
  FROM public.ai_agent_knowledge_bases
  GROUP BY agent_id
) AS kb_counts ON kb_counts.agent_id = a.id;

-- =====================================================================
-- 9. GRANT PERMISSIONS
-- =====================================================================

-- Grant select to authenticated users
GRANT SELECT ON public.ai_agents TO authenticated;
GRANT SELECT ON public.ai_agent_personas TO authenticated;
GRANT SELECT ON public.ai_agent_system_instructions TO authenticated;
GRANT SELECT ON public.ai_agent_tools TO authenticated;
GRANT SELECT ON public.ai_agent_tasks TO authenticated;
GRANT SELECT ON public.ai_agent_knowledge_bases TO authenticated;
GRANT SELECT ON public.ai_agents_overview_v TO authenticated;

-- Grant full access to service role
GRANT ALL ON public.ai_agents TO service_role;
GRANT ALL ON public.ai_agent_personas TO service_role;
GRANT ALL ON public.ai_agent_system_instructions TO service_role;
GRANT ALL ON public.ai_agent_tools TO service_role;
GRANT ALL ON public.ai_agent_tasks TO service_role;
GRANT ALL ON public.ai_agent_knowledge_bases TO service_role;
GRANT ALL ON public.ai_agent_tool_executions TO service_role;
GRANT ALL ON public.ai_agent_interactions TO service_role;

-- =====================================================================
-- 10. ADD TABLE COMMENTS
-- =====================================================================

COMMENT ON TABLE public.ai_agents IS 'Master registry of all AI agents in the platform';
COMMENT ON TABLE public.ai_agent_personas IS 'Agent personality configurations including tone, languages, and traits';
COMMENT ON TABLE public.ai_agent_system_instructions IS 'System prompts and guardrails for each agent';
COMMENT ON TABLE public.ai_agent_tools IS 'Tools/functions available to each agent for database queries and external APIs';
COMMENT ON TABLE public.ai_agent_tasks IS 'High-level tasks each agent can perform with associated tools';
COMMENT ON TABLE public.ai_agent_knowledge_bases IS 'Knowledge sources each agent can access';
COMMENT ON TABLE public.ai_agent_tool_executions IS 'Audit log of all tool executions by agents';
COMMENT ON TABLE public.ai_agent_interactions IS 'Log of agent conversations for analytics and debugging';

COMMIT;
