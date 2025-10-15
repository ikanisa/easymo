-- Seed feature flags for dual-constraint matching and basket confirmation

BEGIN;

INSERT INTO public.settings (key, value, updated_at)
VALUES
  ('dualConstraintMatching.enabled', to_jsonb(true), timezone('utc', now())),
  ('basket.confirmation.enabled', to_jsonb(true), timezone('utc', now()))
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = EXCLUDED.updated_at;

COMMIT;
