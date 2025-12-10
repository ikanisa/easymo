-- =====================================================================
-- AI AGENT COMPREHENSIVE INTEGRATION
-- =====================================================================
-- Links all AI agents with their personas, system instructions, tools,
-- tasks, and knowledge bases from existing tables
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. LINK AI AGENTS WITH THEIR PERSONAS
-- =====================================================================

UPDATE public.ai_agents
SET persona_id = (SELECT id FROM ai_agent_personas WHERE code = 'W-PERSONA' LIMIT 1)
WHERE slug = 'waiter' AND persona_id IS NULL;

UPDATE public.ai_agents
SET persona_id = (SELECT id FROM ai_agent_personas WHERE code = 'F-PERSONA' LIMIT 1)
WHERE slug = 'farmer' AND persona_id IS NULL;

UPDATE public.ai_agents
SET persona_id = (SELECT id FROM ai_agent_personas WHERE code = 'BB-PERSONA' LIMIT 1)
WHERE slug = 'business_broker' AND persona_id IS NULL;

UPDATE public.ai_agents
SET persona_id = (SELECT id FROM ai_agent_personas WHERE code = 'RE-PERSONA' LIMIT 1)
WHERE slug = 'real_estate' AND persona_id IS NULL;

UPDATE public.ai_agents
SET persona_id = (SELECT id FROM ai_agent_personas WHERE code = 'J-PERSONA' LIMIT 1)
WHERE slug = 'jobs' AND persona_id IS NULL;

UPDATE public.ai_agents
SET persona_id = (SELECT id FROM ai_agent_personas WHERE code = 'SC-PERSONA' LIMIT 1)
WHERE slug = 'sales_cold_caller' AND persona_id IS NULL;

UPDATE public.ai_agents
SET persona_id = (SELECT id FROM ai_agent_personas WHERE code = 'MA-PERSONA' LIMIT 1)
WHERE slug = 'marketplace' AND persona_id IS NULL;

UPDATE public.ai_agents
SET persona_id = (SELECT id FROM ai_agent_personas WHERE code = 'S-PERSONA' LIMIT 1)
WHERE slug = 'support' AND persona_id IS NULL;

-- =====================================================================
-- 2. LINK AI AGENTS WITH SYSTEM INSTRUCTIONS
-- =====================================================================

UPDATE public.ai_agents
SET system_instructions_id = (SELECT id FROM ai_agent_system_instructions WHERE code = 'W-SYS' LIMIT 1)
WHERE slug = 'waiter' AND system_instructions_id IS NULL;

UPDATE public.ai_agents
SET system_instructions_id = (SELECT id FROM ai_agent_system_instructions WHERE code = 'F-SYS' LIMIT 1)
WHERE slug = 'farmer' AND system_instructions_id IS NULL;

UPDATE public.ai_agents
SET system_instructions_id = (SELECT id FROM ai_agent_system_instructions WHERE code = 'BB-SYS' LIMIT 1)
WHERE slug = 'business_broker' AND system_instructions_id IS NULL;

UPDATE public.ai_agents
SET system_instructions_id = (SELECT id FROM ai_agent_system_instructions WHERE code = 'RE-SYS' LIMIT 1)
WHERE slug = 'real_estate' AND system_instructions_id IS NULL;

UPDATE public.ai_agents
SET system_instructions_id = (SELECT id FROM ai_agent_system_instructions WHERE code = 'J-SYS' LIMIT 1)
WHERE slug = 'jobs' AND system_instructions_id IS NULL;

UPDATE public.ai_agents
SET system_instructions_id = (SELECT id FROM ai_agent_system_instructions WHERE code = 'SC-SYS' LIMIT 1)
WHERE slug = 'sales_cold_caller' AND system_instructions_id IS NULL;

UPDATE public.ai_agents
SET system_instructions_id = (SELECT id FROM ai_agent_system_instructions WHERE code = 'M-SYS' LIMIT 1)
WHERE slug = 'marketplace' AND system_instructions_id IS NULL;

UPDATE public.ai_agents
SET system_instructions_id = (SELECT id FROM ai_agent_system_instructions WHERE code = 'S-SYS' LIMIT 1)
WHERE slug = 'support' AND system_instructions_id IS NULL;

-- =====================================================================
-- 3. CREATE AGENT-TOOL ASSOCIATIONS (Many-to-Many)
-- =====================================================================

