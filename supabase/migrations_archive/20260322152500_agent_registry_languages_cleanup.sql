BEGIN;

-- Remove duplicate waiter agents and normalize languages (drop 'rw')
DELETE FROM public.agent_registry
WHERE agent_type IN (
  'bar_waiter', 'restaurant_waiter', 'bar-ai', 'restaurant-ai', 'bar_ai', 'restaurant_ai'
);

-- Ensure a single canonical waiter agent remains
UPDATE public.agent_registry
SET name = COALESCE(name, 'Waiter AI (Dine-In)'),
    description = COALESCE(description, 'Digital waiter for dine-in ordering via WhatsApp (bars & restaurants)'),
    languages = ARRAY['en','fr'],
    autonomy = COALESCE(autonomy, 'auto')
WHERE agent_type = 'waiter-ai';

-- Normalize languages for all agents to supported set (en, fr)
UPDATE public.agent_registry
SET languages = ARRAY(SELECT DISTINCT UNNEST(ARRAY['en','fr']) )
WHERE languages IS NULL
   OR EXISTS (
      SELECT 1 FROM unnest(languages) l
      WHERE l NOT IN ('en','fr')
   );

-- Also fix concierge and job-board agents explicitly
UPDATE public.agent_registry
SET languages = ARRAY['en','fr']
WHERE agent_type IN ('concierge-router','job-board-ai');

COMMIT;

