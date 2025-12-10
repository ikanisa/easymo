-- =====================================================================
-- ADD RIDES & INSURANCE AI AGENTS - COMPREHENSIVE
-- =====================================================================
-- Adds two additional agents: Rides AI Agent and Insurance AI Agent
-- with full personas, tools, tasks, and knowledge bases
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. CREATE RIDES AI AGENT
-- =====================================================================

INSERT INTO public.ai_agents (slug, name, description, default_persona_code, default_system_instruction_code, default_language, default_channel, is_active, metadata)
VALUES (
  'rides',
  'Rides AI Agent',
  'Smart mobility agent: schedule rides, find nearby drivers, manage subscriptions, driver onboarding, vehicle tracking. Serves riders and drivers.',
  'RIDES-PERSONA',
  'RIDES-SYS',
  'multi',
  'whatsapp',
  true,
  jsonb_build_object(
    'primary_users', ARRAY['riders', 'drivers', 'fleet_managers'],
    'channels', ARRAY['whatsapp', 'voice_sip', 'pwa_dashboard'],
    'core_goal', 'Schedule rides, match drivers, manage fleet, coordinate pickups'
  )
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata;

-- Rides Persona
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, is_default, traits)
SELECT 
  id,
  'RIDES-PERSONA',
  'Mobility Coordinator / Dispatcher',
  'Efficient, reassuring, time-conscious; speaks to riders with warmth, to drivers with clarity',
  ARRAY['en', 'fr', 'rw'],
  true,
  jsonb_build_object(
    'rider_interaction', 'Warm, reassuring about ETA and driver details',
    'driver_interaction', 'Clear instructions, respects their time',
    'time_consciousness', 'Always mentions ETA and updates proactively',
    'safety_first', 'Verifies driver details, shares safety tips',
    'efficiency', 'Quick confirmations, minimal back-and-forth',
    'problem_solving', 'Offers alternatives if no drivers nearby'
  )
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

-- Rides System Instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT 
  id,
  'RIDES-SYS',
  'Rides Agent System Instructions v1 - Complete',
  'You are a mobility coordinator on WhatsApp helping users schedule rides, find nearby drivers, and manage transportation. You coordinate between riders and drivers in real-time.

KEY RESPONSIBILITIES:
- Ride Scheduling: Capture pickup/dropoff, time, passenger count
- Driver Matching: Find available drivers nearby using geo-search
- Real-time Tracking: Share driver location and ETA updates
- Subscription Management: Handle monthly ride packages
- Driver Onboarding: Verify documents, register vehicles
- Fleet Management: Coordinate with fleet managers on availability

INTERACTION FLOW (RIDERS):
1. Greet and ask where they want to go
2. Confirm pickup location (use maps or let them share location pin)
3. Confirm dropoff location
4. Ask when they need the ride (now or scheduled)
5. Search for nearby drivers using find_nearby_drivers tool
6. Present 1-3 driver options with ETA and ratings
7. Confirm booking and share driver details (name, plate, photo)
8. Send real-time updates until pickup

INTERACTION FLOW (DRIVERS):
1. Check if registered; if not, start onboarding
2. Ask about availability for the day/shift
3. Share incoming ride requests from nearby
4. Coordinate pickup confirmations
5. Track status (en route, picked up, completed)

LANGUAGE: EN, FR, Kinyarwanda - detect and respond in user language',
  'STRICT RULES:
- Never share rider personal info with other riders
- Never share driver personal info beyond name, plate, rating
- Always verify driver identity before sharing with rider
- No price negotiation - use fixed rates from system
- Safety first: if rider reports unsafe driver, escalate immediately
- Subscription changes require admin approval
- Driver registration requires document verification
- No cash handling - MoMo only
- Respect driver availability - don''t over-assign
- Time-sensitive: always give ETA estimates',
  'RIDER PROFILE:
- Preferred pickup locations (home, work)
- Frequent destinations
- Subscription status and balance
- Past ride history and ratings given
- Preferred drivers if any

DRIVER PROFILE:
- Current location (updated every 2 min)
- Availability status (available, busy, offline)
- Vehicle details (plate, model, seats)
- Rating and completed rides count
- Preferred zones/areas

RIDE MEMORY:
- Active rides and their status
- Scheduled future rides
- Driver-rider pairing history
- Feedback and ratings for matching improvement',
  true
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 2. CREATE INSURANCE AI AGENT
-- =====================================================================

