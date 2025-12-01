-- Manual Database Updates for EasyMO Platform Fixes
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql
-- Date: December 1, 2025

BEGIN;

-- ============================================================================
-- 1. ADD MISSING AGENTS
-- ============================================================================

-- Add marketplace agent if not exists
INSERT INTO public.ai_agents (slug, name, description, is_active, created_at)
VALUES ('marketplace', 'Marketplace AI Agent', 
        'Buy, sell, discover local businesses and products across Rwanda, DRC, Burundi, and Tanzania', 
        true, NOW())
ON CONFLICT (slug) DO UPDATE 
SET description = EXCLUDED.description,
    is_active = true,
    updated_at = NOW();

-- Add support agent if not exists
INSERT INTO public.ai_agents (slug, name, description, is_active, created_at)
VALUES ('support', 'Support AI Agent', 
        'General help, customer support, and platform assistance', 
        true, NOW())
ON CONFLICT (slug) DO UPDATE 
SET description = EXCLUDED.description,
    is_active = true,
    updated_at = NOW();

-- Deprecate broker agent in favor of marketplace
UPDATE public.ai_agents 
SET is_active = false,
    description = 'DEPRECATED: Use marketplace agent instead. Business brokerage functionality merged into marketplace.',
    updated_at = NOW()
WHERE slug = 'broker';

-- ============================================================================
-- 2. UPDATE HOME MENU TO ALIGN WITH AGENTS
-- ============================================================================

-- Update broker menu item to marketplace
UPDATE public.whatsapp_home_menu_items 
SET key = 'marketplace_agent', 
    name = 'Marketplace',
    description = 'Buy, sell, discover businesses',
    updated_at = NOW()
WHERE key IN ('broker_agent', 'business_broker_agent');

-- Add support menu item if not exists
INSERT INTO public.whatsapp_home_menu_items (key, name, icon, description, is_active, display_order, created_at)
VALUES ('support_agent', 'Support', '💬', 'Get help and support', true, 9, NOW())
ON CONFLICT (key) DO UPDATE 
SET is_active = true,
    description = 'Get help and support',
    updated_at = NOW();

-- ============================================================================
-- 3. CREATE MARKETPLACE_LISTINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12,2),
  currency TEXT DEFAULT 'RWF',
  category TEXT,
  condition TEXT CHECK (condition IN ('new', 'used', 'refurbished')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'inactive', 'deleted')),
  images JSONB DEFAULT '[]'::jsonb,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  location_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for marketplace
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller ON marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_category ON marketplace_listings(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_created ON marketplace_listings(created_at DESC);

-- Enable RLS on marketplace_listings
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

-- RLS policies for marketplace_listings
DROP POLICY IF EXISTS "Users can view active listings" ON marketplace_listings;
CREATE POLICY "Users can view active listings" 
ON marketplace_listings FOR SELECT 
USING (status = 'active');

DROP POLICY IF EXISTS "Users can manage their own listings" ON marketplace_listings;
CREATE POLICY "Users can manage their own listings" 
ON marketplace_listings FOR ALL 
USING (auth.uid() = seller_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON marketplace_listings TO authenticated;
GRANT ALL ON marketplace_listings TO service_role;

-- ============================================================================
-- 4. CREATE SUPPORT_TICKETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES whatsapp_users(id) ON DELETE CASCADE,
  issue_type TEXT,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to UUID,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Add indexes for support tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON support_tickets(created_at DESC);

-- Enable RLS on support_tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- RLS policies for support tickets
DROP POLICY IF EXISTS "Users can view their own tickets" ON support_tickets;
CREATE POLICY "Users can view their own tickets" 
ON support_tickets FOR SELECT 
USING (
  user_id IN (SELECT id FROM whatsapp_users WHERE phone_number = auth.jwt()->>'phone')
  OR assigned_to = auth.uid()
);

DROP POLICY IF EXISTS "Users can create tickets" ON support_tickets;
CREATE POLICY "Users can create tickets" 
ON support_tickets FOR INSERT 
WITH CHECK (
  user_id IN (SELECT id FROM whatsapp_users WHERE phone_number = auth.jwt()->>'phone')
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON support_tickets TO authenticated;
GRANT ALL ON support_tickets TO service_role;

-- ============================================================================
-- 5. VERIFY AGENT CONFIGURATION TABLES EXIST
-- ============================================================================

-- These should already exist, but verify structure
DO $$
BEGIN
    -- Check if ai_agent_personas exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_agent_personas') THEN
        RAISE NOTICE 'WARNING: ai_agent_personas table does not exist!';
    END IF;
    
    -- Check if ai_agent_system_instructions exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_agent_system_instructions') THEN
        RAISE NOTICE 'WARNING: ai_agent_system_instructions table does not exist!';
    END IF;
    
    -- Check if ai_agent_tools exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_agent_tools') THEN
        RAISE NOTICE 'WARNING: ai_agent_tools table does not exist!';
    END IF;
END $$;

-- ============================================================================
-- 6. VERIFICATION QUERIES
-- ============================================================================

-- List all active agents
SELECT slug, name, is_active, created_at 
FROM ai_agents 
ORDER BY slug;

-- Check home menu items
SELECT key, name, icon, is_active, display_order 
FROM whatsapp_home_menu_items 
WHERE is_active = true 
ORDER BY display_order;

-- Verify new tables exist
SELECT 
  schemaname, 
  tablename 
FROM pg_tables 
WHERE tablename IN ('marketplace_listings', 'support_tickets')
ORDER BY tablename;

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
SELECT 
  '✅ Database updates completed successfully!' as status,
  'Agents: marketplace, support added; broker deprecated' as agents,
  'Tables: marketplace_listings, support_tickets created' as tables,
  'Menu: Updated to align with agents' as menu;
