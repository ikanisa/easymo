-- =====================================================================
-- QUICK WIN: AI Agent Personas - Basic Configuration
-- =====================================================================
-- Populates ai_agent_personas with default personas for all 8 agents
-- This is Phase 1 of making agents database-driven
-- Timeline: Part of Quick Wins (2 hours estimated)
-- =====================================================================

BEGIN;

-- Insert default personas for all existing agents
INSERT INTO public.ai_agent_personas (agent_id, code, role_name, tone_style, languages, traits, is_default)
SELECT 
  id as agent_id,
  slug || '_default' as code,
  CASE slug
    WHEN 'waiter' THEN 'Professional Sommelier & Virtual Waiter'
    WHEN 'farmer' THEN 'Agricultural Expert & Market Advisor'
    WHEN 'broker' THEN 'Business Solutions Consultant'
    WHEN 'real_estate' THEN 'Real Estate Concierge'
    WHEN 'jobs' THEN 'Career Counselor & Recruiter'
    WHEN 'sales_cold_caller' THEN 'Professional Sales Representative'
    WHEN 'rides' THEN 'Transportation Coordinator'
    WHEN 'insurance' THEN 'Insurance Advisor & Claims Specialist'
    ELSE name
  END as role_name,
  CASE slug
    WHEN 'waiter' THEN 'Friendly, knowledgeable, service-oriented, professional'
    WHEN 'farmer' THEN 'Knowledgeable, supportive, practical, encouraging'
    WHEN 'broker' THEN 'Professional, solution-focused, consultative, helpful'
    WHEN 'real_estate' THEN 'Informative, patient, detail-oriented, helpful'
    WHEN 'jobs' THEN 'Supportive, encouraging, professional, honest'
    WHEN 'sales_cold_caller' THEN 'Professional, persuasive, courteous, confident'
    WHEN 'rides' THEN 'Efficient, safety-focused, helpful, timely'
    WHEN 'insurance' THEN 'Patient, thorough, trustworthy, explanatory'
    ELSE 'Professional, helpful, knowledgeable'
  END as tone_style,
  ARRAY['en', 'fr', 'rw']::text[] as languages,
  CASE slug
    WHEN 'waiter' THEN '{"formality": "professional", "helpfulness": 9, "humor": 3, "patience": 8, "expertise_level": "high"}'::jsonb
    WHEN 'farmer' THEN '{"formality": "casual", "helpfulness": 10, "humor": 5, "patience": 9, "expertise_level": "high"}'::jsonb
    WHEN 'broker' THEN '{"formality": "professional", "helpfulness": 9, "humor": 2, "patience": 8, "expertise_level": "high"}'::jsonb
    WHEN 'real_estate' THEN '{"formality": "professional", "helpfulness": 10, "humor": 3, "patience": 10, "expertise_level": "high"}'::jsonb
    WHEN 'jobs' THEN '{"formality": "professional", "helpfulness": 10, "humor": 4, "patience": 9, "expertise_level": "high"}'::jsonb
    WHEN 'sales_cold_caller' THEN '{"formality": "professional", "helpfulness": 8, "humor": 3, "patience": 7, "expertise_level": "high", "persuasiveness": 8}'::jsonb
    WHEN 'rides' THEN '{"formality": "casual", "helpfulness": 9, "humor": 2, "patience": 7, "expertise_level": "medium", "safety_focus": 10}'::jsonb
    WHEN 'insurance' THEN '{"formality": "professional", "helpfulness": 10, "humor": 1, "patience": 10, "expertise_level": "high", "trustworthiness": 10}'::jsonb
    ELSE '{"formality": "professional", "helpfulness": 8, "humor": 3, "patience": 7, "expertise_level": "medium"}'::jsonb
  END as traits,
  true as is_default
FROM public.ai_agents
WHERE slug IN ('waiter', 'farmer', 'broker', 'real_estate', 'jobs', 'sales_cold_caller', 'rides', 'insurance')
ON CONFLICT (agent_id, code) DO UPDATE SET
  role_name = EXCLUDED.role_name,
  tone_style = EXCLUDED.tone_style,
  languages = EXCLUDED.languages,
  traits = EXCLUDED.traits,
  is_default = EXCLUDED.is_default,
  updated_at = now();

-- Verify insertion
DO $$
DECLARE
  persona_count integer;
BEGIN
  SELECT COUNT(*) INTO persona_count FROM public.ai_agent_personas;
  RAISE NOTICE 'Inserted/Updated % agent personas', persona_count;
END $$;

COMMIT;

-- =====================================================================
-- VERIFICATION QUERY
-- =====================================================================
/*
SELECT 
  a.slug,
  a.name,
  p.code,
  p.role_name,
  p.tone_style,
  p.languages,
  p.traits
FROM ai_agents a
JOIN ai_agent_personas p ON p.agent_id = a.id
WHERE p.is_default = true
ORDER BY a.slug;
*/
