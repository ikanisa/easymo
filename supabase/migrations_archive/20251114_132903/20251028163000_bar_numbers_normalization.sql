-- Ensure consistent phone number storage for bar_numbers and track conflicts

BEGIN;

ALTER TABLE public.bar_numbers
  ADD COLUMN IF NOT EXISTS number_digits text;

CREATE TABLE IF NOT EXISTS public.bar_number_canonicalization_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_number_id uuid NOT NULL,
  conflicting_bar_number_id uuid,
  bar_id uuid NOT NULL,
  digits text,
  canonical_value text,
  reason text DEFAULT 'conflict',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_bar_number_conflicts_bar ON public.bar_number_canonicalization_conflicts (bar_id);
CREATE INDEX IF NOT EXISTS idx_bar_number_conflicts_numbers ON public.bar_number_canonicalization_conflicts (bar_number_id);

CREATE OR REPLACE FUNCTION public.set_bar_number_digits()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  digits text;
BEGIN
  digits := regexp_replace(COALESCE(NEW.number_e164, ''), '[^0-9]', '', 'g');
  IF digits IS NULL OR char_length(digits) = 0 THEN
    NEW.number_digits := NULL;
  ELSE
    NEW.number_digits := digits;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bar_numbers_set_digits ON public.bar_numbers;
CREATE TRIGGER bar_numbers_set_digits
BEFORE INSERT OR UPDATE ON public.bar_numbers
FOR EACH ROW
EXECUTE FUNCTION public.set_bar_number_digits();

UPDATE public.bar_numbers
SET number_digits = regexp_replace(COALESCE(number_e164, ''), '[^0-9]', '', 'g');

DO $$
DECLARE
  rec record;
  digits text;
  canonical text;
  conflict_id uuid;
BEGIN
  FOR rec IN
    SELECT id, bar_id, number_e164
    FROM public.bar_numbers
    ORDER BY updated_at NULLS FIRST, created_at NULLS FIRST
  LOOP
    digits := regexp_replace(COALESCE(rec.number_e164, ''), '[^0-9]', '', 'g');
    IF digits IS NULL OR char_length(digits) = 0 THEN
      INSERT INTO public.bar_number_canonicalization_conflicts (
        bar_number_id,
        bar_id,
        digits,
        canonical_value,
        reason
      )
      VALUES
        (rec.id, rec.bar_id, digits, NULL, 'no_digits')
      ON CONFLICT DO NOTHING;
      CONTINUE;
    END IF;

    IF char_length(digits) NOT BETWEEN 6 AND 15 THEN
      INSERT INTO public.bar_number_canonicalization_conflicts (
        bar_number_id,
        bar_id,
        digits,
        canonical_value,
        reason
      )
      VALUES
        (rec.id, rec.bar_id, digits, '+' || digits, 'out_of_range')
      ON CONFLICT DO NOTHING;
      CONTINUE;
    END IF;

    canonical := '+' || digits;

    IF canonical = rec.number_e164 THEN
      CONTINUE;
    END IF;

    BEGIN
      UPDATE public.bar_numbers
      SET number_e164 = canonical
      WHERE id = rec.id;
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO conflict_id
      FROM public.bar_numbers
      WHERE bar_id = rec.bar_id
        AND number_e164 = canonical
        AND id <> rec.id
      LIMIT 1;

      INSERT INTO public.bar_number_canonicalization_conflicts (
        bar_number_id,
        conflicting_bar_number_id,
        bar_id,
        digits,
        canonical_value,
        reason
      )
      VALUES
        (rec.id, conflict_id, rec.bar_id, digits, canonical, 'duplicate_after_canonical')
      ON CONFLICT DO NOTHING;
    END;
  END LOOP;
END;
$$;

UPDATE public.bar_numbers
SET number_digits = regexp_replace(COALESCE(number_e164, ''), '[^0-9]', '', 'g')
WHERE number_digits IS DISTINCT FROM regexp_replace(COALESCE(number_e164, ''), '[^0-9]', '', 'g');

CREATE INDEX IF NOT EXISTS idx_bar_numbers_number_digits ON public.bar_numbers (bar_id, number_digits);

COMMIT;
