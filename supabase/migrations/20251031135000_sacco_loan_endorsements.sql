-- Loan endorsements and decision tracking
BEGIN;

CREATE TABLE IF NOT EXISTS public.sacco_loan_endorsements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.sacco_loans(id) ON DELETE CASCADE,
  committee_member_id uuid NOT NULL REFERENCES public.ibimina_members(id) ON DELETE CASCADE,
  role text,
  vote text NOT NULL DEFAULT 'pending' CHECK (vote IN ('pending','approve','reject')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loan_id, committee_member_id)
);

CREATE INDEX IF NOT EXISTS idx_sacco_loan_endorsements_loan ON public.sacco_loan_endorsements (loan_id);
CREATE INDEX IF NOT EXISTS idx_sacco_loan_endorsements_vote ON public.sacco_loan_endorsements (vote);

ALTER TABLE public.sacco_loans
  ADD COLUMN IF NOT EXISTS committee_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS sacco_decision_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sacco_decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS sacco_decision_notes text;

ALTER TABLE public.sacco_loans
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sacco_loans_touch ON public.sacco_loans;
CREATE TRIGGER trg_sacco_loans_touch
  BEFORE UPDATE ON public.sacco_loans
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_sacco_loan_endorsements_touch ON public.sacco_loan_endorsements;
CREATE TRIGGER trg_sacco_loan_endorsements_touch
  BEFORE UPDATE ON public.sacco_loan_endorsements
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

COMMIT;
