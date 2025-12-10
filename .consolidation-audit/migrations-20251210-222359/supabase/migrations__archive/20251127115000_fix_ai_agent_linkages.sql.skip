-- =====================================================================
-- FIX AI AGENT DATA LINKAGE - Connect Existing Data to Agents
-- =====================================================================
-- This migration ensures all existing personas, instructions, tools,
-- tasks, and knowledge bases are properly linked to their agents
-- by agent_id foreign keys.
--
-- The comprehensive data exists but may have wrong/missing agent_id links
-- This fixes the linkage based on code patterns and slugs
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. FIX PERSONA LINKAGES
-- =====================================================================

-- Link personas to agents based on code patterns
-- W-PERSONA -> waiter, F-PERSONA -> farmer, etc.

UPDATE public.ai_agent_personas
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'waiter')
WHERE code LIKE 'W-%' OR code LIKE 'waiter%';

UPDATE public.ai_agent_personas
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'farmer')
WHERE code LIKE 'F-%' OR code LIKE 'farmer%';

UPDATE public.ai_agent_personas
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'broker')
WHERE code LIKE 'BB-%' OR code LIKE 'broker%' OR code LIKE 'business_broker%';

UPDATE public.ai_agent_personas
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'real_estate')
WHERE code LIKE 'RE-%' OR code LIKE 'real_estate%';

UPDATE public.ai_agent_personas
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'jobs')
WHERE code LIKE 'J-%' OR code LIKE 'jobs%';

UPDATE public.ai_agent_personas
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'sales_cold_caller')
WHERE code LIKE 'SDR-%' OR code LIKE 'sales%';

UPDATE public.ai_agent_personas
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'rides')
WHERE code LIKE 'R-%' OR code LIKE 'rides%' OR code LIKE 'mobility%';

UPDATE public.ai_agent_personas
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'insurance')
WHERE code LIKE 'INS-%' OR code LIKE 'insurance%';

-- =====================================================================
-- 2. FIX SYSTEM INSTRUCTIONS LINKAGES
-- =====================================================================

UPDATE public.ai_agent_system_instructions
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'waiter')
WHERE code LIKE 'W-%' OR code LIKE 'waiter%';

UPDATE public.ai_agent_system_instructions
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'farmer')
WHERE code LIKE 'F-%' OR code LIKE 'farmer%';

UPDATE public.ai_agent_system_instructions
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'broker')
WHERE code LIKE 'BB-%' OR code LIKE 'broker%' OR code LIKE 'business_broker%';

UPDATE public.ai_agent_system_instructions
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'real_estate')
WHERE code LIKE 'RE-%' OR code LIKE 'real_estate%';

UPDATE public.ai_agent_system_instructions
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'jobs')
WHERE code LIKE 'J-%' OR code LIKE 'jobs%';

UPDATE public.ai_agent_system_instructions
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'sales_cold_caller')
WHERE code LIKE 'SDR-%' OR code LIKE 'sales%';

UPDATE public.ai_agent_system_instructions
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'rides')
WHERE code LIKE 'R-%' OR code LIKE 'rides%' OR code LIKE 'mobility%';

UPDATE public.ai_agent_system_instructions
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'insurance')
WHERE code LIKE 'INS-%' OR code LIKE 'insurance%';

-- =====================================================================
-- 3. FIX TOOLS LINKAGES (by tool name patterns)
-- =====================================================================

-- Waiter tools
UPDATE public.ai_agent_tools
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'waiter')
WHERE name IN ('search_menu_supabase', 'momo_charge', 'send_order', 'lookup_loyalty', 'book_table', 'sora_generate_video')
  OR name LIKE 'waiter_%'
  OR name LIKE 'menu_%';

-- Farmer tools
UPDATE public.ai_agent_tools
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'farmer')
WHERE name IN ('list_produce', 'match_buyer', 'schedule_pickup', 'weather_api', 'price_check')
  OR name LIKE 'farmer_%'
  OR name LIKE 'produce_%'
  OR name LIKE 'crop_%';

