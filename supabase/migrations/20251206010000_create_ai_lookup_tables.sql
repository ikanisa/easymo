-- Phase 1: Create AI Agent Lookup Tables
-- Migration: 20251206010000_create_ai_lookup_tables.sql
-- 
-- Eliminates hardcoded configurations by creating database-driven lookup tables for:
-- - Service verticals (mobility, insurance, jobs, etc.)
-- - Job categories 
-- - Property types
-- - Insurance types
-- - Moderation rules (out-of-scope patterns)
-- - Tool enum values (dynamic enums for AI tool parameters)

BEGIN;

-- =====================================================
-- SERVICE VERTICALS TABLE
-- =====================================================
-- Replaces: packages/agents/src/config/service-catalog.ts::EASYMO_VERTICALS

CREATE TABLE IF NOT EXISTS public.service_verticals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  
  -- Associated agents for this vertical
  agent_slugs TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Keywords for intent detection
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Configuration
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  
  -- Country availability
  active_countries TEXT[] DEFAULT ARRAY['RW', 'BI', 'TZ', 'CD', 'ZM', 'TG', 'MT']::TEXT[],
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_service_verticals_slug ON public.service_verticals(slug);
CREATE INDEX idx_service_verticals_active ON public.service_verticals(is_active);
CREATE INDEX idx_service_verticals_priority ON public.service_verticals(priority DESC);

-- RLS policies
ALTER TABLE public.service_verticals ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_verticals_public_read ON public.service_verticals
  FOR SELECT USING (is_active = true);

-- Insert initial data from hardcoded SERVICE_CATALOG
INSERT INTO public.service_verticals (slug, name, description, agent_slugs, keywords, priority) VALUES
  ('mobility', 'Mobility & Transportation', 'Ride booking, driver matching, trip scheduling', 
   ARRAY['nearby-drivers', 'schedule-trip']::TEXT[], 
   ARRAY['ride', 'driver', 'transport', 'trip', 'taxi', 'moto', 'car', 'travel']::TEXT[], 10),
  
  ('commerce', 'Commerce & Shopping', 'Shop discovery, product search, vendor matching',
   ARRAY['shops', 'quincaillerie', 'pharmacy']::TEXT[],
   ARRAY['shop', 'buy', 'purchase', 'product', 'store', 'vendor', 'sell']::TEXT[], 9),
  
  ('hospitality', 'Hospitality & Dining', 'Restaurant booking, menu lookup, table reservations',
   ARRAY['waiter-ai', 'booking']::TEXT[],
   ARRAY['restaurant', 'menu', 'table', 'book', 'reserve', 'food', 'drink', 'bar', 'waiter']::TEXT[], 8),
  
  ('insurance', 'Insurance Services', 'Insurance quotes, policy management, claims',
   ARRAY['insurance']::TEXT[],
   ARRAY['insurance', 'policy', 'claim', 'coverage', 'premium']::TEXT[], 7),
  
  ('property', 'Real Estate', 'Property search, rental listings, landlord matching',
   ARRAY['real-estate', 'property-rental']::TEXT[],
   ARRAY['rent', 'house', 'apartment', 'property', 'land', 'room', 'lease', 'tenant', 'landlord']::TEXT[], 6),
  
  ('legal', 'Legal Services', 'Legal consultation, document preparation, lawyer matching',
   ARRAY['legal']::TEXT[],
   ARRAY['legal', 'lawyer', 'attorney', 'contract', 'court', 'law']::TEXT[], 5),
  
  ('jobs', 'Jobs & Employment', 'Job search, applications, employer matching',
   ARRAY['jobs-board']::TEXT[],
   ARRAY['job', 'work', 'career', 'hire', 'vacancy', 'employment', 'apply', 'resume', 'cv']::TEXT[], 4),
  
  ('farming', 'Farming & Agriculture', 'Commodity trading, market prices, farming services',
   ARRAY['farmers-agent']::TEXT[],
   ARRAY['farm', 'crop', 'seed', 'fertilizer', 'harvest', 'market', 'commodity', 'agriculture']::TEXT[], 3),
  
  ('marketing', 'Marketing & Sales', 'Campaign management, CRM, Sora video ads',
   ARRAY['marketing-sales']::TEXT[],
   ARRAY['marketing', 'campaign', 'ads', 'crm', 'sales', 'promotion', 'sora', 'video']::TEXT[], 2),
  
  ('sora_video', 'Sora Video Ads', 'AI-generated video advertisements using Sora-2',
   ARRAY['sora-video']::TEXT[],
   ARRAY['sora', 'video', 'ad', 'advertisement', 'ai video', 'generate video']::TEXT[], 1),
  
  ('payments', 'Payments & Wallet', 'Payment processing, wallet management, transfers',
   ARRAY['payments', 'wallet']::TEXT[],
   ARRAY['pay', 'payment', 'wallet', 'transfer', 'money', 'balance', 'topup']::TEXT[], 11),
  
  ('support', 'Customer Support', 'Help, troubleshooting, issue resolution',
   ARRAY['customer-support']::TEXT[],
   ARRAY['help', 'support', 'problem', 'issue', 'question', 'complaint', 'error']::TEXT[], 12)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- JOB CATEGORIES TABLE