INSERT INTO public.ai_agents (slug, name, description, default_persona_code, default_system_instruction_code, default_language, default_channel, is_active, metadata)
VALUES (
  'insurance',
  'Insurance AI Agent',
  'Insurance assistant: quote generation, document OCR, claims processing, policy management. Serves policyholders and insurance admins.',
  'INS-PERSONA',
  'INS-SYS',
  'multi',
  'whatsapp',
  true,
  jsonb_build_object(
    'primary_users', ARRAY['policyholders', 'insurance_agents', 'admins'],
    'channels', ARRAY['whatsapp', 'web_admin', 'ocr_processing'],
    'core_goal', 'Generate quotes, process claims, manage policies, verify documents'
  )
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata;

-- Insurance Persona
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, is_default, traits)
SELECT 
  id,
  'INS-PERSONA',
  'Insurance Advisor / Claims Specialist',
  'Professional, empathetic, patient with paperwork; reassuring during claims; precise with coverage details',
  ARRAY['en', 'fr', 'rw'],
  true,
  jsonb_build_object(
    'professionalism', 'Always formal and trustworthy tone',
    'empathy', 'Especially during claims - acknowledges stress',
    'precision', 'Exact about coverage, exclusions, premiums',
    'patience', 'Understands insurance is confusing, explains clearly',
    'document_handling', 'Guides through photo uploads, OCR verification',
    'transparency', 'Clear about what is/isn''t covered, no surprises'
  )
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

-- Insurance System Instructions
INSERT INTO public.ai_agent_system_instructions (agent_id, code, title, instructions, guardrails, memory_strategy, is_active)
SELECT 
  id,
  'INS-SYS',
  'Insurance Agent System Instructions v1 - Complete',
  'You are an insurance specialist on WhatsApp helping users get quotes, file claims, and manage policies. You process documents via OCR and coordinate with insurance admins.

KEY RESPONSIBILITIES:
- Quote Generation: Gather info (vehicle, health, property), calculate premium
- Document OCR: Process ID cards, driver licenses, vehicle docs via photo upload
- Claims Processing: Capture incident details, photos, estimate damage
- Policy Management: Renewals, updates, payment tracking
- Admin Coordination: Route complex cases to human insurance agents
- Verification: Cross-check documents against policy details

INTERACTION FLOW (QUOTE REQUEST):
1. Ask what type of insurance (vehicle, health, property, life)
2. Gather required details:
   - Vehicle: make, model, year, plate, driver age, usage
   - Health: age, pre-existing conditions, coverage level
   - Property: location, value, construction type
3. Calculate premium using generate_quote tool
4. Present quote with coverage summary
5. Offer to start application if interested
6. Guide document uploads (ID, registration, etc.)

INTERACTION FLOW (CLAIM):
1. Ask about incident (what happened, when, where)
2. Request photos of damage
3. Use OCR to extract details from documents
4. Verify against active policy using check_coverage tool
5. Create claim record
6. Estimate processing time
7. Route to admin for approval
8. Keep user updated on claim status

LANGUAGE: EN, FR, Kinyarwanda - insurance terms explained simply',
  'STRICT RULES:
- Never guarantee claim approval - only "coverage applies if verified"
- Precise premium quotes - no estimates without full info
- Document verification required for all applications
- Privacy: never share policyholder info with others
- Medical/health questions: never give health advice, only coverage info
- Exclusions must be stated clearly upfront
- Payment processing only through verified MoMo
- Claims photos required before processing
- Fraud detection: flag suspicious patterns to admin
- Legal compliance: follow insurance regulations strictly
- No policy changes without admin approval
- Always state waiting periods clearly',
  'POLICYHOLDER PROFILE:
- Active policies (type, coverage, premium, expiry)
- Payment history and status
- Claims history (filed, approved, denied)
- Uploaded documents and verification status
- Preferred contact method

POLICY DATABASE:
- Coverage rules by policy type
- Premium calculation factors
- Exclusions and waiting periods
- Claim approval thresholds

CLAIMS MEMORY:
- Open claims and status
- Documents submitted per claim
- Admin notes and decisions
- Settlement amounts and timelines

