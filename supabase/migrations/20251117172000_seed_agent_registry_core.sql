BEGIN;

-- Ensure core agents exist in agent_registry with basic config

INSERT INTO public.agent_registry (agent_type, display_name, description, slug, languages, autonomy, guardrails, instructions)
VALUES
  ('waiter_ai', 'Waiter AI – Dine-in & Takeaway', 'Multilingual WhatsApp waiter for venues', 'waiter-ai', ARRAY['en','fr','es','de','pt'], 'auto', '{"pii_minimization":true}'::jsonb, 'You are a multilingual AI waiter operating via WhatsApp for bars, cafes, and restaurants. Always use tools to read menu and prices. Confirm orders and process mobile money payments. Be warm and concise.'),
  ('property_rental', 'Real Estate AI – Rentals & Stays', 'WhatsApp rental concierge for Rwanda & Malta', 'real-estate-ai', ARRAY['en','fr','es','de','pt'], 'suggest', '{"payments":"disabled"}'::jsonb, 'You are a multilingual real estate assistant for rentals and stays. Capture requirements, search internal listings, use deep search as needed, create a shortlist and schedule viewings. Do not take payments.'),
  ('job_board_ai', 'Job Board AI – Jobs & Gigs', 'WhatsApp job concierge for seekers and posters', 'job-board-ai', ARRAY['en','fr','rw','sw','ln'], 'auto', '{"pii_minimization":true}'::jsonb, 'You help job seekers and posters structure profiles and job posts. Generate embeddings for matching and show top matches with simple, friendly language.'),
  ('sales_marketing', 'Sales & Marketing AI – Growth Copilot', 'Multilingual growth copilot for campaigns and content', 'marketing-sales', ARRAY['en','fr','es','it'], 'suggest', '{"anti_spam":true}'::jsonb, 'You are the Sales & Marketing AI agent for EasyMO. Turn goals into simple multi-channel campaigns (WhatsApp/SMS/email/social), generate content, and suggest next steps. Avoid spammy or unethical recommendations.')
ON CONFLICT (agent_type) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    slug = EXCLUDED.slug,
    languages = EXCLUDED.languages,
    autonomy = EXCLUDED.autonomy,
    guardrails = EXCLUDED.guardrails,
    instructions = EXCLUDED.instructions;

COMMIT;