CREATE TABLE IF NOT EXISTS ai_agent_tool_associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  tool_id uuid NOT NULL REFERENCES ai_agent_tools(id) ON DELETE CASCADE,
  is_required boolean DEFAULT false,
  execution_priority integer DEFAULT 0,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  UNIQUE(agent_id, tool_id)
);

-- Waiter Agent Tools
INSERT INTO ai_agent_tool_associations (agent_id, tool_id, is_required, execution_priority)
SELECT 
  a.id,
  t.id,
  CASE WHEN t.slug IN ('get_menu', 'create_order', 'check_table_availability') THEN true ELSE false END,
  CASE t.slug
    WHEN 'get_menu' THEN 1
    WHEN 'create_order' THEN 2
    WHEN 'check_table_availability' THEN 3
    WHEN 'process_payment' THEN 4
    ELSE 5
  END
FROM ai_agents a, ai_agent_tools t
WHERE a.slug = 'waiter'
  AND t.slug IN ('get_menu', 'create_order', 'check_table_availability', 'process_payment', 'update_order_status')
ON CONFLICT (agent_id, tool_id) DO NOTHING;

-- Farmer Agent Tools
INSERT INTO ai_agent_tool_associations (agent_id, tool_id, is_required, execution_priority)
SELECT 
  a.id,
  t.id,
  CASE WHEN t.slug IN ('create_produce_listing', 'search_buyers') THEN true ELSE false END,
  CASE t.slug
    WHEN 'create_produce_listing' THEN 1
    WHEN 'search_buyers' THEN 2
    WHEN 'price_estimator' THEN 3
    WHEN 'coordinate_pickup' THEN 4
    ELSE 5
  END
FROM ai_agents a, ai_agent_tools t
WHERE a.slug = 'farmer'
  AND t.slug IN ('create_produce_listing', 'search_buyers', 'price_estimator', 'coordinate_pickup', 'log_transaction')
ON CONFLICT (agent_id, tool_id) DO NOTHING;

-- Business Broker Agent Tools
INSERT INTO ai_agent_tool_associations (agent_id, tool_id, is_required, execution_priority)
SELECT 
  a.id,
  t.id,
  CASE WHEN t.slug IN ('search_businesses', 'get_location') THEN true ELSE false END,
  CASE t.slug
    WHEN 'get_location' THEN 1
    WHEN 'search_businesses' THEN 2
    WHEN 'get_directions' THEN 3
    WHEN 'check_availability' THEN 4
    ELSE 5
  END
FROM ai_agents a, ai_agent_tools t
WHERE a.slug = 'business_broker'
  AND t.slug IN ('search_businesses', 'get_location', 'get_directions', 'check_availability', 'save_favorite')
ON CONFLICT (agent_id, tool_id) DO NOTHING;

-- Real Estate Agent Tools
INSERT INTO ai_agent_tool_associations (agent_id, tool_id, is_required, execution_priority)
SELECT 
  a.id,
  t.id,
  CASE WHEN t.slug IN ('search_properties', 'store_user_profile') THEN true ELSE false END,
  CASE t.slug
    WHEN 'store_user_profile' THEN 1
    WHEN 'search_properties' THEN 2
    WHEN 'contact_owner' THEN 3
    WHEN 'schedule_viewing' THEN 4
    WHEN 'external_property_search' THEN 5
    ELSE 6
  END
FROM ai_agents a, ai_agent_tools t
WHERE a.slug = 'real_estate'
  AND t.slug IN ('search_properties', 'store_user_profile', 'contact_owner', 'schedule_viewing', 'external_property_search', 'negotiate_price')
ON CONFLICT (agent_id, tool_id) DO NOTHING;

-- Jobs Agent Tools
INSERT INTO ai_agent_tool_associations (agent_id, tool_id, is_required, execution_priority)
SELECT 
  a.id,
  t.id,
  CASE WHEN t.slug IN ('search_jobs', 'create_job_seeker_profile') THEN true ELSE false END,
  CASE t.slug
    WHEN 'create_job_seeker_profile' THEN 1
    WHEN 'search_jobs' THEN 2
    WHEN 'match_jobs' THEN 3
    WHEN 'external_job_search' THEN 4
    WHEN 'notify_matches' THEN 5
    ELSE 6
  END
FROM ai_agents a, ai_agent_tools t
WHERE a.slug = 'jobs'
  AND t.slug IN ('search_jobs', 'create_job_seeker_profile', 'match_jobs', 'external_job_search', 'notify_matches', 'post_job')