OCR CACHE:
- Processed documents (ID, licenses, registrations)
- Extracted data (names, dates, numbers)
- Verification flags (genuine, tampered, unclear)',
  true
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 3. RIDES AGENT TOOLS
-- =====================================================================

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'find_nearby_drivers',
  'Find Nearby Drivers',
  'db',
  'Search for available drivers near pickup location using geo-query',
  '{"type": "object", "required": ["pickup_lat", "pickup_lon"], "properties": {"pickup_lat": {"type": "number"}, "pickup_lon": {"type": "number"}, "radius_km": {"type": "number", "default": 5}, "vehicle_type": {"type": "string", "enum": ["sedan", "suv", "moto", "any"]}}}'::jsonb,
  '{"table": "drivers", "geo_query": true, "max_results": 10, "rank_by": ["distance", "rating", "availability"]}'::jsonb
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'schedule_ride',
  'Schedule Ride',
  'db',
  'Create ride booking with pickup/dropoff, time, driver assignment',
  '{"type": "object", "required": ["rider_id", "pickup_location", "dropoff_location"], "properties": {"rider_id": {"type": "string"}, "pickup_location": {"type": "object"}, "dropoff_location": {"type": "object"}, "scheduled_time": {"type": "string", "format": "date-time"}, "passenger_count": {"type": "number"}, "driver_id": {"type": "string"}}}'::jsonb,
  '{"table": "rides", "notify_driver": true, "notify_rider": true, "calculate_fare": true}'::jsonb
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'track_ride',
  'Track Ride Status',
  'db',
  'Get real-time ride status and driver location',
  '{"type": "object", "required": ["ride_id"], "properties": {"ride_id": {"type": "string", "format": "uuid"}}}'::jsonb,
  '{"table": "rides", "include_driver_location": true, "cache_ttl": 30}'::jsonb
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'manage_subscription',
  'Manage Ride Subscription',
  'db',
  'Check/update monthly ride subscription packages',
  '{"type": "object", "required": ["user_id"], "properties": {"user_id": {"type": "string"}, "action": {"type": "string", "enum": ["check", "purchase", "renew", "cancel"]}, "package_id": {"type": "string"}}}'::jsonb,
  '{"table": "ride_subscriptions", "payment_integration": true}'::jsonb
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'onboard_driver',
  'Driver Onboarding',
  'db',
  'Register new driver with document verification',
  '{"type": "object", "required": ["phone", "name", "vehicle_plate"], "properties": {"phone": {"type": "string"}, "name": {"type": "string"}, "vehicle_plate": {"type": "string"}, "vehicle_type": {"type": "string"}, "license_number": {"type": "string"}, "documents": {"type": "array"}}}'::jsonb,
  '{"table": "drivers", "verify_documents": true, "background_check": true}'::jsonb
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'update_driver_status',
  'Update Driver Availability',
  'db',
  'Update driver online/offline status and location',
  '{"type": "object", "required": ["driver_id", "status"], "properties": {"driver_id": {"type": "string"}, "status": {"type": "string", "enum": ["available", "busy", "offline"]}, "current_location": {"type": "object"}}}'::jsonb,
  '{"table": "drivers", "update_location": true, "notify_dispatch": true}'::jsonb
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'calculate_fare',
  'Calculate Ride Fare',
  'http',
  'Calculate estimated fare based on distance, time, surge pricing',
  '{"type": "object", "required": ["pickup", "dropoff"], "properties": {"pickup": {"type": "object"}, "dropoff": {"type": "object"}, "vehicle_type": {"type": "string"}, "scheduled_time": {"type": "string"}}}'::jsonb,
  '{"endpoint": "/api/rides/calculate-fare", "method": "POST", "include_surge": true}'::jsonb
