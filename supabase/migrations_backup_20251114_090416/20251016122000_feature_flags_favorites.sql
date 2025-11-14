BEGIN;

INSERT INTO public.settings (key, value, updated_at)
VALUES
  ('favorites.enabled', to_jsonb(true), timezone('utc', now())),
  ('recurring_trips.enabled', to_jsonb(true), timezone('utc', now())),
  ('broker.favorites_match.enabled', to_jsonb(true), timezone('utc', now())),
  (
    'broker.matching.weights',
    jsonb_build_object(
      'pickup', 1.0,
      'dropoff', 1.0,
      'time_window', -1.0,
      'recency', -0.25
    ),
    timezone('utc', now())
  )
ON CONFLICT (key) DO UPDATE
  SET value = excluded.value,
      updated_at = excluded.updated_at;

COMMIT;
