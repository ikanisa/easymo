BEGIN;

DELETE FROM public.agent_registry
WHERE agent_type IN ('bar_waiter', 'restaurant_waiter');

UPDATE public.agent_registry
SET name = 'Waiter AI Agent',
    description = 'Multilingual waiter for dine-in ordering via WhatsApp',
    autonomy = 'auto',
    languages = ARRAY['en','fr','rw']
WHERE agent_type = 'waiter-ai';

COMMIT;