-- =====================================================
-- Replaces hardcoded categories in: supabase/functions/wa-webhook/domains/ai-agents/jobs_agent.ts

CREATE TABLE IF NOT EXISTS public.job_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  
  -- Parent category for hierarchical structure
  parent_category_id UUID REFERENCES public.job_categories(id) ON DELETE SET NULL,
  
  -- Configuration
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  -- Country availability
  active_countries TEXT[] DEFAULT ARRAY['RW', 'BI', 'TZ', 'CD', 'ZM', 'TG', 'MT']::TEXT[],
  
  -- Multilingual support
  country_specific_names JSONB,
  
  -- Keywords for matching
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_job_categories_slug ON public.job_categories(slug);
CREATE INDEX idx_job_categories_active ON public.job_categories(is_active);
CREATE INDEX idx_job_categories_parent ON public.job_categories(parent_category_id);
CREATE INDEX idx_job_categories_display_order ON public.job_categories(display_order);

-- RLS policies
ALTER TABLE public.job_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_categories_public_read ON public.job_categories
  FOR SELECT USING (is_active = true);

-- Insert job categories from hardcoded prompts
INSERT INTO public.job_categories (slug, name, description, display_order, keywords) VALUES
  ('construction', 'Construction & Manual Labor', 'Building, masonry, carpentry, electrical work', 1,
   ARRAY['construction', 'builder', 'mason', 'carpenter', 'electrician', 'plumber']::TEXT[]),
  
  ('driving', 'Driving & Delivery', 'Taxi drivers, delivery riders, truck drivers', 2,
   ARRAY['driver', 'delivery', 'taxi', 'truck', 'moto', 'courier']::TEXT[]),
  
  ('hospitality', 'Hospitality & Restaurants', 'Waiters, chefs, bartenders, hotel staff', 3,
   ARRAY['waiter', 'chef', 'cook', 'bartender', 'hotel', 'restaurant']::TEXT[]),
  
  ('retail', 'Retail & Sales', 'Shop attendants, cashiers, sales representatives', 4,
   ARRAY['retail', 'sales', 'cashier', 'shop attendant', 'store']::TEXT[]),
  
  ('security', 'Security', 'Security guards, watchmen', 5,
   ARRAY['security', 'guard', 'watchman', 'surveillance']::TEXT[]),
  
  ('cleaning', 'Cleaning & Housekeeping', 'Cleaners, housekeepers, janitors', 6,
   ARRAY['cleaner', 'housekeeper', 'janitor', 'cleaning']::TEXT[]),
  
  ('agriculture', 'Agriculture', 'Farmworkers, gardeners, agricultural specialists', 7,
   ARRAY['farm', 'farmer', 'agriculture', 'gardener', 'farming']::TEXT[]),
  
  ('healthcare', 'Healthcare', 'Nurses, caregivers, medical assistants', 8,
   ARRAY['nurse', 'caregiver', 'medical', 'healthcare', 'doctor']::TEXT[]),
  
  ('education', 'Education & Teaching', 'Teachers, tutors, trainers', 9,
   ARRAY['teacher', 'tutor', 'trainer', 'education', 'teaching']::TEXT[]),
  
  ('it', 'IT & Technology', 'Software developers, IT support, tech specialists', 10,
   ARRAY['developer', 'programmer', 'it', 'tech', 'software', 'computer']::TEXT[]),
  
  ('admin', 'Administrative', 'Office assistants, receptionists, data entry', 11,
   ARRAY['admin', 'office', 'receptionist', 'secretary', 'data entry']::TEXT[]),
  
  ('other', 'Other', 'Other job categories', 99,
   ARRAY['other', 'general', 'misc']::TEXT[])
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- PROPERTY TYPES TABLE
-- =====================================================
-- Replaces hardcoded enums in tool schemas

