-- Migration: 20251210_delete_rides_ai_agent
BEGIN;

-- 1. Delete from ai_agents and cascade
DELETE FROM ai_agent_tools WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'rides');
DELETE FROM ai_agent_tasks WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'rides');
DELETE FROM ai_agent_personas WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'rides');
DELETE FROM ai_agent_system_instructions WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'rides');
DELETE FROM ai_agent_knowledge_bases WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug = 'rides');

DO $$
DECLARE
  ref RECORD;
  fallback_id UUID := (SELECT id FROM ai_agents WHERE slug = 'support');
BEGIN
  IF fallback_id IS NULL THEN
    RAISE NOTICE 'Support agent not found; references will not be reassigned';
  END IF;

  FOR ref IN
    SELECT kcu.table_schema, kcu.table_name, kcu.column_name
    FROM information_schema.key_column_usage kcu
    JOIN information_schema.referential_constraints rc
      ON kcu.constraint_name = rc.constraint_name
      AND kcu.constraint_schema = rc.constraint_schema
    JOIN information_schema.table_constraints pk
      ON rc.unique_constraint_name = pk.constraint_name
      AND rc.unique_constraint_schema = pk.constraint_schema
    WHERE pk.table_name = 'ai_agents'
      AND kcu.table_name != 'ai_agents'
  LOOP
    IF fallback_id IS NOT NULL THEN
      EXECUTE format(
        'UPDATE %I.%I SET %I = %L WHERE %I IN (SELECT id FROM ai_agents WHERE slug = ''rides'')',
        ref.table_schema,
        ref.table_name,
        ref.column_name,
        fallback_id,
        ref.column_name
      );
    ELSE
      RAISE NOTICE 'Cannot update %I.%I.%I because no fallback agent',
        ref.table_schema, ref.table_name, ref.column_name;
    END IF;
  END LOOP;
END;
$$;

DELETE FROM ai_agents WHERE slug = 'rides';

-- 2. Update home menu to point to workflow, not AI agent
UPDATE whatsapp_home_menu_items 
SET description = 'Find rides and drivers via WhatsApp'
WHERE key = 'rides_agent';

COMMIT;
