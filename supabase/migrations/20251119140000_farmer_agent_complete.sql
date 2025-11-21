BEGIN;

-- ============================================================================
-- FARMER AI AGENT - COMPLETE DATABASE SCHEMA
-- ============================================================================
-- Creates all missing tables for the Farmer AI Agent system
-- Includes: farms, farm_synonyms, agent_conversations, agent_messages,
--           farmer_listings, farmer_orders
-- ============================================================================

-- ============================================================================
-- 1. FARMS TABLE
-- ============================================================================
-- Stores farmer profiles and farm information
CREATE TABLE IF NOT EXISTS public.farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  farm_name TEXT NOT NULL,
  district TEXT,
  sector TEXT,
  region TEXT,
  hectares NUMERIC(10, 2),
  commodities TEXT[] DEFAULT ARRAY[]::TEXT[],
  certifications TEXT[] DEFAULT ARRAY[]::TEXT[],
  irrigation BOOLEAN DEFAULT FALSE,
  cooperative_member BOOLEAN DEFAULT FALSE,
  cooperative_name TEXT,
  phone_number TEXT,
  whatsapp_e164 TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns to existing farms table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'farms' AND column_name = 'phone_number') THEN
    ALTER TABLE public.farms ADD COLUMN phone_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'farms' AND column_name = 'whatsapp_e164') THEN
    ALTER TABLE public.farms ADD COLUMN whatsapp_e164 TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'farms' AND column_name = 'status') THEN
    ALTER TABLE public.farms ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'farms' AND column_name = 'cooperative_member') THEN
    ALTER TABLE public.farms ADD COLUMN cooperative_member BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'farms' AND column_name = 'cooperative_name') THEN
    ALTER TABLE public.farms ADD COLUMN cooperative_name TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS farms_owner_profile_id_idx ON public.farms(owner_profile_id);
CREATE INDEX IF NOT EXISTS farms_district_idx ON public.farms(district);
CREATE INDEX IF NOT EXISTS farms_commodities_idx ON public.farms USING GIN(commodities);
CREATE INDEX IF NOT EXISTS farms_phone_idx ON public.farms(phone_number);
CREATE INDEX IF NOT EXISTS farms_whatsapp_idx ON public.farms(whatsapp_e164);
CREATE INDEX IF NOT EXISTS farms_status_idx ON public.farms(status);

COMMENT ON TABLE public.farms IS 'Farmer profiles and farm information';
COMMENT ON COLUMN public.farms.commodities IS 'List of crops/produce grown';
COMMENT ON COLUMN public.farms.certifications IS 'Organic, GAP, etc';
COMMENT ON COLUMN public.farms.cooperative_member IS 'Member of a cooperative';

-- ============================================================================
-- 2. FARM SYNONYMS TABLE
-- ============================================================================
-- Multi-language farm name matching for better search
CREATE TABLE IF NOT EXISTS public.farm_synonyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  phrase TEXT NOT NULL,
  locale TEXT DEFAULT 'rw',
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS farm_synonyms_farm_id_idx ON public.farm_synonyms(farm_id);
CREATE INDEX IF NOT EXISTS farm_synonyms_phrase_idx ON public.farm_synonyms(phrase);
CREATE INDEX IF NOT EXISTS farm_synonyms_locale_idx ON public.farm_synonyms(locale);

COMMENT ON TABLE public.farm_synonyms IS 'Alternative names/phrases for farms in different languages';

-- ============================================================================
-- 3. AGENT CONVERSATIONS TABLE  
-- ============================================================================
-- Tracks AI agent conversation sessions
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('farmer_broker', 'job_agent', 'property_agent', 'waiter_agent', 'general')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned', 'escalated')),
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'voice')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_conversations_phone_idx ON public.agent_conversations(phone_number);
CREATE INDEX IF NOT EXISTS agent_conversations_user_idx ON public.agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS agent_conversations_type_idx ON public.agent_conversations(agent_type);
CREATE INDEX IF NOT EXISTS agent_conversations_status_idx ON public.agent_conversations(status);
CREATE INDEX IF NOT EXISTS agent_conversations_started_idx ON public.agent_conversations(started_at DESC);

COMMENT ON TABLE public.agent_conversations IS 'AI agent conversation tracking';
COMMENT ON COLUMN public.agent_conversations.metadata IS 'Intent, context, session data';

-- ============================================================================
-- 4. AGENT MESSAGES TABLE
-- ============================================================================
-- Stores individual messages in agent conversations
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_messages_conversation_idx ON public.agent_messages(conversation_id);
CREATE INDEX IF NOT EXISTS agent_messages_role_idx ON public.agent_messages(role);
CREATE INDEX IF NOT EXISTS agent_messages_created_idx ON public.agent_messages(created_at DESC);

COMMENT ON TABLE public.agent_messages IS 'Message history for AI agent conversations';
COMMENT ON COLUMN public.agent_messages.metadata IS 'Tool calls, response IDs, etc';

-- ============================================================================
-- 5. FARMER LISTINGS TABLE
-- ============================================================================
-- Farmer produce listings (supply side)
CREATE TABLE IF NOT EXISTS public.farmer_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.agent_conversations(id) ON DELETE SET NULL,
  market_code TEXT NOT NULL,
  commodity TEXT NOT NULL,
  variety TEXT,
  variety_label TEXT,
  grade TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
  price_per_unit NUMERIC(10, 2),
  currency TEXT DEFAULT 'RWF',
  city TEXT NOT NULL,
  payment_preference TEXT DEFAULT 'wallet' CHECK (payment_preference IN ('wallet', 'cod', 'both')),
  cod_fallback JSONB,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'matched', 'completed', 'cancelled', 'expired')),
  matched_order_id UUID,
  phone_number TEXT NOT NULL,
  whatsapp_e164 TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS farmer_listings_farm_idx ON public.farmer_listings(farm_id);