CREATE TABLE IF NOT EXISTS public.property_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  
  -- Configuration
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  -- For rental/sale filtering
  is_residential BOOLEAN DEFAULT true,
  is_commercial BOOLEAN DEFAULT false,
  
  -- Country availability
  active_countries TEXT[] DEFAULT ARRAY['RW', 'BI', 'TZ', 'CD', 'ZM', 'TG', 'MT']::TEXT[],
  
  -- Multilingual support
  country_specific_names JSONB,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_property_types_slug ON public.property_types(slug);
CREATE INDEX idx_property_types_active ON public.property_types(is_active);
CREATE INDEX idx_property_types_residential ON public.property_types(is_residential);
CREATE INDEX idx_property_types_commercial ON public.property_types(is_commercial);

-- RLS policies
ALTER TABLE public.property_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY property_types_public_read ON public.property_types
  FOR SELECT USING (is_active = true);

-- Insert property types from hardcoded tool enums
INSERT INTO public.property_types (slug, name, description, is_residential, is_commercial, display_order) VALUES
  ('apartment', 'Apartment', 'Multi-unit residential building', true, false, 1),
  ('house', 'House', 'Single-family detached home', true, false, 2),
  ('villa', 'Villa', 'Luxury detached residence', true, false, 3),
  ('studio', 'Studio', 'Single-room living space', true, false, 4),
  ('townhouse', 'Townhouse', 'Multi-floor attached home', true, false, 5),
  ('commercial', 'Commercial', 'Business property', false, true, 6),
  ('office', 'Office Space', 'Commercial office', false, true, 7),
  ('shop', 'Shop/Retail', 'Retail space', false, true, 8),
  ('warehouse', 'Warehouse', 'Industrial storage', false, true, 9),
  ('land', 'Land', 'Undeveloped property', true, true, 10)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- INSURANCE TYPES TABLE
-- =====================================================
-- Replaces hardcoded enums in insurance tool schemas

CREATE TABLE IF NOT EXISTS public.insurance_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  
  -- Configuration
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  -- Coverage details
  typical_duration_months INTEGER,
  requires_inspection BOOLEAN DEFAULT false,
  
  -- Country availability
  active_countries TEXT[] DEFAULT ARRAY['RW', 'BI', 'TZ', 'CD', 'ZM', 'TG', 'MT']::TEXT[],
  
  -- Multilingual support
  country_specific_names JSONB,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_insurance_types_slug ON public.insurance_types(slug);
CREATE INDEX idx_insurance_types_active ON public.insurance_types(is_active);
CREATE INDEX idx_insurance_types_display_order ON public.insurance_types(display_order);

-- RLS policies
ALTER TABLE public.insurance_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY insurance_types_public_read ON public.insurance_types
  FOR SELECT USING (is_active = true);

-- Insert insurance types from hardcoded tool enums
INSERT INTO public.insurance_types (slug, name, description, requires_inspection, typical_duration_months, display_order) VALUES
  ('motor', 'Motor Insurance', 'Car, motorcycle, and vehicle insurance', true, 12, 1),
  ('health', 'Health Insurance', 'Medical and health coverage', false, 12, 2),
  ('travel', 'Travel Insurance', 'International travel coverage', false, 1, 3),
  ('life', 'Life Insurance', 'Life and disability coverage', false, 12, 4),
  ('property', 'Property Insurance', 'Home and property damage coverage', true, 12, 5),
  ('business', 'Business Insurance', 'Commercial liability coverage', true, 12, 6)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- MODERATION RULES TABLE
-- =====================================================
-- Replaces: packages/agents/src/config/service-catalog.ts::OUT_OF_SCOPE_PATTERNS