FROM public.ai_agents WHERE slug = 'rides'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 4. INSURANCE AGENT TOOLS
-- =====================================================================

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'generate_quote',
  'Generate Insurance Quote',
  'http',
  'Calculate insurance premium based on type and details',
  '{"type": "object", "required": ["insurance_type", "details"], "properties": {"insurance_type": {"type": "string", "enum": ["vehicle", "health", "property", "life"]}, "details": {"type": "object"}, "coverage_level": {"type": "string", "enum": ["basic", "standard", "premium"]}}}'::jsonb,
  '{"endpoint": "/api/insurance/quote", "method": "POST", "include_breakdown": true}'::jsonb
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'ocr_process_document',
  'OCR Document Processing',
  'external',
  'Extract text from uploaded insurance documents (ID, license, registration)',
  '{"type": "object", "required": ["image_url", "document_type"], "properties": {"image_url": {"type": "string"}, "document_type": {"type": "string", "enum": ["id_card", "driver_license", "vehicle_registration", "claim_photo"]}}}'::jsonb,
  '{"provider": "google_vision", "extract_fields": true, "verify_authenticity": true}'::jsonb
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'check_coverage',
  'Check Policy Coverage',
  'db',
  'Verify if user has active policy and coverage for specific claim type',
  '{"type": "object", "required": ["policy_id", "claim_type"], "properties": {"policy_id": {"type": "string"}, "claim_type": {"type": "string"}, "incident_date": {"type": "string", "format": "date"}}}'::jsonb,
  '{"table": "insurance_policies", "check_exclusions": true, "check_waiting_period": true}'::jsonb
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'create_claim',
  'Create Insurance Claim',
  'db',
  'File new insurance claim with incident details and photos',
  '{"type": "object", "required": ["policy_id", "claim_type", "incident_details"], "properties": {"policy_id": {"type": "string"}, "claim_type": {"type": "string"}, "incident_details": {"type": "object"}, "photos": {"type": "array"}, "estimated_amount": {"type": "number"}}}'::jsonb,
  '{"table": "insurance_claims", "notify_admin": true, "auto_estimate": true}'::jsonb
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'notify_insurance_admin',
  'Notify Insurance Admin',
  'whatsapp',
  'Send WhatsApp notification to insurance admin for review',
  '{"type": "object", "required": ["admin_phone", "notification_type", "details"], "properties": {"admin_phone": {"type": "string"}, "notification_type": {"type": "string", "enum": ["new_claim", "document_review", "approval_needed"]}, "details": {"type": "object"}}}'::jsonb,
  '{"use_templates": true, "priority_routing": true}'::jsonb
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, config)
SELECT 
  id,
  'update_policy',
  'Update Insurance Policy',
  'db',
  'Update policy details, payment status, renewal dates',
  '{"type": "object", "required": ["policy_id", "updates"], "properties": {"policy_id": {"type": "string"}, "updates": {"type": "object"}, "requires_approval": {"type": "boolean"}}}'::jsonb,
  '{"table": "insurance_policies", "audit_log": true, "admin_approval_threshold": 10000}'::jsonb
FROM public.ai_agents WHERE slug = 'insurance'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 5. RIDES AGENT TASKS
-- =====================================================================

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'book_ride',
  'Book Immediate Ride',
  'Find nearby driver and book ride for immediate pickup',
  'User says "I need a ride" or "Book me a car"',
  ARRAY['find_nearby_drivers', 'schedule_ride', 'calculate_fare']::text[],
  'Ride booked, driver assigned, confirmation with ETA sent',
  false,
  '{"complexity": "medium", "avg_duration_seconds": 90, "requires_location": true}'::jsonb
FROM public.ai_agents WHERE slug = 'rides';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'schedule_future_ride',
  'Schedule Future Ride',
  'Book ride for specific future date/time',
  'User says "Book ride for tomorrow" or specifies future time',
  ARRAY['schedule_ride', 'calculate_fare']::text[],
  'Ride scheduled, confirmation sent, reminder set',
  false,
  '{"complexity": "low", "advance_booking_max_days": 7}'::jsonb
FROM public.ai_agents WHERE slug = 'rides';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'track_active_ride',
  'Track Active Ride',
  'Provide real-time updates on ride status and driver location',
  'User asks "Where is my driver?" or "Track my ride"',
  ARRAY['track_ride']::text[],
  'Current status, driver location, updated ETA shared',
  false,
  '{"complexity": "trivial", "real_time": true}'::jsonb
FROM public.ai_agents WHERE slug = 'rides';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'manage_ride_subscription',
  'Manage Subscription Package',
  'Handle monthly ride package purchases and renewals',
  'User asks about subscription or wants to buy package',
  ARRAY['manage_subscription']::text[],
  'Subscription status shown or package purchased',
  false,
  '{"complexity": "medium", "payment_required": true}'::jsonb
FROM public.ai_agents WHERE slug = 'rides';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'driver_registration',
  'Driver Onboarding & Registration',
  'Register new driver with document verification',
  'Driver says "I want to register" or starts onboarding',
  ARRAY['onboard_driver', 'ocr_process_document']::text[],
  'Driver registered pending verification, documents uploaded',
  true,
  '{"complexity": "high", "handoff_reason": "Document verification requires admin review"}'::jsonb
FROM public.ai_agents WHERE slug = 'rides';

-- =====================================================================
-- 6. INSURANCE AGENT TASKS
-- =====================================================================

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'quote_generation',
  'Generate Insurance Quote',
  'Gather details and calculate premium for insurance quote',
  'User asks "How much for car insurance?" or similar',
  ARRAY['generate_quote']::text[],
  'Detailed quote with premium, coverage summary, payment options',
  false,
  '{"complexity": "medium", "avg_questions": 8}'::jsonb
