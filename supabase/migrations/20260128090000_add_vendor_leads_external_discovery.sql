-- =============================================================================
-- External vendor discovery lead storage (additive)
-- =============================================================================

BEGIN;

-- Leads discovered via web/maps/social or manual entry
CREATE TABLE IF NOT EXISTS public.vendor_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NULL,
  source TEXT NOT NULL, -- openai_web_search | gemini_google_grounding | maps_places | social | manual
  name TEXT NOT NULL,
  category_guess TEXT NULL,
  area TEXT NULL,
  address TEXT NULL,
  phones TEXT[] NULL,
  website TEXT NULL,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','enriched','invited','opted_in','converted','rejected')),
  dedupe_key TEXT NOT NULL,
  raw_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_leads_dedupe_key
  ON public.vendor_leads(dedupe_key);

CREATE INDEX IF NOT EXISTS idx_vendor_leads_request_id
  ON public.vendor_leads(request_id);

CREATE INDEX IF NOT EXISTS idx_vendor_leads_status
  ON public.vendor_leads(status);

CREATE INDEX IF NOT EXISTS idx_vendor_leads_source
  ON public.vendor_leads(source);

-- Enrichment records (maps/web/social)
CREATE TABLE IF NOT EXISTS public.vendor_lead_enrichment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.vendor_leads(id) ON DELETE CASCADE,
  enrichment_type TEXT NOT NULL, -- maps | web | social
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_lead_enrichment_lead_id
  ON public.vendor_lead_enrichment(lead_id);

CREATE INDEX IF NOT EXISTS idx_vendor_lead_enrichment_type
  ON public.vendor_lead_enrichment(enrichment_type);

-- Onboarding invites for leads (opt-in)
CREATE TABLE IF NOT EXISTS public.vendor_onboarding_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.vendor_leads(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  invite_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','delivered','accepted','expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_onboarding_invites_lead_id
  ON public.vendor_onboarding_invites(lead_id);

CREATE INDEX IF NOT EXISTS idx_vendor_onboarding_invites_status
  ON public.vendor_onboarding_invites(status);

-- Social profile captures for leads
CREATE TABLE IF NOT EXISTS public.vendor_social_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.vendor_leads(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- instagram | facebook | linkedin | tiktok | x
  handle TEXT NULL,
  profile_url TEXT NOT NULL,
  display_name TEXT NULL,
  phone TEXT NULL,
  email TEXT NULL,
  address TEXT NULL,
  category_guess TEXT NULL,
  raw JSONB NOT NULL,
  confidence NUMERIC NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_social_profiles_platform_url
  ON public.vendor_social_profiles(platform, profile_url);

CREATE INDEX IF NOT EXISTS idx_vendor_social_profiles_lead_id
  ON public.vendor_social_profiles(lead_id);

-- RLS: service_role only by default
ALTER TABLE public.vendor_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_lead_enrichment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_onboarding_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_social_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "service_role_full_vendor_leads"
  ON public.vendor_leads FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "service_role_full_vendor_lead_enrichment"
  ON public.vendor_lead_enrichment FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "service_role_full_vendor_onboarding_invites"
  ON public.vendor_onboarding_invites FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "service_role_full_vendor_social_profiles"
  ON public.vendor_social_profiles FOR ALL
  USING (auth.role() = 'service_role');

COMMIT;