ON CONFLICT (agent_id, tool_id) DO NOTHING;

-- Sales Cold Caller Agent Tools
INSERT INTO ai_agent_tool_associations (agent_id, tool_id, is_required, execution_priority)
SELECT 
  a.id,
  t.id,
  CASE WHEN t.slug IN ('enrich_lead_data', 'make_voice_call') THEN true ELSE false END,
  CASE t.slug
    WHEN 'enrich_lead_data' THEN 1
    WHEN 'make_voice_call' THEN 2
    WHEN 'send_whatsapp_message' THEN 3
    WHEN 'log_call_outcome' THEN 4
    WHEN 'schedule_demo' THEN 5
    ELSE 6
  END
FROM ai_agents a, ai_agent_tools t
WHERE a.slug = 'sales_cold_caller'
  AND t.slug IN ('enrich_lead_data', 'make_voice_call', 'send_whatsapp_message', 'log_call_outcome', 'schedule_demo', 'qualify_lead')
ON CONFLICT (agent_id, tool_id) DO NOTHING;

-- =====================================================================
-- 4. CREATE AGENT-TASK ASSOCIATIONS (Many-to-Many)
-- =====================================================================

CREATE TABLE IF NOT EXISTS ai_agent_task_associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES ai_agent_tasks(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  execution_order integer DEFAULT 0,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  UNIQUE(agent_id, task_id)
);

-- Link tasks to agents based on their slugs
INSERT INTO ai_agent_task_associations (agent_id, task_id, is_primary, execution_order)
SELECT DISTINCT
  a.id as agent_id,
  t.id as task_id,
  t.is_primary,
  t.execution_order
FROM ai_agents a
CROSS JOIN ai_agent_tasks t
WHERE (
  (a.slug = 'waiter' AND t.category IN ('ordering', 'menu', 'payment', 'reservation'))
  OR (a.slug = 'farmer' AND t.category IN ('listing', 'matching', 'pricing', 'logistics'))
  OR (a.slug = 'business_broker' AND t.category IN ('search', 'discovery', 'connection'))
  OR (a.slug = 'real_estate' AND t.category IN ('search', 'negotiation', 'viewing', 'rental'))
  OR (a.slug = 'jobs' AND t.category IN ('matching', 'search', 'notification', 'application'))
  OR (a.slug = 'sales_cold_caller' AND t.category IN ('prospecting', 'calling', 'qualification', 'scheduling'))
)
ON CONFLICT (agent_id, task_id) DO NOTHING;

-- =====================================================================
-- 5. CREATE AGENT-KNOWLEDGE BASE ASSOCIATIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS ai_agent_kb_associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  knowledge_base_id uuid NOT NULL REFERENCES ai_agent_knowledge_bases(id) ON DELETE CASCADE,
  access_level text DEFAULT 'read',
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  UNIQUE(agent_id, knowledge_base_id)
);

-- Link knowledge bases to agents
INSERT INTO ai_agent_kb_associations (agent_id, knowledge_base_id, access_level, priority)
SELECT DISTINCT
  a.id as agent_id,
  kb.id as knowledge_base_id,
  'read' as access_level,
  CASE 
    WHEN kb.kb_type = 'domain_knowledge' THEN 1
    WHEN kb.kb_type = 'procedural' THEN 2
    WHEN kb.kb_type = 'faq' THEN 3
    WHEN kb.kb_type = 'contextual' THEN 4
    ELSE 5
  END as priority
FROM ai_agents a
CROSS JOIN ai_agent_knowledge_bases kb
WHERE (
  (a.slug = 'waiter' AND kb.category IN ('menu', 'service', 'payment', 'allergens'))
  OR (a.slug = 'farmer' AND kb.category IN ('agriculture', 'pricing', 'logistics', 'markets'))
  OR (a.slug = 'business_broker' AND kb.category IN ('businesses', 'services', 'locations'))
  OR (a.slug = 'real_estate' AND kb.category IN ('properties', 'rental', 'regulations'))
  OR (a.slug = 'jobs' AND kb.category IN ('jobs', 'skills', 'industries', 'employers'))
  OR (a.slug = 'sales_cold_caller' AND kb.category IN ('sales', 'products', 'objections', 'scripts'))
)
ON CONFLICT (agent_id, knowledge_base_id) DO NOTHING;