CREATE TABLE IF NOT EXISTS public.moderation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('out_of_scope', 'blocked', 'flagged', 'allowed')),
  pattern TEXT NOT NULL,
  description TEXT,
  
  -- Category for organization
  category TEXT,
  
  -- Configuration
  is_active BOOLEAN DEFAULT true,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Regex flags (case_insensitive, multiline, etc.)
  regex_flags TEXT DEFAULT 'i',
  
  -- Response when triggered
  auto_response_template TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add missing columns if they don't exist (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'moderation_rules' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.moderation_rules ADD COLUMN description TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'moderation_rules' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.moderation_rules ADD COLUMN category TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'moderation_rules' AND column_name = 'severity'
  ) THEN
    ALTER TABLE public.moderation_rules ADD COLUMN severity TEXT DEFAULT 'medium';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'moderation_rules' AND column_name = 'regex_flags'
  ) THEN
    ALTER TABLE public.moderation_rules ADD COLUMN regex_flags TEXT DEFAULT 'i';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'moderation_rules' AND column_name = 'auto_response_template'
  ) THEN
    ALTER TABLE public.moderation_rules ADD COLUMN auto_response_template TEXT;
  END IF;
END $$;

-- Update check constraint to include new rule types
ALTER TABLE public.moderation_rules DROP CONSTRAINT IF EXISTS moderation_rules_rule_type_check;
ALTER TABLE public.moderation_rules ADD CONSTRAINT moderation_rules_rule_type_check 
  CHECK (rule_type IN ('out_of_scope', 'prohibited', 'sensitive', 'blocked', 'flagged', 'allowed'));

CREATE INDEX IF NOT EXISTS idx_moderation_rules_type ON public.moderation_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_moderation_rules_active ON public.moderation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_moderation_rules_category ON public.moderation_rules(category);

-- RLS policies
ALTER TABLE public.moderation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS moderation_rules_admin_all ON public.moderation_rules;
CREATE POLICY moderation_rules_admin_all ON public.moderation_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS moderation_rules_public_read ON public.moderation_rules;
CREATE POLICY moderation_rules_public_read ON public.moderation_rules
  FOR SELECT USING (is_active = true);

-- Insert moderation rules from hardcoded OUT_OF_SCOPE_PATTERNS (skip if pattern already exists)
INSERT INTO public.moderation_rules (rule_type, pattern, description, category, severity)
SELECT * FROM (VALUES
  ('out_of_scope', 'news|politics|election|government|president', 
   'Political and news topics', 'politics', 'medium'),
  
  ('out_of_scope', 'health|medical|doctor|medicine|covid|disease', 
   'Medical and health advice (not insurance)', 'health', 'high'),
  
  ('out_of_scope', 'quantum|physics|chemistry|science|biology', 
   'Academic science topics', 'academic', 'low'),
  
  ('out_of_scope', 'weather|climate|temperature|forecast', 
   'Weather and climate queries', 'weather', 'low'),
  
  ('out_of_scope', 'sports|football|basketball|soccer|tennis', 
   'Sports and games', 'sports', 'low'),
  
  ('out_of_scope', 'celebrity|entertainment|movie|film|music|song', 
   'Entertainment and celebrities', 'entertainment', 'low'),
  
  ('out_of_scope', 'school|homework|exam|study|university|college', 
   'Educational homework help', 'education', 'medium'),
  
  ('out_of_scope', 'recipe|cooking(?! oil)|baking', 
   'Cooking recipes (cooking oil allowed as commodity)', 'cooking', 'low'),
  
  ('out_of_scope', 'history|geography|math|calculus', 
   'Academic subject help', 'academic', 'low'),
  
  ('blocked', 'password|credit card|bank account|ssn|pin code', 
   'Sensitive personal information', 'security', 'critical'),
  
  ('flagged', 'urgent|emergency|help|police', 
   'Potential emergency situations', 'safety', 'high')
) AS new_rules(rule_type, pattern, description, category, severity)
WHERE NOT EXISTS (
  SELECT 1 FROM public.moderation_rules 
  WHERE pattern = new_rules.pattern
);

-- =====================================================
-- TOOL ENUM VALUES TABLE
-- =====================================================
-- Dynamic enums for AI tool parameters (eliminates hardcoded enums in tool definitions)

CREATE TABLE IF NOT EXISTS public.tool_enum_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enum_type TEXT NOT NULL, -- e.g., 'agent_id', 'vertical', 'insurance_type'
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  
  -- References to other tables for consistency
  reference_table TEXT,
  reference_column TEXT,
  
  -- Configuration
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  -- Country/context filtering
  context_filter JSONB, -- { countries: ['RW'], agents: ['insurance'] }
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(enum_type, value)
);

