-- Fix: remove ambiguity in public.increment_metric by using EXCLUDED values in the upsert
-- Safer and clearer than referencing the function parameter inside DO UPDATE

CREATE OR REPLACE FUNCTION public.increment_metric(
  event_name text,
  delta integer,
  meta jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.system_metrics (event, total, last_occurred, meta)
  VALUES (event_name, delta, NOW(), COALESCE(meta, '{}'::jsonb))
  ON CONFLICT (event) DO UPDATE
    SET total = public.system_metrics.total + GREATEST(EXCLUDED.total, 0),
        last_occurred = NOW(),
        meta = CASE
          WHEN EXCLUDED.meta = '{}'::jsonb THEN public.system_metrics.meta
          ELSE EXCLUDED.meta
        END;
END;
$function$;
