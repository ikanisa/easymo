BEGIN;

-- Migration: Add missing foreign key indexes
-- Date: 2025-11-12
-- Description: Add indexes on foreign key columns for better query performance

-- Critical high-traffic tables
CREATE INDEX IF NOT EXISTS idx_trips_creator_user_id ON public.trips(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_credit_events_user_id ON public.credit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_order_id ON public.notifications(order_id);

-- E-commerce related
CREATE INDEX IF NOT EXISTS idx_categories_bar_id ON public.categories(bar_id);
CREATE INDEX IF NOT EXISTS idx_item_modifiers_item_id ON public.item_modifiers(item_id);
CREATE INDEX IF NOT EXISTS idx_carts_bar_id ON public.carts(bar_id);
CREATE INDEX IF NOT EXISTS idx_orders_source_cart_id ON public.orders(source_cart_id);
CREATE INDEX IF NOT EXISTS idx_sessions_bar_id ON public.sessions(bar_id);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_bar_id ON public.ocr_jobs(bar_id);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_menu_id ON public.ocr_jobs(menu_id);

-- Business/marketplace
CREATE INDEX IF NOT EXISTS idx_businesses_category_id ON public.businesses(category_id);

-- Insurance and verification
CREATE INDEX IF NOT EXISTS idx_insurance_media_queue_profile_id ON public.insurance_media_queue(profile_id);

-- Vouchers
CREATE INDEX IF NOT EXISTS idx_vouchers_redeemed_by_station_id ON public.vouchers(redeemed_by_station_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_issued_by_admin ON public.vouchers(issued_by_admin);
CREATE INDEX IF NOT EXISTS idx_vouchers_created_by ON public.vouchers(created_by);
CREATE INDEX IF NOT EXISTS idx_vouchers_station_scope ON public.vouchers(station_scope);
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_station_id ON public.voucher_redemptions(station_id);
CREATE INDEX IF NOT EXISTS idx_voucher_events_actor_id ON public.voucher_events(actor_id);

-- Mobility/trips
CREATE INDEX IF NOT EXISTS idx_recurring_trips_origin_favorite_id ON public.recurring_trips(origin_favorite_id);
CREATE INDEX IF NOT EXISTS idx_recurring_trips_dest_favorite_id ON public.recurring_trips(dest_favorite_id);
CREATE INDEX IF NOT EXISTS idx_driver_availability_parking_id ON public.driver_availability(parking_id);

-- Voice/calls
CREATE INDEX IF NOT EXISTS idx_voice_events_call_id ON public.voice_events(call_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_call_id ON public.transcripts(call_id);
CREATE INDEX IF NOT EXISTS idx_call_consents_call_id ON public.call_consents(call_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_call_id ON public.mcp_tool_calls(call_id);
CREATE INDEX IF NOT EXISTS idx_wa_threads_call_id ON public.wa_threads(call_id);

-- Agent deployment
CREATE INDEX IF NOT EXISTS idx_agent_deployments_version_id ON public.agent_deployments(version_id);

-- Campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON public.campaigns(created_by);

COMMIT;
