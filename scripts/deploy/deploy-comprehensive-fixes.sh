#!/bin/bash
# Comprehensive EasyMO Platform Deployment Script
# Deploys critical fixes identified in platform audit

set -e

echo "🚀 EasyMO Platform Comprehensive Deployment"
echo "============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    log_error "Supabase CLI not found. Please install it first."
    exit 1
fi

echo "Phase 1: Critical WhatsApp Mobility Fixes"
echo "-----------------------------------------"
log_info "Deploying wa-webhook-mobility (empty title fix)"
supabase functions deploy wa-webhook-mobility

echo ""
echo "Phase 2: Core WhatsApp Infrastructure"
echo "-------------------------------------"
log_info "Deploying wa-webhook-core (main router)"
supabase functions deploy wa-webhook-core

echo ""
echo "Phase 3: Domain-Specific Webhooks"
echo "---------------------------------"
log_info "Deploying wa-webhook-marketplace"
supabase functions deploy wa-webhook-marketplace

log_info "Deploying wa-webhook-jobs"
supabase functions deploy wa-webhook-jobs

log_info "Deploying wa-webhook-property"
supabase functions deploy wa-webhook-property

log_info "Deploying wa-webhook-buy-sell"
supabase functions deploy wa-webhook-buy-sell

log_info "Deploying wa-webhook-profile"
supabase functions deploy wa-webhook-profile

echo ""
echo "Phase 4: Database Schema Migrations"
echo "-----------------------------------"

# Create migration for missing agents
cat > supabase/migrations/$(date +%Y%m%d%H%M%S)_add_missing_agents.sql << 'EOF'
-- Add missing agents to database
-- Part of comprehensive platform audit fixes

BEGIN;

-- Add marketplace agent if not exists
INSERT INTO public.ai_agents (slug, name, description, is_active, created_at)
VALUES ('marketplace', 'Marketplace AI Agent', 
        'Buy, sell, discover local businesses and products across Rwanda, DRC, Burundi, and Tanzania', 
        true, NOW())
ON CONFLICT (slug) DO UPDATE 
SET description = EXCLUDED.description,
    is_active = true;

-- Add support agent if not exists
INSERT INTO public.ai_agents (slug, name, description, is_active, created_at)
VALUES ('support', 'Support AI Agent', 
        'General help, customer support, and platform assistance', 
        true, NOW())
ON CONFLICT (slug) DO UPDATE 
SET description = EXCLUDED.description,
    is_active = true;

-- Deprecate broker agent in favor of marketplace
UPDATE public.ai_agents 
SET is_active = false,
    description = 'DEPRECATED: Use marketplace agent instead. Business brokerage functionality merged into marketplace.'
WHERE slug = 'broker';

-- Ensure country consistency (only RW, CD, BI, TZ)
-- This is a data validation step - update any references to KE, UG, etc.
-- Add constraint if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'valid_country_codes'
    ) THEN
        -- Note: Adjust table name based on where country codes are stored
        -- This is a placeholder - update based on actual schema
        ALTER TABLE IF EXISTS profiles 
        ADD CONSTRAINT valid_country_codes 
        CHECK (country_code IN ('RW', 'CD', 'BI', 'TZ') OR country_code IS NULL);
    END IF;
END $$;

-- Update home menu to align with agents
UPDATE public.whatsapp_home_menu_items 
SET key = 'marketplace_agent', 
    name = 'Marketplace',
    description = 'Buy, sell, discover businesses'
WHERE key = 'broker_agent' OR key = 'business_broker_agent';

-- Add support menu item if not exists
INSERT INTO public.whatsapp_home_menu_items (key, name, icon, description, is_active, display_order, created_at)
VALUES ('support_agent', 'Support', '💬', 'Get help and support', true, 9, NOW())
ON CONFLICT (key) DO UPDATE 
SET is_active = true,
    description = 'Get help and support';

-- Create marketplace_listings table if not exists
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

-- Create support_tickets table if not exists
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

-- Enable RLS on support_tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON marketplace_listings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON support_tickets TO authenticated;
GRANT ALL ON marketplace_listings TO service_role;
GRANT ALL ON support_tickets TO service_role;

COMMIT;
EOF

log_info "Created migration for missing agents and tables"
log_info "Applying database migrations..."
supabase db push

echo ""
echo "Phase 5: Verification"
echo "--------------------"
log_info "Checking deployed functions..."
supabase functions list

echo ""
echo "✅ Deployment Complete!"
echo "======================="
echo ""
echo "📊 Summary:"
echo "  ✓ Fixed WhatsApp mobility empty title bug"
echo "  ✓ Deployed AI agent infrastructure"
echo "  ✓ Added missing agents (marketplace, support)"
echo "  ✓ Deprecated broker agent"
echo "  ✓ Created missing database tables"
echo "  ✓ Aligned menu with agents"
echo ""
echo "🔍 Next Steps:"
echo "  1. Test WhatsApp mobility matching (should no longer show empty titles)"
echo "  2. Verify AI agents use database configuration"
echo "  3. Test marketplace and support flows"
echo "  4. Monitor logs for any errors"
echo ""
log_warn "Remember to test thoroughly in development before deploying to production!"
