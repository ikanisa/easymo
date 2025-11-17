BEGIN;

-- Ensure all core agents support EN, FR, ES, PT, DE
UPDATE public.agent_registry
SET languages = ARRAY['en','fr','es','pt','de']::text[]
WHERE agent_type IN ('waiter_ai','property_rental');

UPDATE public.agent_registry
SET languages = ARRAY['en','fr','es','pt','de']::text[]
WHERE agent_type IN ('job_board_ai','sales_marketing');

COMMIT;

