-- =====================================================================
-- CACHE INVALIDATION TRIGGERS
-- =====================================================================
-- Automatically invalidates Redis cache when agent configs change
-- Calls agent-config-invalidator Edge Function via HTTP
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. CREATE NOTIFICATION FUNCTION
-- =====================================================================

CREATE OR REPLACE FUNCTION public.notify_agent_config_change()
RETURNS trigger AS $$
DECLARE
  v_agent_slug text;
  v_webhook_url text;
  v_webhook_secret text;
  v_response text;
BEGIN
  -- Get agent slug from agent_id
  IF TG_OP = 'DELETE' THEN
    SELECT slug INTO v_agent_slug
    FROM ai_agents WHERE id = OLD.agent_id;
  ELSE
    SELECT slug INTO v_agent_slug
    FROM ai_agents WHERE id = NEW.agent_id;
  END IF;

  -- If agent not found, skip
  IF v_agent_slug IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Log the config change event
  RAISE NOTICE 'Agent config changed: % (table: %, operation: %)', 
    v_agent_slug, TG_TABLE_NAME, TG_OP;

  -- Get webhook URL from environment (configured in Supabase dashboard)
  -- Format: https://your-project.supabase.co/functions/v1/agent-config-invalidator
  v_webhook_url := current_setting('app.invalidation_webhook_url', true);
  v_webhook_secret := current_setting('app.invalidation_webhook_secret', true);

  -- If webhook configured, trigger cache invalidation
  IF v_webhook_url IS NOT NULL AND v_webhook_url != '' THEN
    BEGIN
      -- Call Edge Function to invalidate cache
      SELECT content::text INTO v_response
      FROM http((
        'POST',
        v_webhook_url,
        ARRAY[
          http_header('Content-Type', 'application/json'),
          http_header('Authorization', 'Bearer ' || COALESCE(v_webhook_secret, ''))
        ],
        'application/json',
        json_build_object(
          'agent_slug', v_agent_slug,
          'table', TG_TABLE_NAME,
          'operation', TG_OP,
          'timestamp', NOW()
        )::text
      )::http_request);

      RAISE NOTICE 'Cache invalidation triggered for agent: %', v_agent_slug;
    EXCEPTION WHEN OTHERS THEN
      -- Don't fail the transaction if webhook fails
      RAISE WARNING 'Cache invalidation webhook failed: %', SQLERRM;
    END;
  ELSE
    -- Fallback: Use pg_notify for local listeners
    PERFORM pg_notify(
      'agent_config_changed',
      json_build_object(
        'agent_slug', v_agent_slug,
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'timestamp', NOW()
      )::text
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 2. ATTACH TRIGGERS TO CONFIG TABLES
-- =====================================================================

-- Trigger on system instructions changes
DROP TRIGGER IF EXISTS trigger_invalidate_on_instructions_change ON ai_agent_system_instructions;
CREATE TRIGGER trigger_invalidate_on_instructions_change
AFTER INSERT OR UPDATE OR DELETE ON ai_agent_system_instructions
FOR EACH ROW EXECUTE FUNCTION notify_agent_config_change();

-- Trigger on persona changes
DROP TRIGGER IF EXISTS trigger_invalidate_on_persona_change ON ai_agent_personas;
CREATE TRIGGER trigger_invalidate_on_persona_change
AFTER INSERT OR UPDATE OR DELETE ON ai_agent_personas
FOR EACH ROW EXECUTE FUNCTION notify_agent_config_change();

-- Trigger on tool changes
DROP TRIGGER IF EXISTS trigger_invalidate_on_tool_change ON ai_agent_tools;
CREATE TRIGGER trigger_invalidate_on_tool_change
AFTER INSERT OR UPDATE OR DELETE ON ai_agent_tools
FOR EACH ROW EXECUTE FUNCTION notify_agent_config_change();

-- Trigger on task changes
DROP TRIGGER IF EXISTS trigger_invalidate_on_task_change ON ai_agent_tasks;
CREATE TRIGGER trigger_invalidate_on_task_change
AFTER INSERT OR UPDATE OR DELETE ON ai_agent_tasks
FOR EACH ROW EXECUTE FUNCTION notify_agent_config_change();

-- Trigger on knowledge base changes
DROP TRIGGER IF EXISTS trigger_invalidate_on_kb_change ON ai_agent_knowledge_bases;
CREATE TRIGGER trigger_invalidate_on_kb_change
AFTER INSERT OR UPDATE OR DELETE ON ai_agent_knowledge_bases
FOR EACH ROW EXECUTE FUNCTION notify_agent_config_change();

-- =====================================================================
-- 3. HELPER FUNCTION TO MANUALLY INVALIDATE CACHE
-- =====================================================================

CREATE OR REPLACE FUNCTION public.invalidate_agent_cache(p_agent_slug text)
RETURNS void AS $$
BEGIN
  -- Trigger notification
  PERFORM pg_notify(
    'agent_config_changed',
    json_build_object(
      'agent_slug', p_agent_slug,
      'table', 'manual',
      'operation', 'INVALIDATE',
      'timestamp', NOW()
    )::text
  );
  
  RAISE NOTICE 'Cache invalidation triggered for agent: %', p_agent_slug;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =====================================================================
-- USAGE INSTRUCTIONS
-- =====================================================================
--
-- 1. CONFIGURE WEBHOOK URL (in Supabase Dashboard → Settings → API):
--    ALTER DATABASE postgres SET app.invalidation_webhook_url = 
--      'https://your-project.supabase.co/functions/v1/agent-config-invalidator';
--    
--    ALTER DATABASE postgres SET app.invalidation_webhook_secret = 
--      'your-secret-key-here';
--
-- 2. DEPLOY EDGE FUNCTION:
--    supabase functions deploy agent-config-invalidator
--
-- 3. SET ENVIRONMENT VARIABLES (in Supabase Dashboard):
--    REDIS_URL=redis://...
--    INVALIDATION_WEBHOOK_SECRET=your-secret-key-here
--
-- 4. TEST MANUAL INVALIDATION:
--    SELECT invalidate_agent_cache('support');
--
-- 5. AUTOMATIC INVALIDATION:
--    - Any INSERT/UPDATE/DELETE on config tables triggers invalidation
--    - Redis cache is cleared immediately
--    - All function instances get fresh config on next request
--
-- =====================================================================
