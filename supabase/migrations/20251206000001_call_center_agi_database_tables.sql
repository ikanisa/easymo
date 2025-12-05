-- =====================================================================
-- CALL CENTER AGI - MISSING DATABASE TABLES
-- =====================================================================
-- Creates all required tables for Call Center AGI tool operations
-- =====================================================================

BEGIN;

-- =====================================================================
-- PROPERTY / REAL ESTATE TABLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.property_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('rent', 'sale')),
  country TEXT NOT NULL DEFAULT 'RW' CHECK (country IN ('RW', 'CD', 'BI', 'TZ')),
  city TEXT NOT NULL,
  area TEXT,
  district TEXT,
  sector TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  price NUMERIC(12,2),
  currency TEXT DEFAULT 'RWF' CHECK (currency IN ('RWF', 'USD', 'EUR')),
  size_sqm NUMERIC(10,2),
  furnished BOOLEAN DEFAULT false,
  parking BOOLEAN DEFAULT false,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'rented', 'sold', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_listings_profile ON public.property_listings(profile_id);
CREATE INDEX IF NOT EXISTS idx_property_listings_city ON public.property_listings(city);
CREATE INDEX IF NOT EXISTS idx_property_listings_type ON public.property_listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_property_listings_status ON public.property_listings(status);

COMMENT ON TABLE public.property_listings IS 'Property listings for rent/sale created via Call Center AGI';

