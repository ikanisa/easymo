-- =====================================================================
-- SHORT-TERM ENHANCEMENTS: Add More Tools to Agents
-- =====================================================================
-- This script adds commonly requested tools to existing agents
-- Apply after: Database migration 20251201102239
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. ADD WEATHER TOOL TO ALL AGENTS
-- =====================================================================
-- Useful for context-aware responses (farming, rides, property viewings)

DO $$
DECLARE
  agent_rec RECORD;
BEGIN
  FOR agent_rec IN 
    SELECT id, slug FROM ai_agents WHERE is_active = true
  LOOP
    INSERT INTO ai_agent_tools (
      agent_id, name, display_name, tool_type, description, 
      input_schema, config, is_active
    )
    SELECT 
      agent_rec.id,
      'get_weather',
      'Get Weather Information',
      'http',
      'Get current weather and forecast for a location',
      jsonb_build_object(
        'type', 'object',
        'properties', jsonb_build_object(
          'location', jsonb_build_object('type', 'string'),
          'days', jsonb_build_object('type', 'integer', 'default', 3)
        )
      ),
      jsonb_build_object(
        'endpoint', 'https://api.openweathermap.org/data/2.5/weather',
        'method', 'GET',
        'api_key_env', 'OPENWEATHER_API_KEY'
      ),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM ai_agent_tools 
      WHERE agent_id = agent_rec.id AND name = 'get_weather'
    );
  END LOOP;
END $$;

-- =====================================================================
-- 2. ADD TRANSLATION TOOL TO SUPPORT AGENT
-- =====================================================================

INSERT INTO ai_agent_tools (
  agent_id, name, display_name, tool_type, description,
  input_schema, config, is_active
)
SELECT 
  id,
  'translate_text',
  'Translate Text',
  'http',
  'Translate text between languages (en, fr, rw, sw)',
  jsonb_build_object(
    'type', 'object',
    'required', ARRAY['text', 'target_language'],
    'properties', jsonb_build_object(
      'text', jsonb_build_object('type', 'string'),
      'target_language', jsonb_build_object(
        'type', 'string',
        'enum', ARRAY['en', 'fr', 'rw', 'sw']
      ),
      'source_language', jsonb_build_object('type', 'string')
    )
  ),
  jsonb_build_object(
    'endpoint', 'https://translation.googleapis.com/language/translate/v2',
    'method', 'POST',
    'api_key_env', 'GOOGLE_TRANSLATE_API_KEY'
  ),
  true
FROM ai_agents
WHERE slug = 'support'
  AND NOT EXISTS (
    SELECT 1 FROM ai_agent_tools 
    WHERE agent_id = (SELECT id FROM ai_agents WHERE slug = 'support')
      AND name = 'translate_text'
  );

-- =====================================================================
-- 3. ADD SMS NOTIFICATION TOOL TO SUPPORT & MARKETPLACE
-- =====================================================================

INSERT INTO ai_agent_tools (
  agent_id, name, display_name, tool_type, description,
  input_schema, config, is_active
)
SELECT 
  id,
  'send_sms_notification',
  'Send SMS Notification',
  'external',
  'Send SMS notification to user via Twilio',
  jsonb_build_object(
    'type', 'object',
    'required', ARRAY['phone_number', 'message'],
    'properties', jsonb_build_object(
      'phone_number', jsonb_build_object('type', 'string'),
      'message', jsonb_build_object('type', 'string', 'maxLength', 160)
    )
  ),
  jsonb_build_object(
    'provider', 'twilio',
    'endpoint', 'https://api.twilio.com/2010-04-01/Accounts/{ACCOUNT_SID}/Messages.json',
    'method', 'POST'
  ),
  true
FROM ai_agents
WHERE slug IN ('support', 'marketplace')
  AND NOT EXISTS (
    SELECT 1 FROM ai_agent_tools t
    WHERE t.agent_id = ai_agents.id AND t.name = 'send_sms_notification'
  );

-- =====================================================================
-- 4. ADD IMAGE PROCESSING TOOL TO MARKETPLACE & REAL ESTATE
-- =====================================================================

INSERT INTO ai_agent_tools (
  agent_id, name, display_name, tool_type, description,
  input_schema, config, is_active
)
SELECT 
  id,
  'process_image',
  'Process and Analyze Image',
  'external',
  'Analyze uploaded images for listings (quality, content, moderation)',
  jsonb_build_object(
    'type', 'object',
    'required', ARRAY['image_url'],
    'properties', jsonb_build_object(
      'image_url', jsonb_build_object('type', 'string', 'format', 'uri'),
      'analysis_type', jsonb_build_object(
        'type', 'string',
        'enum', ARRAY['quality', 'content', 'moderation']
      )
    )
  ),
  jsonb_build_object(
    'provider', 'google_vision',
    'endpoint', 'https://vision.googleapis.com/v1/images:annotate',
    'features', ARRAY['LABEL_DETECTION', 'SAFE_SEARCH_DETECTION', 'IMAGE_PROPERTIES']
  ),
  true
