-- =====================================================================
-- SEED DATA: AI AGENTS + RIDES & INSURANCE
-- =====================================================================
-- Seed 8 AI agents: Waiter, Farmer, Broker, Real Estate, Jobs, 
-- Sales Cold Caller, Rides, Insurance
-- =====================================================================

BEGIN;

-- Insert 8 AI agents
INSERT INTO public.ai_agents (slug, name, description, default_language, default_channel, is_active)
VALUES
  ('waiter', 'Waiter AI Agent', 'Virtual waiter/sommelier for restaurant orders, menu queries, and table service via WhatsApp', 'multi', 'whatsapp', true),
  ('farmer', 'Farmer AI Agent', 'Connects farmers with buyers for produce listings, orders, and agricultural services via WhatsApp', 'multi', 'whatsapp', true),
  ('broker', 'Business Broker AI Agent', 'General business directory broker for connecting vendors and service providers via WhatsApp', 'multi', 'whatsapp', true),
  ('real_estate', 'Real Estate AI Agent', 'Property search, listings, and rental matching agent via WhatsApp', 'multi', 'whatsapp', true),
  ('jobs', 'Jobs AI Agent', 'Job posting, job seeking, and employment matching agent via WhatsApp', 'multi', 'whatsapp', true),
  ('sales_cold_caller', 'Sales/Marketing Cold Caller AI Agent', 'Outbound sales, lead qualification, and marketing campaigns via WhatsApp', 'multi', 'whatsapp', true),
  ('rides', 'Rides AI Agent', 'Handles nearby drivers/passengers and scheduled trips via WhatsApp', 'multi', 'whatsapp', true),
  ('insurance', 'Insurance AI Agent', 'Manages insurance info, documents & connects to insurers via WhatsApp', 'multi', 'whatsapp', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  default_language = EXCLUDED.default_language,
  default_channel = EXCLUDED.default_channel,
  is_active = EXCLUDED.is_active,
  updated_at = now();

COMMIT;
