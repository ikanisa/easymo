DROP FUNCTION IF EXISTS public.consume_rate_limit(
  TEXT,
  INTEGER,
  INTEGER
);

CREATE FUNCTION public.consume_rate_limit(
  p_key TEXT,
  p_max_hits INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $function$
DECLARE
  existing public.rate_limit_counters%ROWTYPE;
  max_allowed INTEGER := COALESCE(p_max_hits, 5);
  window_seconds INTEGER := GREATEST(COALESCE(p_window_seconds, 300), 1);
BEGIN
  SELECT * INTO existing
  FROM public.rate_limit_counters
  WHERE key = p_key;

  IF NOT FOUND OR existing.window_expires < NOW() THEN
    INSERT INTO public.rate_limit_counters(key, hits, window_expires)
    VALUES (p_key, 1, NOW() + make_interval(secs => window_seconds))
    ON CONFLICT (key) DO UPDATE
      SET hits = EXCLUDED.hits,
          window_expires = EXCLUDED.window_expires;
    RETURN TRUE;
  END IF;

  IF existing.hits >= max_allowed THEN
    RETURN FALSE;
  END IF;

  UPDATE public.rate_limit_counters
    SET hits = existing.hits + 1,
        window_expires = existing.window_expires
  WHERE key = p_key;

  RETURN TRUE;
END;
$function$;
