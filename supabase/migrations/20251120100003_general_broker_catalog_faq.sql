-- General Broker Agent: Service Catalog & FAQ
-- Platform knowledge for agent discovery and FAQs

BEGIN;

-- EasyMO service catalog (for agent discovery)
CREATE TABLE IF NOT EXISTS public.service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  docs_url TEXT,
  keywords TEXT[] DEFAULT '{}'::text[],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FAQ for EasyMO platform questions
CREATE TABLE IF NOT EXISTS public.faq_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  locale TEXT DEFAULT 'en' CHECK (locale IN ('en','fr','rw','sw','ln')),
  tags TEXT[] DEFAULT '{}'::text[],
  vertical TEXT,  -- Optional: link to a specific vertical
  views_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_catalog_vertical ON public.service_catalog(vertical);
CREATE INDEX IF NOT EXISTS idx_service_catalog_enabled ON public.service_catalog(enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_faq_locale ON public.faq_articles(locale);
CREATE INDEX IF NOT EXISTS idx_faq_tags ON public.faq_articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_faq_active ON public.faq_articles(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_faq_vertical ON public.faq_articles(vertical);

-- Add unique constraints for idempotency
ALTER TABLE public.service_catalog ADD CONSTRAINT service_catalog_vertical_key UNIQUE (vertical);
ALTER TABLE public.faq_articles ADD CONSTRAINT faq_articles_question_locale_key UNIQUE (question, locale);

-- RLS
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_articles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_catalog' AND policyname = 'service_catalog_select') THEN
    CREATE POLICY "service_catalog_select" ON public.service_catalog FOR SELECT USING (enabled = TRUE);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'faq_articles' AND policyname = 'faq_articles_select') THEN
    CREATE POLICY "faq_articles_select" ON public.faq_articles FOR SELECT USING (is_active = TRUE);
  END IF;
END $$;

-- Admin policies (adjust based on your auth setup)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_catalog' AND policyname = 'service_catalog_admin') THEN
    CREATE POLICY "service_catalog_admin" ON public.service_catalog FOR ALL USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'staff'))
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'faq_articles' AND policyname = 'faq_articles_admin') THEN
    CREATE POLICY "faq_articles_admin" ON public.faq_articles FOR ALL USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'staff'))
    );
  END IF;
END $$;

-- Seed initial service catalog
INSERT INTO public.service_catalog (vertical, name, description, keywords) VALUES
  ('mobility', 'Mobility & Transportation', 'Ride booking, driver matching, trip scheduling', ARRAY['ride', 'driver', 'transport', 'trip', 'taxi', 'moto']),
  ('commerce', 'Commerce & Shopping', 'Shop discovery, product search, vendor matching', ARRAY['shop', 'buy', 'purchase', 'product', 'store', 'vendor']),
  ('hospitality', 'Hospitality & Dining', 'Restaurant booking, menu lookup, table reservations', ARRAY['restaurant', 'menu', 'table', 'food', 'bar', 'waiter']),
  ('insurance', 'Insurance Services', 'Insurance quotes, policy management, claims', ARRAY['insurance', 'policy', 'claim', 'coverage', 'premium']),
  ('property', 'Real Estate', 'Property search, rental listings, landlord matching', ARRAY['rent', 'house', 'apartment', 'property', 'land', 'room']),
  ('legal', 'Legal Services', 'Legal consultation, document preparation, lawyer matching', ARRAY['legal', 'lawyer', 'attorney', 'contract', 'court']),
  ('jobs', 'Jobs & Employment', 'Job search, applications, employer matching', ARRAY['job', 'work', 'career', 'hire', 'vacancy', 'employment']),
  ('farming', 'Farming & Agriculture', 'Commodity trading, market prices, farming services', ARRAY['farm', 'crop', 'seed', 'fertilizer', 'harvest', 'agriculture']),
  ('marketing', 'Marketing & Sales', 'Campaign management, CRM, lead generation', ARRAY['marketing', 'campaign', 'ads', 'crm', 'sales', 'promotion']),
  ('sora_video', 'Sora Video Ads', 'AI-generated video advertisements using Sora-2', ARRAY['sora', 'video', 'ad', 'advertisement', 'ai video']),
  ('support', 'Customer Support', 'Help, troubleshooting, issue resolution', ARRAY['help', 'support', 'problem', 'issue', 'question', 'complaint'])
ON CONFLICT (vertical) DO NOTHING;

-- Seed initial FAQs
INSERT INTO public.faq_articles (question, answer, locale, tags) VALUES
  ('What is EasyMO?', 'EasyMO is a WhatsApp-based platform connecting you to services like mobility, shopping, property, jobs, insurance, and more—all in one chat.', 'en', ARRAY['platform', 'general']),
  ('What services are available?', 'EasyMO offers: Mobility, Commerce, Hospitality, Insurance, Property, Legal, Jobs, Farming, Marketing, and Sora Video Ads.', 'en', ARRAY['services', 'general']),
  ('How do I get started?', 'Just send a message on WhatsApp describing what you need. Our AI assistant will guide you through the process.', 'en', ARRAY['onboarding', 'general']),
  ('Which countries does EasyMO support?', 'Currently available in Rwanda, with expansion to other East African countries coming soon.', 'en', ARRAY['coverage', 'general']),
  ('How do I register my business?', 'Send "I want to register my shop/business" and our assistant will guide you through the vendor onboarding process.', 'en', ARRAY['vendor', 'onboarding'])
ON CONFLICT (question, locale) DO NOTHING;

COMMIT;
