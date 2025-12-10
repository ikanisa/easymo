-- RLS for sacco loan endorsements
BEGIN;

ALTER TABLE public.sacco_loan_endorsements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sacco_loan_endorsements'
      AND policyname = 'sacco_loan_endorsements_admin_staff_rw'
  ) THEN
    CREATE POLICY sacco_loan_endorsements_admin_staff_rw ON public.sacco_loan_endorsements
      FOR ALL USING (auth.role() IN ('service_role'))
      WITH CHECK (auth.role() IN ('service_role'));
  END IF;
END;
$$;

COMMIT;