-- =====================================================================
-- 6. UPDATE AGENT CONFIGS WITH INTEGRATION STATUS
-- =====================================================================

UPDATE ai_agent_configs
SET 
  config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{integration}',
    jsonb_build_object(
      'personas_linked', true,
      'system_instructions_linked', true,
      'tools_linked', true,
      'tasks_linked', true,
      'knowledge_bases_linked', true,
      'integrated_at', NOW()
    )
  ),
  updated_at = NOW()
WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug IN (
  'waiter', 'farmer', 'business_broker', 'real_estate', 'jobs', 'sales_cold_caller', 'marketplace', 'support'
));

-- =====================================================================
-- 7. CREATE INDEXES FOR PERFORMANCE
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_agent_tool_assoc_agent ON ai_agent_tool_associations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_assoc_tool ON ai_agent_tool_associations(tool_id);
CREATE INDEX IF NOT EXISTS idx_agent_task_assoc_agent ON ai_agent_task_associations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_task_assoc_task ON ai_agent_task_associations(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_kb_assoc_agent ON ai_agent_kb_associations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_kb_assoc_kb ON ai_agent_kb_associations(knowledge_base_id);

-- =====================================================================
-- 8. CREATE VIEW FOR COMPLETE AGENT CONFIGURATIONS
-- =====================================================================

CREATE OR REPLACE VIEW ai_agents_complete_config AS
SELECT 
  a.id,
  a.name,
  a.slug,
  a.description,
  a.status,
  a.default_language,
  a.default_channel,
  
  -- Persona
  p.role_name as persona_role,
  p.tone_style as persona_tone,
  p.languages as persona_languages,
  p.traits as persona_traits,
  
  -- System Instructions
  si.title as system_instructions_title,
  si.instructions,
  si.guardrails,
  si.memory_strategy,
  
  -- Aggregated Tools
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'slug', t.slug,
        'description', t.description,
        'category', t.category,
        'is_required', ata.is_required,
        'priority', ata.execution_priority
      ) ORDER BY ata.execution_priority
    )
    FROM ai_agent_tool_associations ata
    JOIN ai_agent_tools t ON t.id = ata.tool_id
    WHERE ata.agent_id = a.id
  ) as tools,
  
  -- Aggregated Tasks
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', tk.id,
        'name', tk.name,
        'description', tk.description,
        'category', tk.category,
        'is_primary', atka.is_primary,
        'order', atka.execution_order
      ) ORDER BY atka.execution_order
    )
    FROM ai_agent_task_associations atka
    JOIN ai_agent_tasks tk ON tk.id = atka.task_id
    WHERE atka.agent_id = a.id
  ) as tasks,
  
  -- Aggregated Knowledge Bases
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', kb.id,
        'name', kb.name,
        'kb_type', kb.kb_type,
        'category', kb.category,
        'access_level', akba.access_level,
        'priority', akba.priority
      ) ORDER BY akba.priority
    )
    FROM ai_agent_kb_associations akba
    JOIN ai_agent_knowledge_bases kb ON kb.id = akba.knowledge_base_id
    WHERE akba.agent_id = a.id
  ) as knowledge_bases,
  
  -- Config
  ac.config,
  
  a.created_at,
  a.updated_at
FROM ai_agents a
LEFT JOIN ai_agent_personas p ON p.id = a.persona_id
LEFT JOIN ai_agent_system_instructions si ON si.id = a.system_instructions_id
LEFT JOIN ai_agent_configs ac ON ac.agent_id = a.id
WHERE a.status = 'active';

COMMENT ON VIEW ai_agents_complete_config IS 
'Complete AI agent configurations including personas, system instructions, tools, tasks, and knowledge bases';

COMMIT;

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================

-- Check agent integrations
-- SELECT name, slug, 
--   CASE WHEN persona_id IS NOT NULL THEN '✓' ELSE '✗' END as has_persona,
--   CASE WHEN system_instructions_id IS NOT NULL THEN '✓' ELSE '✗' END as has_instructions
-- FROM ai_agents ORDER BY name;

-- Check agent tools count
-- SELECT a.name, COUNT(ata.id) as tool_count
-- FROM ai_agents a
-- LEFT JOIN ai_agent_tool_associations ata ON ata.agent_id = a.id
-- GROUP BY a.id, a.name ORDER BY a.name;

-- View complete agent config
-- SELECT * FROM ai_agents_complete_config WHERE slug = 'waiter';
