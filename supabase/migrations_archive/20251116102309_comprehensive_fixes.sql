-- Comprehensive Fixes Migration
-- 1. Customer support contacts
-- 2. AI agents configuration
-- 3. Insurance admin contacts
-- 4. Language options
-- 5. Profile menu by region

BEGIN;

-- ================================================================
-- 1. CUSTOMER SUPPORT CONTACTS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS customer_support_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_type TEXT NOT NULL CHECK (contact_type IN ('phone', 'whatsapp', 'email')),
  contact_value TEXT NOT NULL,
  display_name TEXT NOT NULL,
  country_code TEXT REFERENCES countries(code),
  department TEXT, -- 'customer_support', 'sales', 'technical', etc.
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customer_support_active ON customer_support_contacts(is_active, display_order);
CREATE INDEX idx_customer_support_dept ON customer_support_contacts(department) WHERE is_active = true;

-- Insert customer support numbers
INSERT INTO customer_support_contacts (contact_type, contact_value, display_name, department, display_order) VALUES
('whatsapp', '+250795588248', '🇷🇼 Rwanda Support', 'customer_support', 1),
('whatsapp', '+250793094876', '🇷🇼 Rwanda Support 2', 'customer_support', 2),
('whatsapp', '+35679630859', '🇲🇹 Malta Support', 'customer_support', 3);

-- ================================================================
-- 2. INSURANCE ADMIN CONTACTS
-- ================================================================
CREATE TABLE IF NOT EXISTS insurance_admin_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_type TEXT NOT NULL CHECK (contact_type IN ('phone', 'whatsapp', 'email')),
  contact_value TEXT NOT NULL,
  display_name TEXT NOT NULL,
  country_code TEXT REFERENCES countries(code),
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insurance_admin_active ON insurance_admin_contacts(is_active, display_order);

-- Add insurance admin contacts (add actual numbers here)
INSERT INTO insurance_admin_contacts (contact_type, contact_value, display_name, country_code, display_order) VALUES
('whatsapp', '+250788000001', '🏥 Insurance Admin RW', 'RW', 1),
('whatsapp', '+250788000002', '🏥 Insurance Admin RW 2', 'RW', 2);

-- ================================================================
-- 3. AI AGENTS CONFIGURATION TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS ai_agents_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key TEXT UNIQUE NOT NULL, -- 'customer_support', 'sales_marketing', etc.
  agent_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  persona TEXT NOT NULL, -- Agent personality description
  system_prompt TEXT NOT NULL, -- System instructions
  model_name TEXT DEFAULT 'gpt-4o-mini',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1000,
  tools JSONB DEFAULT '[]'::jsonb, -- Available tools/functions
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_agents_active ON ai_agents_config(is_active);
CREATE INDEX idx_ai_agents_key ON ai_agents_config(agent_key) WHERE is_active = true;

-- Customer Support AI Agent
INSERT INTO ai_agents_config (agent_key, agent_name, persona, system_prompt, tools) VALUES
('customer_support', 
 'Customer Support Agent',
 'You are a friendly, helpful, and professional customer support agent for EasyMO, a WhatsApp-based mobility and services platform in Africa. You are empathetic, patient, and always aim to resolve customer issues quickly.',
 'Your role is to assist users with:
- Account issues and registration
- Service inquiries (transport, jobs, property, insurance)
- Payment and MOMO wallet questions
- Technical troubleshooting
- General platform navigation

Always:
- Be polite and professional
- Ask clarifying questions if needed
- Provide step-by-step guidance
- Escalate complex issues to human support
- Use simple language
- Respond in the user''s preferred language

If you cannot resolve an issue, offer to connect the user with human support.',
 '[{"name": "escalate_to_human", "description": "Escalate issue to human support team"}, {"name": "check_user_account", "description": "Check user account status"}]'::jsonb
),
('sales_marketing',
 'Sales & Marketing Agent', 
 'You are an energetic, knowledgeable sales and marketing specialist for EasyMO. You help users discover our services, understand pricing, and see the value we provide across African markets.',
 'Your role is to:
- Introduce EasyMO services to new users
- Explain pricing and packages
- Highlight benefits and features
- Answer pre-sales questions
- Guide users through registration
- Promote special offers

Always:
- Be enthusiastic but not pushy
- Focus on value and benefits
- Use storytelling when appropriate
- Provide clear pricing information
- Respect user preferences
- Be culturally aware

Convert inquiries into active users while maintaining authenticity.',
 '[{"name": "get_pricing", "description": "Fetch current pricing for services"}, {"name": "check_country_availability", "description": "Check if service is available in user country"}]'::jsonb
);

-- ================================================================
-- 4. UPDATE PROFILE MENU FOR REGIONAL SUPPORT
-- ================================================================

-- Add region classification to profile menu items
ALTER TABLE whatsapp_profile_menu_items 
ADD COLUMN IF NOT EXISTS region_restrictions TEXT[] DEFAULT NULL;

-- Update to show all items in Africa, limited items in Europe/UK/Canada
-- African countries: Show all items
-- Europe/UK/Canada: Only businesses, properties, language, help

UPDATE whatsapp_profile_menu_items 
SET region_restrictions = NULL -- NULL means show everywhere
WHERE key IN ('my_businesses', 'my_properties', 'change_language', 'help_support');

UPDATE whatsapp_profile_menu_items
SET region_restrictions = ARRAY['africa']::TEXT[] -- Only show in Africa
WHERE key IN ('my_vehicles', 'my_jobs', 'momo_qr', 'saved_locations');

-- ================================================================
-- 5. SUPPORTED LANGUAGES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS supported_languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'en', 'fr', 'es', 'pt', 'de'
  name TEXT NOT NULL,
  native_name TEXT NOT NULL,
  flag_emoji TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_supported_languages_active ON supported_languages(is_active, display_order);

INSERT INTO supported_languages (code, name, native_name, flag_emoji, display_order) VALUES
('en', 'English', 'English', '🇬🇧', 1),
('fr', 'French', 'Français', '🇫🇷', 2),
('es', 'Spanish', 'Español', '🇪🇸', 3),
('pt', 'Portuguese', 'Português', '🇵🇹', 4),
('de', 'German', 'Deutsch', '🇩🇪', 5)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  native_name = EXCLUDED.native_name,
  flag_emoji = EXCLUDED.flag_emoji,
  display_order = EXCLUDED.display_order;

COMMIT;