CREATE INDEX IF NOT EXISTS farmer_listings_market_idx ON public.farmer_listings(market_code);
CREATE INDEX IF NOT EXISTS farmer_listings_commodity_idx ON public.farmer_listings(commodity);
CREATE INDEX IF NOT EXISTS farmer_listings_status_idx ON public.farmer_listings(status);
CREATE INDEX IF NOT EXISTS farmer_listings_phone_idx ON public.farmer_listings(phone_number);
CREATE INDEX IF NOT EXISTS farmer_listings_created_idx ON public.farmer_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS farmer_listings_active_idx ON public.farmer_listings(status, market_code) WHERE status = 'active';

COMMENT ON TABLE public.farmer_listings IS 'Farmer produce supply listings';
COMMENT ON COLUMN public.farmer_listings.cod_fallback IS 'Cash on delivery instructions if payment fails';

-- ============================================================================
-- 6. FARMER ORDERS TABLE
-- ============================================================================
-- Buyer produce orders (demand side)
CREATE TABLE IF NOT EXISTS public.farmer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.agent_conversations(id) ON DELETE SET NULL,
  market_code TEXT NOT NULL,
  commodity TEXT NOT NULL,
  variety TEXT,
  variety_label TEXT,
  grade TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
  delivery_city TEXT NOT NULL,
  buyer_type TEXT DEFAULT 'merchant' CHECK (buyer_type IN ('merchant', 'institution', 'restaurant', 'individual')),
  payment_preference TEXT DEFAULT 'cod' CHECK (payment_preference IN ('wallet', 'cod', 'both')),
  cod_fallback JSONB,
  currency TEXT DEFAULT 'RWF',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'matched', 'completed', 'cancelled', 'expired')),
  matched_listing_id UUID,
  phone_number TEXT NOT NULL,
  whatsapp_e164 TEXT,
  buyer_name TEXT,
  buyer_company TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS farmer_orders_market_idx ON public.farmer_orders(market_code);
CREATE INDEX IF NOT EXISTS farmer_orders_commodity_idx ON public.farmer_orders(commodity);
CREATE INDEX IF NOT EXISTS farmer_orders_status_idx ON public.farmer_orders(status);
CREATE INDEX IF NOT EXISTS farmer_orders_phone_idx ON public.farmer_orders(phone_number);
CREATE INDEX IF NOT EXISTS farmer_orders_created_idx ON public.farmer_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS farmer_orders_active_idx ON public.farmer_orders(status, market_code) WHERE status = 'active';

COMMENT ON TABLE public.farmer_orders IS 'Buyer produce demand orders';

-- ============================================================================
-- 7. LISTING-ORDER MATCHES TABLE
-- ============================================================================
-- Tracks matched listings and orders
CREATE TABLE IF NOT EXISTS public.farmer_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.farmer_listings(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.farmer_orders(id) ON DELETE CASCADE,
  match_score NUMERIC(3, 2) DEFAULT 1.0,
  matched_quantity NUMERIC(10, 2) NOT NULL,
  agreed_price_per_unit NUMERIC(10, 2),
  currency TEXT DEFAULT 'RWF',
  payment_method TEXT DEFAULT 'cod',
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'scheduled', 'in_transit', 'delivered', 'failed')),
  delivery_scheduled_at TIMESTAMPTZ,
  delivery_completed_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS farmer_matches_listing_idx ON public.farmer_matches(listing_id);
CREATE INDEX IF NOT EXISTS farmer_matches_order_idx ON public.farmer_matches(order_id);
CREATE INDEX IF NOT EXISTS farmer_matches_delivery_idx ON public.farmer_matches(delivery_status);
CREATE INDEX IF NOT EXISTS farmer_matches_created_idx ON public.farmer_matches(created_at DESC);

COMMENT ON TABLE public.farmer_matches IS 'Matched listings and orders';

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_matches ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access - farms" ON public.farms
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access - farm_synonyms" ON public.farm_synonyms
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access - agent_conversations" ON public.agent_conversations
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access - agent_messages" ON public.agent_messages
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access - farmer_listings" ON public.farmer_listings
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access - farmer_orders" ON public.farmer_orders
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access - farmer_matches" ON public.farmer_matches
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Users can view their own data
CREATE POLICY "Users view own farms" ON public.farms
  FOR SELECT USING (owner_profile_id = auth.uid());

CREATE POLICY "Users view own listings" ON public.farmer_listings
  FOR SELECT USING (
    farm_id IN (SELECT id FROM public.farms WHERE owner_profile_id = auth.uid())
  );

CREATE POLICY "Users view own orders" ON public.farmer_orders
  FOR SELECT USING (phone_number = (
    SELECT whatsapp_e164 FROM public.profiles WHERE user_id = auth.uid()
  ));

-- ============================================================================
-- 9. TRIGGERS
-- ============================================================================

CREATE TRIGGER set_updated_at_farms
  BEFORE UPDATE ON public.farms
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_agent_conversations
  BEFORE UPDATE ON public.agent_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_farmer_listings
  BEFORE UPDATE ON public.farmer_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_farmer_orders
  BEFORE UPDATE ON public.farmer_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_farmer_matches
  BEFORE UPDATE ON public.farmer_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;