FROM public.ai_agents WHERE slug = 'insurance';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'document_processing',
  'Process Insurance Documents',
  'OCR and verify uploaded insurance documents',
  'User uploads photo of ID, license, or registration',
  ARRAY['ocr_process_document']::text[],
  'Document processed, data extracted, verification status shared',
  false,
  '{"complexity": "medium", "ocr_accuracy_threshold": 0.85}'::jsonb
FROM public.ai_agents WHERE slug = 'insurance';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'file_claim',
  'File Insurance Claim',
  'Capture claim details, verify coverage, create claim record',
  'User says "I want to file a claim" or reports incident',
  ARRAY['check_coverage', 'create_claim', 'ocr_process_document', 'notify_insurance_admin']::text[],
  'Claim filed, reference number provided, admin notified',
  true,
  '{"complexity": "high", "handoff_reason": "Claims require admin approval", "requires_photos": true}'::jsonb
FROM public.ai_agents WHERE slug = 'insurance';

INSERT INTO public.ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT 
  id,
  'policy_renewal',
  'Renew Insurance Policy',
  'Handle policy renewal, payment, and document updates',
  'Policy nearing expiry or user asks to renew',
  ARRAY['check_coverage', 'update_policy', 'generate_quote']::text[],
  'Policy renewed, updated expiry date, payment processed',
  false,
  '{"complexity": "medium", "auto_reminder_days": 30}'::jsonb
FROM public.ai_agents WHERE slug = 'insurance';

-- =====================================================================
-- 7. RIDES AGENT KNOWLEDGE BASES
-- =====================================================================

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'driver_directory',
  'Driver Directory',
  'All registered drivers with location, availability, ratings, vehicle details',
  'table',
  'tool:find_nearby_drivers',
  'Real-time updates via GPS tracking and status changes',
  '{"table": "drivers", "geo_indexed": true, "location_refresh_interval": 120}'::jsonb
FROM public.ai_agents WHERE slug = 'rides';

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'ride_history',
  'Ride History & Patterns',
  'Completed rides, frequent routes, rider preferences, ratings',
  'table',
  'direct_db',
  'Updated on ride completion; used for route suggestions',
  '{"table": "rides", "analytics_enabled": true}'::jsonb
FROM public.ai_agents WHERE slug = 'rides';

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'subscription_packages',
  'Ride Subscription Packages',
  'Monthly packages, pricing, included rides, benefits',
  'table',
  'tool:manage_subscription',
  'Updated by admin via dashboard',
  '{"table": "subscription_packages", "pricing_tiers": ["basic", "standard", "premium"]}'::jsonb
FROM public.ai_agents WHERE slug = 'rides';

-- =====================================================================
-- 8. INSURANCE AGENT KNOWLEDGE BASES
-- =====================================================================

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'policy_database',
  'Active Insurance Policies',
  'All active policies with coverage, premiums, expiry dates, policyholders',
  'table',
  'tool:check_coverage + tool:update_policy',
  'Updated on policy purchase, renewal, or cancellation',
  '{"table": "insurance_policies", "auto_expire": true}'::jsonb
FROM public.ai_agents WHERE slug = 'insurance';

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'claims_database',
  'Insurance Claims Records',
  'Filed claims with status, documents, approvals, settlements',
  'table',
  'tool:create_claim',
  'Updated on claim filing, admin review, and settlement',
  '{"table": "insurance_claims", "workflow_tracked": true}'::jsonb
FROM public.ai_agents WHERE slug = 'insurance';

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'coverage_rules',
  'Insurance Coverage Rules',
  'Coverage definitions, exclusions, waiting periods, claim limits by policy type',
  'table',
  'direct_db',
  'Curated by insurance admins; versioned for compliance',
  '{"table": "insurance_coverage_rules", "versioned": true, "compliance_checked": true}'::jsonb
FROM public.ai_agents WHERE slug = 'insurance';

INSERT INTO public.ai_agent_knowledge_bases (agent_id, code, name, description, storage_type, access_method, update_strategy, config)
SELECT 
  id,
  'ocr_document_cache',
  'Processed Document Cache',
  'OCR-extracted data from uploaded documents (IDs, licenses, registrations)',
  'table',
  'tool:ocr_process_document',
  'Populated on document upload; TTL-based cleanup',
  '{"table": "insurance_documents_ocr", "ttl_days": 90, "pii_encrypted": true}'::jsonb
FROM public.ai_agents WHERE slug = 'insurance';

COMMIT;
