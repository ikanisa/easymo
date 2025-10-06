-- Helper function to upsert contribution cycle totals atomically
BEGIN;
CREATE OR REPLACE FUNCTION public.upsert_contribution_cycle(
  _ikimina_id uuid,
  _yyyymm char(6),
  _amount numeric
) RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO public.contribution_cycles (
    ikimina_id,
    yyyymm,
    expected_amount,
    collected_amount,
    status
  )
  VALUES (
    _ikimina_id,
    _yyyymm,
    NULL,
    COALESCE(_amount, 0),
    'open'
  )
  ON CONFLICT (ikimina_id, yyyymm)
  DO UPDATE SET
    collected_amount = public.contribution_cycles.collected_amount + EXCLUDED.collected_amount,
    status = CASE
      WHEN public.contribution_cycles.status = 'closed' THEN public.contribution_cycles.status
      ELSE 'open'
    END;
$$;
COMMIT;
