-- FIX: Split into TWO separate menu items as intended
-- 1. Buy and Sell (WhatsApp workflow - category selection)
-- 2. Chat with Agent (AI natural language chat)

BEGIN;

-- Remove the incorrectly combined menu item
DELETE FROM public.whatsapp_home_menu_items WHERE key = 'business_broker_agent';

-- 1. Buy and Sell - WhatsApp Workflow (Category Selection)
-- Uses wa-webhook-buy-sell function
-- User flow: Select category → Share location → Get nearby businesses
INSERT INTO public.whatsapp_home_menu_items (
  key,
  name,
  icon,
  is_active,
  active_countries,
  display_order,
  country_specific_names
) VALUES (
  'buy_sell_categories',
  '🛒 Buy and Sell',
  '🛒',
  true,
  ARRAY['RW', 'BI', 'TZ', 'CD', 'ZM', 'TG', 'MT'],
  4,
  jsonb_build_object(
    'MT', jsonb_build_object('name', '🛒 Buy & Sell', 'description', 'Browse categories and find businesses'),
    'BI', jsonb_build_object('name', '🛒 Acheter & Vendre', 'description', 'Parcourir les catégories'),
    'TZ', jsonb_build_object('name', '🛒 Nunua & Uza', 'description', 'Tazama makundi ya biashara'),
    'CD', jsonb_build_object('name', '🛒 Acheter & Vendre', 'description', 'Parcourir les catégories'),
    'ZM', jsonb_build_object('name', '🛒 Buy & Sell', 'description', 'Browse categories'),
    'TG', jsonb_build_object('name', '🛒 Acheter & Vendre', 'description', 'Parcourir les catégories')
  )
);

-- 2. Chat with Agent - AI Natural Language Chat
-- Uses agent-buy-sell function for AI processing
-- User flow: Type natural language query → AI searches with tags → Get results
INSERT INTO public.whatsapp_home_menu_items (
  key,
  name,
  icon,
  is_active,
  active_countries,
  display_order,
  country_specific_names
) VALUES (
  'business_broker_agent',
  '🤖 Chat with Agent',
  '🤖',
  true,
  ARRAY['RW', 'BI', 'TZ', 'CD', 'ZM', 'TG', 'MT'],
  5,
  jsonb_build_object(
    'MT', jsonb_build_object('name', '🤖 Chat with Agent', 'description', 'AI-powered business search'),
    'BI', jsonb_build_object('name', '🤖 Discuter avec Agent', 'description', 'Recherche IA'),
    'TZ', jsonb_build_object('name', '🤖 Ongea na Agent', 'description', 'Tafuta kwa AI'),
    'CD', jsonb_build_object('name', '🤖 Discuter avec Agent', 'description', 'Recherche IA'),
    'ZM', jsonb_build_object('name', '🤖 Chat with Agent', 'description', 'AI-powered search'),
    'TG', jsonb_build_object('name', '🤖 Discuter avec Agent', 'description', 'Recherche IA')
  )
);

COMMIT;