FROM ai_agents
WHERE slug IN ('marketplace', 'real_estate')
  AND NOT EXISTS (
    SELECT 1 FROM ai_agent_tools t
    WHERE t.agent_id = ai_agents.id AND t.name = 'process_image'
  );

-- =====================================================================
-- 5. ADD LOCATION GEOCODING TOOL TO RIDES, REAL ESTATE, MARKETPLACE
-- =====================================================================

INSERT INTO ai_agent_tools (
  agent_id, name, display_name, tool_type, description,
  input_schema, config, is_active
)
SELECT 
  id,
  'geocode_address',
  'Geocode Address',
  'http',
  'Convert address to GPS coordinates or vice versa',
  jsonb_build_object(
    'type', 'object',
    'properties', jsonb_build_object(
      'address', jsonb_build_object('type', 'string'),
      'lat', jsonb_build_object('type', 'number'),
      'lng', jsonb_build_object('type', 'number')
    )
  ),
  jsonb_build_object(
    'endpoint', 'https://maps.googleapis.com/maps/api/geocode/json',
    'method', 'GET',
    'api_key_env', 'GOOGLE_MAPS_API_KEY'
  ),
  true
FROM ai_agents
WHERE slug IN ('rides', 'real_estate', 'marketplace')
  AND NOT EXISTS (
    SELECT 1 FROM ai_agent_tools t
    WHERE t.agent_id = ai_agents.id AND t.name = 'geocode_address'
  );

-- =====================================================================
-- 6. ADD CALENDAR/SCHEDULING TOOL TO JOBS & REAL ESTATE
-- =====================================================================

INSERT INTO ai_agent_tools (
  agent_id, name, display_name, tool_type, description,
  input_schema, config, is_active
)
SELECT 
  id,
  'schedule_appointment',
  'Schedule Appointment',
  'db',
  'Schedule appointments (interviews, property viewings, etc.)',
  jsonb_build_object(
    'type', 'object',
    'required', ARRAY['date', 'time', 'type'],
    'properties', jsonb_build_object(
      'date', jsonb_build_object('type', 'string', 'format', 'date'),
      'time', jsonb_build_object('type', 'string', 'format', 'time'),
      'type', jsonb_build_object(
        'type', 'string',
        'enum', ARRAY['interview', 'viewing', 'consultation']
      ),
      'duration_minutes', jsonb_build_object('type', 'integer', 'default', 30),
      'notes', jsonb_build_object('type', 'string')
    )
  ),
  jsonb_build_object(
    'table', 'appointments',
    'operation', 'insert'
  ),
  true
FROM ai_agents
WHERE slug IN ('jobs', 'real_estate')
  AND NOT EXISTS (
    SELECT 1 FROM ai_agent_tools t
    WHERE t.agent_id = ai_agents.id AND t.name = 'schedule_appointment'
  );

-- =====================================================================
-- VERIFICATION QUERY
-- =====================================================================

-- Check newly added tools
SELECT 
  a.slug,
  a.name,
  COUNT(DISTINCT t.id) FILTER (WHERE t.created_at > NOW() - INTERVAL '5 minutes') as new_tools,
  COUNT(DISTINCT t.id) as total_tools
FROM ai_agents a
LEFT JOIN ai_agent_tools t ON t.agent_id = a.id AND t.is_active = true
WHERE a.is_active = true
GROUP BY a.slug, a.name
ORDER BY a.slug;

COMMIT;

-- =====================================================================
-- POST-DEPLOYMENT NOTES
-- =====================================================================
-- 
-- NEW TOOLS ADDED:
-- 1. get_weather - All agents (9 agents)
-- 2. translate_text - Support agent
-- 3. send_sms_notification - Support, Marketplace (2 agents)
-- 4. process_image - Marketplace, Real Estate (2 agents)
-- 5. geocode_address - Rides, Real Estate, Marketplace (3 agents)
-- 6. schedule_appointment - Jobs, Real Estate (2 agents)
--
-- TOTAL NEW TOOLS: ~20 tools added
--
-- REQUIRED ENV VARS:
-- - OPENWEATHER_API_KEY - For weather data
-- - GOOGLE_TRANSLATE_API_KEY - For translation
-- - TWILIO_ACCOUNT_SID - For SMS
-- - TWILIO_AUTH_TOKEN - For SMS
-- - GOOGLE_MAPS_API_KEY - For geocoding
--
-- NEXT: Update tool-executor.ts to implement these tool types
-- =====================================================================
