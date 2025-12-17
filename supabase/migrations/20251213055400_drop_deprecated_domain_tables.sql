BEGIN;

-- Migration: Drop Deprecated Domain Tables
-- Date: 2025-12-13
-- Description: Remove database tables for deprecated services
--              Part of Rwanda-only refactoring (Day 6-7)
--
-- Domains being removed:
-- - Jobs/Employment
-- - Waiter/Bars/Restaurants
-- - Farmer/Agriculture
-- - Real Estate/Property
--
-- CAUTION: This is a destructive operation. Data will be permanently deleted.
-- Ensure proper backups exist before applying this migration.

-- =====================================================
-- JOBS DOMAIN TABLES
-- =====================================================

-- Drop job applications and related tables
DROP TABLE IF EXISTS public.job_applications CASCADE;
DROP TABLE IF EXISTS public.job_listings CASCADE;
DROP TABLE IF EXISTS public.job_posts CASCADE;
DROP TABLE IF EXISTS public.job_searches CASCADE;
DROP TABLE IF EXISTS public.job_alerts CASCADE;
DROP TABLE IF EXISTS public.job_sources CASCADE;
DROP TABLE IF EXISTS public.worker_profiles CASCADE;
DROP TABLE IF EXISTS public.seeker_profiles CASCADE;

-- =====================================================
-- WAITER/BARS/RESTAURANTS DOMAIN TABLES
-- =====================================================

-- Drop bars and restaurant tables
DROP TABLE IF EXISTS public.tips CASCADE;
DROP TABLE IF EXISTS public.bar_orders CASCADE;
DROP TABLE IF EXISTS public.bar_menus CASCADE;
DROP TABLE IF EXISTS public.restaurant_menu_items CASCADE;
DROP TABLE IF EXISTS public.menu_upload_requests CASCADE;
DROP TABLE IF EXISTS public.menus CASCADE;
DROP TABLE IF EXISTS public.menu_categories CASCADE;
DROP TABLE IF EXISTS public.bars CASCADE;
DROP TABLE IF EXISTS public.restaurants CASCADE;

-- =====================================================
-- FARMER/AGRICULTURE DOMAIN TABLES
-- =====================================================

-- Drop farmer and agriculture tables
DROP TABLE IF EXISTS public.farmers_call_intakes CASCADE;
DROP TABLE IF EXISTS public.farmers_sources CASCADE;
DROP TABLE IF EXISTS public.produce_listings CASCADE;
DROP TABLE IF EXISTS public.farm_products CASCADE;
DROP TABLE IF EXISTS public.farmer_profiles CASCADE;

-- =====================================================
-- REAL ESTATE/PROPERTY DOMAIN TABLES
-- =====================================================

-- Drop property and real estate tables
DROP TABLE IF EXISTS public.property_requests CASCADE;
DROP TABLE IF EXISTS public.property_inquiries CASCADE;
DROP TABLE IF EXISTS public.property_reviews CASCADE;
DROP TABLE IF EXISTS public.property_listings CASCADE;
DROP TABLE IF EXISTS public.properties CASCADE;
DROP TABLE IF EXISTS public.rental_properties CASCADE;
DROP TABLE IF EXISTS public.property_viewings CASCADE;

-- =====================================================
-- AGENT MATCH EVENTS (deprecated domains)
-- =====================================================

-- Remove match events for deprecated agents
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agent_match_events'
  ) THEN
    DELETE FROM public.agent_match_events 
    WHERE event_type IN ('job_match', 'property_match', 'restaurant_match', 'farm_product_match');
  ELSE
    RAISE NOTICE 'Skipping agent_match_events cleanup: table missing.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'parsed_intents'
  ) THEN
    DELETE FROM public.parsed_intents 
    WHERE intent_type IN (
      'search_jobs', 'apply_job', 'view_job',
      'search_property', 'view_property', 'schedule_viewing',
      'view_menu', 'order_food', 'view_bars',
      'farmer_inquiry', 'view_produce'
    );
  ELSE
    RAISE NOTICE 'Skipping parsed_intents cleanup: table missing.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'whatsapp_conversations'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_agents'
  ) THEN
    UPDATE public.whatsapp_conversations 
    SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"archived_domain": true}'::jsonb
    WHERE agent_id IN (
      SELECT id FROM ai_agents 
      WHERE slug IN ('jobs', 'waiter', 'farmer', 'real_estate', 'property', 'sales_cold_caller')
    );
  ELSE
    RAISE NOTICE 'Skipping whatsapp_conversations archival: prerequisite tables missing.';
  END IF;
END $$;

-- =====================================================
-- VERIFICATION & LOGGING
-- =====================================================

DO $$
DECLARE
  tables_dropped TEXT[] := ARRAY[
    'job_applications', 'job_listings', 'job_posts', 'job_sources', 'worker_profiles',
    'tips', 'bar_orders', 'menus', 'bars', 'restaurants', 'menu_upload_requests',
    'farmers_call_intakes', 'farmers_sources', 'produce_listings',
    'property_requests', 'property_listings', 'properties', 'rental_properties'
  ];
  t TEXT;
  table_exists BOOLEAN;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DEPRECATED DOMAIN TABLES CLEANUP';
  RAISE NOTICE '========================================';
  
  FOREACH t IN ARRAY tables_dropped
  LOOP
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = t
    ) INTO table_exists;
    
    IF NOT table_exists THEN
      RAISE NOTICE '✓ Table % successfully dropped or did not exist', t;
    ELSE
      RAISE WARNING '✗ Table % still exists - check for dependencies', t;
    END IF;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Cleanup complete!';
  RAISE NOTICE 'Domains removed: Jobs, Waiter, Farmer, Real Estate';
  RAISE NOTICE '========================================';
END $$;

COMMIT;
