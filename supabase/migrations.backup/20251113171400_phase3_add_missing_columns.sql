-- ============================================================================
-- SUPABASE DATABASE CLEANUP - PHASE 3: ADD MISSING COLUMNS
-- ============================================================================
-- Date: November 13, 2025
-- Purpose: Add missing columns to ensure complete schema
-- Run AFTER Phase 1 and Phase 2 (or standalone - safest to run first)
-- ============================================================================

BEGIN;

-- ============================================================================
-- WAITER AI TABLES - ADD MISSING COLUMNS
-- ============================================================================

-- waiter_conversations: Add missing columns
ALTER TABLE waiter_conversations 
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS business_id UUID,
  ADD COLUMN IF NOT EXISTS wa_thread_id UUID;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_waiter_conversations_business_id ON waiter_conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_waiter_conversations_wa_thread_id ON waiter_conversations(wa_thread_id);
CREATE INDEX IF NOT EXISTS idx_waiter_conversations_last_message_at ON waiter_conversations(last_message_at DESC);

-- waiter_messages: Add missing columns
ALTER TABLE waiter_messages
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tool_calls JSONB,
  ADD COLUMN IF NOT EXISTS citations JSONB,
  ADD COLUMN IF NOT EXISTS sources JSONB,
  ADD COLUMN IF NOT EXISTS error TEXT,
  ADD COLUMN IF NOT EXISTS tokens_used INTEGER,
  ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

-- waiter_orders: Add missing columns
ALTER TABLE waiter_orders
  ADD COLUMN IF NOT EXISTS business_id UUID,
  ADD COLUMN IF NOT EXISTS table_number TEXT,
  ADD COLUMN IF NOT EXISTS special_instructions TEXT,
  ADD COLUMN IF NOT EXISTS estimated_ready_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_ready_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_address JSONB,
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_type TEXT CHECK (order_type IN ('dine_in', 'takeaway', 'delivery')),
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS wa_message_id UUID;

CREATE INDEX IF NOT EXISTS idx_waiter_orders_business_id ON waiter_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_waiter_orders_status ON waiter_orders(status);
CREATE INDEX IF NOT EXISTS idx_waiter_orders_created_at ON waiter_orders(created_at DESC);

-- waiter_reservations: Add missing columns
ALTER TABLE waiter_reservations
  ADD COLUMN IF NOT EXISTS business_id UUID,
  ADD COLUMN IF NOT EXISTS table_number TEXT,
  ADD COLUMN IF NOT EXISTS special_requests TEXT,
  ADD COLUMN IF NOT EXISTS occasion TEXT,
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmation_code TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_waiter_reservations_business_id ON waiter_reservations(business_id);
CREATE INDEX IF NOT EXISTS idx_waiter_reservations_reservation_time ON waiter_reservations(reservation_time);

-- ============================================================================
-- BUSINESSES TABLE - ADD MISSING COLUMNS
-- ============================================================================

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS business_type TEXT CHECK (business_type IN ('restaurant', 'bar', 'shop', 'service', 'property', 'other')),
  ADD COLUMN IF NOT EXISTS cuisine_type TEXT[],
  ADD COLUMN IF NOT EXISTS opening_hours JSONB,
  ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS takeaway_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS dine_in_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS reservations_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS average_prep_time INTEGER,
  ADD COLUMN IF NOT EXISTS min_order_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS delivery_radius_km DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_number_id UUID,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS social_media JSONB,
  ADD COLUMN IF NOT EXISTS payment_methods TEXT[],
  ADD COLUMN IF NOT EXISTS features TEXT[];

CREATE INDEX IF NOT EXISTS idx_businesses_business_type ON businesses(business_type);
CREATE INDEX IF NOT EXISTS idx_businesses_rating ON businesses(rating DESC);

-- ============================================================================
-- MENU TABLES - ADD MISSING COLUMNS
-- ============================================================================

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS business_id UUID,
  ADD COLUMN IF NOT EXISTS category_id UUID,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allergens TEXT[],
  ADD COLUMN IF NOT EXISTS dietary_info JSONB,
  ADD COLUMN IF NOT EXISTS preparation_time INTEGER,
  ADD COLUMN IF NOT EXISTS calories INTEGER,
  ADD COLUMN IF NOT EXISTS spice_level INTEGER CHECK (spice_level BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variants JSONB,
  ADD COLUMN IF NOT EXISTS options JSONB;

CREATE INDEX IF NOT EXISTS idx_menu_items_business_id ON menu_items(business_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_available ON menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_featured ON menu_items(is_featured);

ALTER TABLE menu_categories
  ADD COLUMN IF NOT EXISTS business_id UUID,
  ADD COLUMN IF NOT EXISTS parent_category_id UUID,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_menu_categories_business_id ON menu_categories(business_id);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS database_cleanup_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase TEXT NOT NULL,
    action TEXT NOT NULL,
    table_name TEXT,
    rows_affected INTEGER,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    executed_by TEXT DEFAULT current_user,
    notes TEXT
);

INSERT INTO database_cleanup_audit (phase, action, notes)
VALUES ('Phase 3', 'Add Missing Columns', 'Added missing columns to waiter_*, businesses, menu_* tables for complete functionality');

-- ============================================================================
-- COMMIT
-- ============================================================================

COMMIT;
