-- Consolidate Buy & Sell Agent - Remove Duplicate Slugs
-- 
-- This migration cleans up the ai_agents table by:
-- 1. Ensuring 'buy_sell' is the only active Buy & Sell agent slug
-- 2. Deleting old/duplicate agent slugs (buy_and_sell, business_broker, marketplace)
-- 3. Verifying menu keys are correct
--
-- @see docs/features/BUY_SELL_CONSOLIDATION_ANALYSIS.md

BEGIN;

-- =====================================================
-- STEP 1: Deactivate and Delete Old Agent Slugs
-- =====================================================

-- Log what we're about to delete
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count 
  FROM ai_agents 
  WHERE slug IN ('buy_and_sell', 'business_broker', 'marketplace', 'broker');
  
  RAISE NOTICE 'Found % agent(s) to clean up', v_count;
END $$;

-- First deactivate old slugs
UPDATE ai_agents 
SET 
  is_active = false,
  updated_at = NOW()
WHERE slug IN ('buy_and_sell', 'business_broker', 'marketplace', 'broker')
  AND slug != 'buy_sell';

-- Delete the deactivated slugs
DELETE FROM ai_agents 
WHERE slug IN ('buy_and_sell', 'business_broker', 'marketplace', 'broker')
  AND slug != 'buy_sell';

-- =====================================================
-- STEP 2: Ensure buy_sell Agent Exists and is Active
-- =====================================================

-- Create or update the canonical buy_sell agent
INSERT INTO ai_agents (
  slug,
  name,
  description,
  is_active,
  created_at,
  updated_at
) VALUES (
  'buy_sell',
  'Buy & Sell AI Agent',
  'Unified commerce and business discovery agent. Handles marketplace transactions, business search, and vendor connections.',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = NOW();

-- =====================================================
-- STEP 3: Verify Menu Keys
-- =====================================================

-- Check that the correct menu keys exist
DO $$
DECLARE
  v_categories_count INTEGER;
  v_broker_count INTEGER;
BEGIN
  -- Check for buy_sell_categories
  SELECT COUNT(*) INTO v_categories_count
  FROM whatsapp_home_menu_items
  WHERE key = 'buy_sell_categories' AND is_active = true;
  
  -- Check for business_broker_agent
  SELECT COUNT(*) INTO v_broker_count
  FROM whatsapp_home_menu_items
  WHERE key = 'business_broker_agent' AND is_active = true;
  
  RAISE NOTICE 'Menu items found: buy_sell_categories=%, business_broker_agent=%', 
    v_categories_count, v_broker_count;
  
  IF v_categories_count = 0 OR v_broker_count = 0 THEN
    RAISE WARNING 'Some menu items are missing. Expected both buy_sell_categories and business_broker_agent to be active.';
  END IF;
END $$;

-- Clean up any old/duplicate menu items that might conflict
DELETE FROM whatsapp_home_menu_items 
WHERE key IN (
  'buy_and_sell_agent',
  'buy_sell_agent', 
  'marketplace_agent',
  'broker_agent',
  'general_broker'
);

-- =====================================================
-- STEP 4: Add Comments for Documentation
-- =====================================================

COMMENT ON TABLE ai_agents IS 
'AI agent registry. 
Buy & Sell agent uses slug=''buy_sell'' (NOT buy_and_sell).
See docs/features/BUY_SELL_CONSOLIDATION_ANALYSIS.md for details.';

-- =====================================================
-- STEP 5: Verify Final State
-- =====================================================

DO $$
DECLARE
  v_agent_count INTEGER;
  v_menu_count INTEGER;
BEGIN
  -- Count active Buy & Sell related agents
  SELECT COUNT(*) INTO v_agent_count
  FROM ai_agents
  WHERE slug IN ('buy_sell', 'buy_and_sell', 'business_broker', 'marketplace', 'broker')
    AND is_active = true;
  
  -- Count active menu items
  SELECT COUNT(*) INTO v_menu_count
  FROM whatsapp_home_menu_items
  WHERE key IN ('buy_sell_categories', 'business_broker_agent')
    AND is_active = true;
  
  RAISE NOTICE 'Final state: % active agent(s), % active menu item(s)', v_agent_count, v_menu_count;
  
  IF v_agent_count != 1 THEN
    RAISE WARNING 'Expected exactly 1 active Buy & Sell agent (buy_sell), but found %', v_agent_count;
  END IF;
  
  IF v_menu_count != 2 THEN
    RAISE WARNING 'Expected exactly 2 active menu items (buy_sell_categories, business_broker_agent), but found %', v_menu_count;
  END IF;
END $$;

-- =====================================================
-- SUCCESS
-- =====================================================

COMMIT;

-- Display final agent state
SELECT 
  slug,
  name,
  is_active,
  created_at,
  updated_at
FROM ai_agents
WHERE slug = 'buy_sell'
ORDER BY slug;