CREATE INDEX idx_tool_enum_values_type ON public.tool_enum_values(enum_type);
CREATE INDEX idx_tool_enum_values_active ON public.tool_enum_values(is_active);
CREATE INDEX idx_tool_enum_values_display_order ON public.tool_enum_values(display_order);

-- RLS policies
ALTER TABLE public.tool_enum_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY tool_enum_values_public_read ON public.tool_enum_values
  FOR SELECT USING (is_active = true);

-- Insert enum values for AI tools
-- Agent IDs for run_agent tool
INSERT INTO public.tool_enum_values (enum_type, value, label, description, display_order) VALUES
  ('agent_id', 'real-estate-rentals', 'Real Estate Agent', 'Property rentals and sales', 1),
  ('agent_id', 'rides-matching', 'Rides Agent', 'Transportation and mobility', 2),
  ('agent_id', 'jobs-marketplace', 'Jobs Agent', 'Employment and job search', 3),
  ('agent_id', 'waiter-restaurants', 'Waiter Agent', 'Restaurant and hospitality', 4),
  ('agent_id', 'insurance-broker', 'Insurance Agent', 'Insurance quotes and policies', 5),
  ('agent_id', 'farmers-market', 'Farmers Agent', 'Agriculture and farming', 6),
  ('agent_id', 'buy-and-sell', 'Buy & Sell Agent', 'Business directory', 7)
ON CONFLICT (enum_type, value) DO NOTHING;

-- Verticals for broker tools (references service_verticals table)
INSERT INTO public.tool_enum_values (enum_type, value, label, reference_table, reference_column, display_order)
SELECT 
  'vertical' as enum_type,
  slug as value,
  name as label,
  'service_verticals' as reference_table,
  'slug' as reference_column,
  priority as display_order
FROM public.service_verticals
WHERE is_active = true
ON CONFLICT (enum_type, value) DO NOTHING;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get active enum values for a tool parameter
CREATE OR REPLACE FUNCTION public.get_tool_enum_values(p_enum_type TEXT)
RETURNS TABLE(value TEXT, label TEXT, description TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tev.value,
    tev.label,
    tev.description
  FROM public.tool_enum_values tev
  WHERE tev.enum_type = p_enum_type
    AND tev.is_active = true
  ORDER BY tev.display_order, tev.label;
END;
$$;

-- Function to check if query is out of scope
CREATE OR REPLACE FUNCTION public.is_query_out_of_scope(p_query TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rule RECORD;
BEGIN
  FOR v_rule IN 
    SELECT pattern, regex_flags
    FROM public.moderation_rules
    WHERE rule_type = 'out_of_scope'
      AND is_active = true
  LOOP
    IF p_query ~* v_rule.pattern THEN
      RETURN true;
    END IF;
  END LOOP;
  
  RETURN false;
END;
$$;

-- Function to detect vertical from query keywords
CREATE OR REPLACE FUNCTION public.detect_vertical_from_query(p_query TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vertical RECORD;
  v_keyword TEXT;
  v_match_count INTEGER;
  v_best_match TEXT := NULL;
  v_best_score INTEGER := 0;
BEGIN
  -- Normalize query
  p_query := lower(p_query);
  
  -- Check each vertical
  FOR v_vertical IN 
    SELECT slug, keywords
    FROM public.service_verticals
    WHERE is_active = true
  LOOP
    v_match_count := 0;
    
    -- Count keyword matches
    FOREACH v_keyword IN ARRAY v_vertical.keywords
    LOOP
      IF p_query LIKE '%' || v_keyword || '%' THEN
        v_match_count := v_match_count + 1;
      END IF;
    END LOOP;
    
    -- Track best match
    IF v_match_count > v_best_score THEN
      v_best_score := v_match_count;
      v_best_match := v_vertical.slug;
    END IF;
  END LOOP;
  
  RETURN v_best_match;
END;
$$;

-- =====================================================
-- UPDATE TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_service_verticals_updated_at BEFORE UPDATE ON public.service_verticals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_categories_updated_at BEFORE UPDATE ON public.job_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_property_types_updated_at BEFORE UPDATE ON public.property_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_insurance_types_updated_at BEFORE UPDATE ON public.insurance_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_moderation_rules_updated_at BEFORE UPDATE ON public.moderation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tool_enum_values_updated_at BEFORE UPDATE ON public.tool_enum_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
