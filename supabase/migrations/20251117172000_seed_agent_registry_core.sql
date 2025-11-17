BEGIN;

-- Waiter AI
UPDATE public.agent_registry SET
  name = 'Waiter AI – Dine-in & Takeaway',
  description = 'Multilingual WhatsApp waiter for venues',
  languages = ARRAY['en','fr','es','de','pt'],
  autonomy = 'auto',
  guardrails = '{"pii_minimization":true}'::jsonb,
  instructions = 'You are a multilingual AI waiter operating via WhatsApp for bars, cafes, and restaurants. Always use tools to read menu and prices. Confirm orders and process mobile money payments. Be warm and concise.'
WHERE slug = 'waiter-ai';

INSERT INTO public.agent_registry (agent_type, slug, name, description, languages, autonomy, guardrails, instructions)
SELECT 'waiter-ai','waiter-ai','Waiter AI – Dine-in & Takeaway','Multilingual WhatsApp waiter for venues',ARRAY['en','fr','es','de','pt'],'auto','{"pii_minimization":true}'::jsonb,'You are a multilingual AI waiter operating via WhatsApp for bars, cafes, and restaurants. Always use tools to read menu and prices. Confirm orders and process mobile money payments. Be warm and concise.'
WHERE NOT EXISTS (SELECT 1 FROM public.agent_registry WHERE slug = 'waiter-ai' OR agent_type = 'waiter-ai');

-- Real Estate AI
UPDATE public.agent_registry SET
  name = 'Real Estate AI – Rentals & Stays',
  description = 'WhatsApp rental concierge for Rwanda & Malta',
  languages = ARRAY['en','fr','es','de','pt'],
  autonomy = 'suggest',
  guardrails = '{"payments":"disabled"}'::jsonb,
  instructions = 'You are a multilingual real estate assistant for rentals and stays. Capture requirements, search internal listings, use deep search as needed, create a shortlist and schedule viewings. Do not take payments.'
WHERE slug = 'real-estate-ai';

INSERT INTO public.agent_registry (agent_type, slug, name, description, languages, autonomy, guardrails, instructions)
SELECT 'property_rental','real-estate-ai','Real Estate AI – Rentals & Stays','WhatsApp rental concierge for Rwanda & Malta',ARRAY['en','fr','es','de','pt'],'suggest','{"payments":"disabled"}'::jsonb,'You are a multilingual real estate assistant for rentals and stays. Capture requirements, search internal listings, use deep search as needed, create a shortlist and schedule viewings. Do not take payments.'
WHERE NOT EXISTS (SELECT 1 FROM public.agent_registry WHERE slug = 'real-estate-ai' OR agent_type = 'property_rental');

-- Job Board AI
UPDATE public.agent_registry SET
  name = 'Job Board AI – Jobs & Gigs',
  description = 'WhatsApp job concierge for seekers and posters',
  languages = ARRAY['en','fr','es','de','pt'],
  autonomy = 'auto',
  guardrails = '{"pii_minimization":true}'::jsonb,
  instructions = 'You help job seekers and posters structure profiles and job posts. Generate embeddings for matching and show top matches with simple, friendly language.'
WHERE slug = 'job-board-ai';

INSERT INTO public.agent_registry (agent_type, slug, name, description, languages, autonomy, guardrails, instructions)
SELECT 'job_board_ai','job-board-ai','Job Board AI – Jobs & Gigs','WhatsApp job concierge for seekers and posters',ARRAY['en','fr','es','de','pt'],'auto','{"pii_minimization":true}'::jsonb,'You help job seekers and posters structure profiles and job posts. Generate embeddings for matching and show top matches with simple, friendly language.'
WHERE NOT EXISTS (SELECT 1 FROM public.agent_registry WHERE slug = 'job-board-ai' OR agent_type = 'job_board_ai');

-- Sales & Marketing AI
UPDATE public.agent_registry SET
  name = 'Sales & Marketing AI – Growth Copilot',
  description = 'Multilingual growth copilot for campaigns and content',
  languages = ARRAY['en','fr','es','de','pt'],
  autonomy = 'suggest',
  guardrails = '{"anti_spam":true}'::jsonb,
  instructions = 'You are the Sales & Marketing AI agent for EasyMO. Turn goals into simple multi-channel campaigns (WhatsApp/SMS/email/social), generate content, and suggest next steps. Avoid spammy or unethical recommendations.'
WHERE slug = 'marketing-sales';

INSERT INTO public.agent_registry (agent_type, slug, name, description, languages, autonomy, guardrails, instructions)
SELECT 'sales_marketing','marketing-sales','Sales & Marketing AI – Growth Copilot','Multilingual growth copilot for campaigns and content',ARRAY['en','fr','es','de','pt'],'suggest','{"anti_spam":true}'::jsonb,'You are the Sales & Marketing AI agent for EasyMO. Turn goals into simple multi-channel campaigns (WhatsApp/SMS/email/social), generate content, and suggest next steps. Avoid spammy or unethical recommendations.'
WHERE NOT EXISTS (SELECT 1 FROM public.agent_registry WHERE slug = 'marketing-sales' OR agent_type = 'sales_marketing');

COMMIT;