-- Business Broker tools
UPDATE public.ai_agent_tools
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'broker')
WHERE name IN ('search_business_directory', 'send_offers', 'map_nearby', 'call_vendor')
  OR name LIKE 'broker_%'
  OR name LIKE 'business_%'
  OR name LIKE 'vendor_%';

-- Real Estate tools
UPDATE public.ai_agent_tools
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'real_estate')
WHERE name IN ('search_properties', 'contact_landlord', 'schedule_viewing', 'negotiation_assistant')
  OR name LIKE 'property_%'
  OR name LIKE 'real_estate_%'
  OR name LIKE 'rental_%';

-- Jobs tools
UPDATE public.ai_agent_tools
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'jobs')
WHERE name IN ('search_jobs', 'parse_cv', 'match_jobs', 'notify_matches', 'deepsearch_jobs')
  OR name LIKE 'job_%'
  OR name LIKE 'cv_%'
  OR name LIKE 'employment_%';

-- Sales tools
UPDATE public.ai_agent_tools
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'sales_cold_caller')
WHERE name IN ('enrich_lead', 'log_call', 'send_email', 'book_demo')
  OR name LIKE 'sales_%'
  OR name LIKE 'lead_%'
  OR name LIKE 'crm_%';

-- Rides tools
UPDATE public.ai_agent_tools
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'rides')
WHERE name IN ('find_driver', 'find_passenger', 'calculate_fare', 'track_trip')
  OR name LIKE 'ride_%'
  OR name LIKE 'trip_%'
  OR name LIKE 'driver_%'
  OR name LIKE 'mobility_%';

-- Insurance tools
UPDATE public.ai_agent_tools
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'insurance')
WHERE name IN ('get_quote', 'submit_claim', 'check_policy', 'renew_policy', 'ocr_document')
  OR name LIKE 'insurance_%'
  OR name LIKE 'policy_%'
  OR name LIKE 'claim_%';

-- =====================================================================
-- 4. FIX TASKS LINKAGES
-- =====================================================================

UPDATE public.ai_agent_tasks
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'waiter')
WHERE code LIKE 'W-%' OR code LIKE 'waiter%';

UPDATE public.ai_agent_tasks
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'farmer')
WHERE code LIKE 'F-%' OR code LIKE 'farmer%';

UPDATE public.ai_agent_tasks
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'broker')
WHERE code LIKE 'BB-%' OR code LIKE 'broker%';

UPDATE public.ai_agent_tasks
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'real_estate')
WHERE code LIKE 'RE-%' OR code LIKE 'real_estate%';

UPDATE public.ai_agent_tasks
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'jobs')
WHERE code LIKE 'J-%' OR code LIKE 'jobs%';

UPDATE public.ai_agent_tasks
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'sales_cold_caller')
WHERE code LIKE 'SDR-%' OR code LIKE 'sales%';

UPDATE public.ai_agent_tasks
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'rides')
WHERE code LIKE 'R-%' OR code LIKE 'rides%' OR code LIKE 'mobility%';

UPDATE public.ai_agent_tasks
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'insurance')
WHERE code LIKE 'INS-%' OR code LIKE 'insurance%';

-- =====================================================================
-- 5. FIX KNOWLEDGE BASES LINKAGES
-- =====================================================================

UPDATE public.ai_agent_knowledge_bases
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'waiter')
WHERE code LIKE 'W-%' OR code LIKE 'waiter%' OR name LIKE '%menu%' OR name LIKE '%restaurant%';

UPDATE public.ai_agent_knowledge_bases
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'farmer')
WHERE code LIKE 'F-%' OR code LIKE 'farmer%' OR name LIKE '%produce%' OR name LIKE '%crop%';

UPDATE public.ai_agent_knowledge_bases
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'broker')
WHERE code LIKE 'BB-%' OR code LIKE 'broker%' OR name LIKE '%business%' OR name LIKE '%vendor%';