-- =====================================================================
-- JOBS & EMPLOYMENT TABLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.job_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  country TEXT NOT NULL DEFAULT 'RW' CHECK (country IN ('RW', 'CD', 'BI', 'TZ')),
  location TEXT NOT NULL,
  pay_type TEXT CHECK (pay_type IN ('hourly', 'daily', 'monthly', 'project')),
  pay_amount NUMERIC(12,2),
  currency TEXT DEFAULT 'RWF',
  duration TEXT,
  employment_type TEXT CHECK (employment_type IN ('full_time', 'part_time', 'gig', 'one_off', 'internship', 'freelance')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'filled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_listings_profile ON public.job_listings(profile_id);
CREATE INDEX IF NOT EXISTS idx_job_listings_location ON public.job_listings(location);
CREATE INDEX IF NOT EXISTS idx_job_listings_status ON public.job_listings(status);

COMMENT ON TABLE public.job_listings IS 'Job postings created via Call Center AGI';

CREATE TABLE IF NOT EXISTS public.job_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  skills TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferred_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferred_locations TEXT[] DEFAULT ARRAY[]::TEXT[],
  experience_years INTEGER,
  education_level TEXT,
  availability_date DATE,
  can_start_immediately BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'employed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_candidates_profile ON public.job_candidates(profile_id);
CREATE INDEX IF NOT EXISTS idx_job_candidates_skills ON public.job_candidates USING gin(skills);

COMMENT ON TABLE public.job_candidates IS 'Job seekers registered via Call Center AGI';

-- =====================================================================
-- MARKETPLACE VENDORS (if not exists)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('farmer', 'shop', 'pharmacy', 'restaurant', 'other')),
  products TEXT[] DEFAULT ARRAY[]::TEXT[],
  country TEXT NOT NULL DEFAULT 'RW' CHECK (country IN ('RW', 'CD', 'BI', 'TZ')),
  location TEXT NOT NULL,
  district TEXT,
  sector TEXT,
  business_name TEXT,
  is_verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_vendors_profile ON public.marketplace_vendors(profile_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_vendors_category ON public.marketplace_vendors(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_vendors_location ON public.marketplace_vendors(location);

COMMENT ON TABLE public.marketplace_vendors IS 'Vendors/farmers registered via Call Center AGI';

-- =====================================================================
-- LEGAL & NOTARY LEADS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.legal_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  description TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'RW' CHECK (country IN ('RW', 'CD', 'BI', 'TZ')),
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
  assigned_to UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_leads_profile ON public.legal_leads(profile_id);
CREATE INDEX IF NOT EXISTS idx_legal_leads_status ON public.legal_leads(status);
CREATE INDEX IF NOT EXISTS idx_legal_leads_urgency ON public.legal_leads(urgency);

COMMENT ON TABLE public.legal_leads IS 'Legal/notary assistance requests from Call Center AGI';

-- =====================================================================
-- PHARMACY LEADS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.pharmacy_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  need_type TEXT NOT NULL CHECK (need_type IN ('delivery', 'enquiry', 'prescription')),
  description TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'RW' CHECK (country IN ('RW', 'CD', 'BI', 'TZ')),
  location TEXT,
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'fulfilled', 'cancelled')),
  assigned_pharmacy_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_leads_profile ON public.pharmacy_leads(profile_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_leads_status ON public.pharmacy_leads(status);
CREATE INDEX IF NOT EXISTS idx_pharmacy_leads_need_type ON public.pharmacy_leads(need_type);

COMMENT ON TABLE public.pharmacy_leads IS 'Pharmacy requests from Call Center AGI';

-- =====================================================================
-- PAYMENT QR CODES (MoMo)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.payment_qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'RWF' CHECK (currency IN ('RWF', 'USD', 'EUR')),
  purpose TEXT NOT NULL,
  qr_code_data TEXT,
  qr_code_image_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_qr_codes_profile ON public.payment_qr_codes(profile_id);
CREATE INDEX IF NOT EXISTS idx_payment_qr_codes_status ON public.payment_qr_codes(status);

COMMENT ON TABLE public.payment_qr_codes IS 'MoMo QR codes generated via Call Center AGI';

-- =====================================================================
-- CALL SUMMARIES (if not exists)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.call_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT NOT NULL UNIQUE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  primary_intent TEXT NOT NULL,
  secondary_intents TEXT[] DEFAULT ARRAY[]::TEXT[],
  summary TEXT NOT NULL,
  transcript_ref TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  language TEXT DEFAULT 'en',
  duration_seconds INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_summaries_profile ON public.call_summaries(profile_id);
CREATE INDEX IF NOT EXISTS idx_call_summaries_primary_intent ON public.call_summaries(primary_intent);
CREATE INDEX IF NOT EXISTS idx_call_summaries_created ON public.call_summaries(created_at DESC);

COMMENT ON TABLE public.call_summaries IS 'Call summaries for analytics and learning from Call Center AGI';

-- =====================================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================================

ALTER TABLE public.property_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_summaries ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- RLS POLICIES (Service role can do everything, users can read their own)
-- =====================================================================

-- Property Listings
DROP POLICY IF EXISTS "Service role full access" ON public.property_listings;
CREATE POLICY "Service role full access" ON public.property_listings
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "Users can view their own listings" ON public.property_listings;
CREATE POLICY "Users can view their own listings" ON public.property_listings
  FOR SELECT USING (auth.uid() = profile_id);

-- Job Listings
DROP POLICY IF EXISTS "Service role full access" ON public.job_listings;
CREATE POLICY "Service role full access" ON public.job_listings
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "Users can view their own job postings" ON public.job_listings;
CREATE POLICY "Users can view their own job postings" ON public.job_listings
  FOR SELECT USING (auth.uid() = profile_id);

-- Job Candidates
DROP POLICY IF EXISTS "Service role full access" ON public.job_candidates;
CREATE POLICY "Service role full access" ON public.job_candidates
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "Users can view their own candidate profile" ON public.job_candidates;
CREATE POLICY "Users can view their own candidate profile" ON public.job_candidates
  FOR SELECT USING (auth.uid() = profile_id);

-- Marketplace Vendors
DROP POLICY IF EXISTS "Service role full access" ON public.marketplace_vendors;
CREATE POLICY "Service role full access" ON public.marketplace_vendors
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "Users can view their own vendor profile" ON public.marketplace_vendors;
CREATE POLICY "Users can view their own vendor profile" ON public.marketplace_vendors
  FOR SELECT USING (auth.uid() = profile_id);

-- Legal Leads
DROP POLICY IF EXISTS "Service role full access" ON public.legal_leads;
CREATE POLICY "Service role full access" ON public.legal_leads
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "Users can view their own legal requests" ON public.legal_leads;
CREATE POLICY "Users can view their own legal requests" ON public.legal_leads
  FOR SELECT USING (auth.uid() = profile_id);

-- Pharmacy Leads
DROP POLICY IF EXISTS "Service role full access" ON public.pharmacy_leads;
CREATE POLICY "Service role full access" ON public.pharmacy_leads
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "Users can view their own pharmacy requests" ON public.pharmacy_leads;
CREATE POLICY "Users can view their own pharmacy requests" ON public.pharmacy_leads
  FOR SELECT USING (auth.uid() = profile_id);

-- Payment QR Codes
DROP POLICY IF EXISTS "Service role full access" ON public.payment_qr_codes;
CREATE POLICY "Service role full access" ON public.payment_qr_codes
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "Users can view their own QR codes" ON public.payment_qr_codes;
CREATE POLICY "Users can view their own QR codes" ON public.payment_qr_codes
  FOR SELECT USING (auth.uid() = profile_id);

-- Call Summaries
DROP POLICY IF EXISTS "Service role full access" ON public.call_summaries;
CREATE POLICY "Service role full access" ON public.call_summaries
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "Users can view their own call summaries" ON public.call_summaries;
CREATE POLICY "Users can view their own call summaries" ON public.call_summaries
  FOR SELECT USING (auth.uid() = profile_id);

-- =====================================================================
-- UPDATED_AT TRIGGERS
-- =====================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_property_listings_updated_at ON public.property_listings;
CREATE TRIGGER update_property_listings_updated_at
  BEFORE UPDATE ON public.property_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_job_listings_updated_at ON public.job_listings;
CREATE TRIGGER update_job_listings_updated_at
  BEFORE UPDATE ON public.job_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_job_candidates_updated_at ON public.job_candidates;
CREATE TRIGGER update_job_candidates_updated_at
  BEFORE UPDATE ON public.job_candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_marketplace_vendors_updated_at ON public.marketplace_vendors;
CREATE TRIGGER update_marketplace_vendors_updated_at
  BEFORE UPDATE ON public.marketplace_vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_legal_leads_updated_at ON public.legal_leads;
CREATE TRIGGER update_legal_leads_updated_at
  BEFORE UPDATE ON public.legal_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pharmacy_leads_updated_at ON public.pharmacy_leads;
CREATE TRIGGER update_pharmacy_leads_updated_at
  BEFORE UPDATE ON public.pharmacy_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_qr_codes_updated_at ON public.payment_qr_codes;
CREATE TRIGGER update_payment_qr_codes_updated_at
  BEFORE UPDATE ON public.payment_qr_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
