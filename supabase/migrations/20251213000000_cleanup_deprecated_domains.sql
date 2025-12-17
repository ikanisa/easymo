-- EasyMO Refactoring: Remove deprecated domains
-- Date: 2025-12-13
-- Services removed: Jobs, Waiter, Farmer, Real Estate, Sales

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_agents'
  ) THEN
    RAISE NOTICE 'Skipping 20251213000000_cleanup_deprecated_domains: ai_agents table missing.';
    RETURN;
  END IF;

  -- Clean AI agents table - keep only buy_and_sell
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_agent_tools'
  ) THEN
    DELETE FROM ai_agent_tools WHERE agent_id IN (
      SELECT id FROM ai_agents WHERE slug NOT IN ('buy_and_sell', 'buy_sell')
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_agent_personas'
  ) THEN
    DELETE FROM ai_agent_personas WHERE agent_id IN (
      SELECT id FROM ai_agents WHERE slug NOT IN ('buy_and_sell', 'buy_sell')
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_agent_system_instructions'
  ) THEN
    DELETE FROM ai_agent_system_instructions WHERE agent_id IN (
      SELECT id FROM ai_agents WHERE slug NOT IN ('buy_and_sell', 'buy_sell')
    );
  END IF;

  DELETE FROM ai_agents WHERE slug NOT IN ('buy_and_sell', 'buy_sell');

  -- Update menu items to remove deleted services
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'menu_items'
  ) THEN
    DELETE FROM menu_items WHERE slug IN ('jobs', 'waiter', 'farmer', 'real_estate', 'sales', 'property');
  END IF;
END $$;

COMMIT;