UPDATE public.ai_agent_knowledge_bases
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'real_estate')
WHERE code LIKE 'RE-%' OR code LIKE 'real_estate%' OR name LIKE '%property%' OR name LIKE '%rental%';

UPDATE public.ai_agent_knowledge_bases
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'jobs')
WHERE code LIKE 'J-%' OR code LIKE 'jobs%' OR name LIKE '%job%' OR name LIKE '%cv%';

UPDATE public.ai_agent_knowledge_bases
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'sales_cold_caller')
WHERE code LIKE 'SDR-%' OR code LIKE 'sales%' OR name LIKE '%lead%' OR name LIKE '%prospect%';

UPDATE public.ai_agent_knowledge_bases
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'rides')
WHERE code LIKE 'R-%' OR code LIKE 'rides%' OR name LIKE '%trip%' OR name LIKE '%driver%';

UPDATE public.ai_agent_knowledge_bases
SET agent_id = (SELECT id FROM public.ai_agents WHERE slug = 'insurance')
WHERE code LIKE 'INS-%' OR code LIKE 'insurance%' OR name LIKE '%policy%' OR name LIKE '%claim%';

-- =====================================================================
-- 6. VERIFICATION: Show linkage counts
-- =====================================================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '=== AI AGENT LINKAGE SUMMARY ===';
  
  FOR rec IN (
    SELECT 
      a.slug,
      a.name,
      COUNT(DISTINCT p.id) as personas,
      COUNT(DISTINCT si.id) as instructions,
      COUNT(DISTINCT t.id) as tools,
      COUNT(DISTINCT tk.id) as tasks,
      COUNT(DISTINCT kb.id) as knowledge_bases
    FROM ai_agents a
    LEFT JOIN ai_agent_personas p ON p.agent_id = a.id
    LEFT JOIN ai_agent_system_instructions si ON si.agent_id = a.id
    LEFT JOIN ai_agent_tools t ON t.agent_id = a.id
    LEFT JOIN ai_agent_tasks tk ON tk.agent_id = a.id
    LEFT JOIN ai_agent_knowledge_bases kb ON kb.agent_id = a.id
    GROUP BY a.slug, a.name
    ORDER BY a.slug
  ) LOOP
    RAISE NOTICE '% (%): % personas, % instructions, % tools, % tasks, % KBs',
      rec.name, rec.slug, rec.personas, rec.instructions, rec.tools, rec.tasks, rec.knowledge_bases;
  END LOOP;
  
  RAISE NOTICE '=== END SUMMARY ===';
END $$;

COMMIT;

-- =====================================================================
-- VERIFICATION QUERIES (run after migration)
-- =====================================================================
/*
-- Check all agents have their data linked
SELECT 
  a.slug,
  a.name,
  COUNT(DISTINCT p.id) as personas,
  COUNT(DISTINCT si.id) as system_instructions,
  COUNT(DISTINCT t.id) as tools,
  COUNT(DISTINCT tk.id) as tasks,
  COUNT(DISTINCT kb.id) as knowledge_bases,
  CASE 
    WHEN COUNT(DISTINCT p.id) > 0 
      AND COUNT(DISTINCT si.id) > 0 
      AND COUNT(DISTINCT t.id) > 0 
    THEN '✅ COMPLETE'
    ELSE '⚠️ INCOMPLETE'
  END as status
FROM ai_agents a
LEFT JOIN ai_agent_personas p ON p.agent_id = a.id
LEFT JOIN ai_agent_system_instructions si ON si.agent_id = a.id
LEFT JOIN ai_agent_tools t ON t.agent_id = a.id
LEFT JOIN ai_agent_tasks tk ON tk.agent_id = a.id
LEFT JOIN ai_agent_knowledge_bases kb ON kb.agent_id = a.id
GROUP BY a.id, a.slug, a.name
ORDER BY a.slug;
*/
