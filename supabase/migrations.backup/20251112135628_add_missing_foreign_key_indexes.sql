BEGIN;

-- Migration: Add missing foreign key indexes
-- Date: 2025-11-12
-- Description: Add indexes on foreign key columns for better query performance
-- Note: Wrapped in existence checks to handle missing tables gracefully

DO $$
BEGIN
  -- Critical high-traffic tables
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'trips') THEN
    CREATE INDEX IF NOT EXISTS idx_trips_creator_user_id ON public.trips(creator_user_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'credit_events') THEN
    CREATE INDEX IF NOT EXISTS idx_credit_events_user_id ON public.credit_events(user_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cart_items') THEN
    CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items(cart_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'order_items') THEN
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
  END IF;
  
  -- Notifications table doesn't have order_id column (skipped)
  
  -- E-commerce related
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'categories') THEN
    CREATE INDEX IF NOT EXISTS idx_categories_bar_id ON public.categories(bar_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'item_modifiers') THEN
    CREATE INDEX IF NOT EXISTS idx_item_modifiers_item_id ON public.item_modifiers(item_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'carts') THEN
    CREATE INDEX IF NOT EXISTS idx_carts_bar_id ON public.carts(bar_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
    CREATE INDEX IF NOT EXISTS idx_orders_source_cart_id ON public.orders(source_cart_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sessions') THEN
    CREATE INDEX IF NOT EXISTS idx_sessions_bar_id ON public.sessions(bar_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ocr_jobs') THEN
    CREATE INDEX IF NOT EXISTS idx_ocr_jobs_bar_id ON public.ocr_jobs(bar_id);
    CREATE INDEX IF NOT EXISTS idx_ocr_jobs_menu_id ON public.ocr_jobs(menu_id);
  END IF;
  
  -- Business/marketplace
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'businesses') THEN
    CREATE INDEX IF NOT EXISTS idx_businesses_category_id ON public.businesses(category_id);
  END IF;
  
  -- Insurance and verification
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'insurance_media_queue') THEN
    CREATE INDEX IF NOT EXISTS idx_insurance_media_queue_profile_id ON public.insurance_media_queue(profile_id);
  END IF;
  
  -- Vouchers
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'vouchers') THEN
    CREATE INDEX IF NOT EXISTS idx_vouchers_redeemed_by_station_id ON public.vouchers(redeemed_by_station_id);
    CREATE INDEX IF NOT EXISTS idx_vouchers_issued_by_admin ON public.vouchers(issued_by_admin);
    CREATE INDEX IF NOT EXISTS idx_vouchers_created_by ON public.vouchers(created_by);
    CREATE INDEX IF NOT EXISTS idx_vouchers_station_scope ON public.vouchers(station_scope);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'voucher_redemptions') THEN
    CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_station_id ON public.voucher_redemptions(station_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'voucher_events') THEN
    CREATE INDEX IF NOT EXISTS idx_voucher_events_actor_id ON public.voucher_events(actor_id);
  END IF;
  
  -- Mobility/trips
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'recurring_trips') THEN
    CREATE INDEX IF NOT EXISTS idx_recurring_trips_origin_favorite_id ON public.recurring_trips(origin_favorite_id);
    CREATE INDEX IF NOT EXISTS idx_recurring_trips_dest_favorite_id ON public.recurring_trips(dest_favorite_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'driver_availability') THEN
    CREATE INDEX IF NOT EXISTS idx_driver_availability_parking_id ON public.driver_availability(parking_id);
  END IF;
  
  -- Voice/calls
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'voice_events') THEN
    CREATE INDEX IF NOT EXISTS idx_voice_events_call_id ON public.voice_events(call_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transcripts') THEN
    CREATE INDEX IF NOT EXISTS idx_transcripts_call_id ON public.transcripts(call_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'call_consents') THEN
    CREATE INDEX IF NOT EXISTS idx_call_consents_call_id ON public.call_consents(call_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mcp_tool_calls') THEN
    CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_call_id ON public.mcp_tool_calls(call_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wa_threads') THEN
    CREATE INDEX IF NOT EXISTS idx_wa_threads_call_id ON public.wa_threads(call_id);
  END IF;
  
  -- Agent deployment
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agent_deployments') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_deployments_version_id ON public.agent_deployments(version_id);
  END IF;
END $$;

-- Campaigns (only if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaigns') THEN
    CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON public.campaigns(created_by);
  END IF;
END $$;

COMMIT;
