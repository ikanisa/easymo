-- Loans & Reminders Enhancements for Phase 6/7
BEGIN;

-- SACCO LTV configuration
ALTER TABLE public.saccos
  ADD COLUMN IF NOT EXISTS ltv_min_ratio numeric(6,3) NOT NULL DEFAULT 1.000;

ALTER TABLE public.saccos
  DROP CONSTRAINT IF EXISTS saccos_ltv_min_ratio_check;
ALTER TABLE public.saccos
  ADD CONSTRAINT saccos_ltv_min_ratio_check
    CHECK (ltv_min_ratio > 0);

-- Loan level collateral snapshots & scheduling
ALTER TABLE public.sacco_loans
  ADD COLUMN IF NOT EXISTS collateral_total numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ltv_ratio numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disbursement_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disbursed_at timestamptz,
  ADD COLUMN IF NOT EXISTS repayment_schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status_reason text;

-- Extend collateral metadata
ALTER TABLE public.sacco_collateral
  DROP CONSTRAINT IF EXISTS sacco_collateral_source_check;
ALTER TABLE public.sacco_collateral
  ADD CONSTRAINT sacco_collateral_source_check
    CHECK (source IN ('group_savings','member_savings','guarantor','asset'));

ALTER TABLE public.sacco_collateral
  ADD COLUMN IF NOT EXISTS valuation numeric(12,2),
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Loan transition event log
CREATE TABLE IF NOT EXISTS public.sacco_loan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.sacco_loans(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  notes text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sacco_loan_events_loan ON public.sacco_loan_events (loan_id);
CREATE INDEX IF NOT EXISTS idx_sacco_loan_events_created ON public.sacco_loan_events (created_at);

-- Reminder scheduling tables
CREATE TABLE IF NOT EXISTS public.baskets_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ikimina_id uuid REFERENCES public.ibimina(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.ibimina_members(id) ON DELETE SET NULL,
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  reminder_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz NOT NULL,
  next_attempt_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  blocked_reason text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.baskets_reminders
  DROP CONSTRAINT IF EXISTS baskets_reminders_type_check;
ALTER TABLE public.baskets_reminders
  ADD CONSTRAINT baskets_reminders_type_check
    CHECK (reminder_type IN ('due_in_3','due_today','overdue','custom'));

ALTER TABLE public.baskets_reminders
  DROP CONSTRAINT IF EXISTS baskets_reminders_status_check;
ALTER TABLE public.baskets_reminders
  ADD CONSTRAINT baskets_reminders_status_check
    CHECK (status IN ('pending','queued','sent','skipped','blocked','cancelled'));

CREATE INDEX IF NOT EXISTS idx_baskets_reminders_status ON public.baskets_reminders (status);
CREATE INDEX IF NOT EXISTS idx_baskets_reminders_schedule ON public.baskets_reminders (scheduled_for);
CREATE INDEX IF NOT EXISTS idx_baskets_reminders_next_attempt ON public.baskets_reminders (next_attempt_at);

CREATE TABLE IF NOT EXISTS public.baskets_reminder_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid NOT NULL REFERENCES public.baskets_reminders(id) ON DELETE CASCADE,
  event text NOT NULL,
  reason text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.baskets_reminder_events
  DROP CONSTRAINT IF EXISTS baskets_reminder_events_event_check;
ALTER TABLE public.baskets_reminder_events
  ADD CONSTRAINT baskets_reminder_events_event_check
    CHECK (event IN ('scheduled','queued','sent','blocked','skipped','rescheduled','cancelled'));

CREATE INDEX IF NOT EXISTS idx_baskets_reminder_events_reminder ON public.baskets_reminder_events (reminder_id);
CREATE INDEX IF NOT EXISTS idx_baskets_reminder_events_created ON public.baskets_reminder_events (created_at);

-- Helper to refresh collateral totals and LTV snapshot
CREATE OR REPLACE FUNCTION public.refresh_loan_collateral_snapshot()
RETURNS trigger AS $$
DECLARE
  target_loan uuid;
  total numeric(12,2);
  principal numeric(12,2);
  ratio numeric;
BEGIN
  target_loan := COALESCE(NEW.loan_id, OLD.loan_id);
  IF target_loan IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(amount_pledged), 0)
    INTO total
    FROM public.sacco_collateral
    WHERE loan_id = target_loan;

  SELECT principal
    INTO principal
    FROM public.sacco_loans
    WHERE id = target_loan;

  IF principal IS NULL OR principal = 0 THEN
    ratio := 0;
  ELSE
    ratio := total / principal;
  END IF;

  UPDATE public.sacco_loans
    SET collateral_total = COALESCE(total, 0),
        ltv_ratio = COALESCE(ROUND(ratio::numeric, 3), 0)
    WHERE id = target_loan;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sacco_collateral_refresh ON public.sacco_collateral;
CREATE TRIGGER trg_sacco_collateral_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.sacco_collateral
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_loan_collateral_snapshot();

-- Enforce LTV thresholds when advancing loan status
CREATE OR REPLACE FUNCTION public.enforce_loan_ltv()
RETURNS trigger AS $$
DECLARE
  threshold numeric(6,3);
  ratio numeric(6,3);
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('approved','disbursed') THEN
    SELECT COALESCE(s.ltv_min_ratio, 1.000)
      INTO threshold
      FROM public.ibimina i
      LEFT JOIN public.saccos s ON s.id = i.sacco_id
      WHERE i.id = NEW.ikimina_id;

    ratio := COALESCE(NEW.ltv_ratio, 0);

    IF ratio < COALESCE(threshold, 1.000) THEN
      RAISE EXCEPTION 'BKT_LTV_EXCEEDED: required %. current %', threshold, ratio
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sacco_loans_enforce_ltv ON public.sacco_loans;
CREATE TRIGGER trg_sacco_loans_enforce_ltv
  BEFORE UPDATE ON public.sacco_loans
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_loan_ltv();

-- Audit trail for loan transitions
CREATE OR REPLACE FUNCTION public.log_sacco_loan_event()
RETURNS trigger AS $$
DECLARE
  actor uuid;
  role text;
BEGIN
  actor := NEW.sacco_decision_by;
  role := current_setting('request.jwt.claim.role', true);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.sacco_loan_events (loan_id, from_status, to_status, actor_id, actor_role, context)
    VALUES (NEW.id, NULL, NEW.status, actor, role,
      jsonb_build_object('principal', NEW.principal, 'created_by', actor));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.sacco_loan_events (loan_id, from_status, to_status, actor_id, actor_role, notes, context)
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      actor,
      role,
      COALESCE(NEW.sacco_decision_notes, NEW.status_reason),
      jsonb_build_object(
        'status_reason', NEW.status_reason,
        'committee_completed_at', NEW.committee_completed_at,
        'ltv_ratio', NEW.ltv_ratio
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sacco_loan_events ON public.sacco_loans;
CREATE TRIGGER trg_sacco_loan_events
  AFTER INSERT OR UPDATE ON public.sacco_loans
  FOR EACH ROW
  EXECUTE FUNCTION public.log_sacco_loan_event();

-- Touch helpers for reminders
DROP TRIGGER IF EXISTS trg_baskets_reminders_touch ON public.baskets_reminders;
CREATE TRIGGER trg_baskets_reminders_touch
  BEFORE UPDATE ON public.baskets_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Enable RLS and policies for new tables
ALTER TABLE public.sacco_loan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baskets_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baskets_reminder_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY sacco_loan_events_admin_staff_select ON public.sacco_loan_events
  FOR SELECT
  USING (
    app.current_role() IN ('admin','service_role')
    OR (
      app.current_role() = 'sacco_staff'
      AND EXISTS (
        SELECT 1
        FROM public.sacco_loans l
        JOIN public.ibimina i ON i.id = l.ikimina_id
        JOIN public.sacco_officers o ON o.sacco_id = i.sacco_id
        WHERE l.id = sacco_loan_events.loan_id
          AND o.user_id = auth.uid()
      )
    )
  );

CREATE POLICY sacco_loan_events_admin_staff_insert ON public.sacco_loan_events
  FOR INSERT
  WITH CHECK (app.current_role() IN ('admin','sacco_staff','service_role'));

CREATE POLICY sacco_loan_events_admin_staff_update ON public.sacco_loan_events
  FOR UPDATE
  USING (app.current_role() = 'admin')
  WITH CHECK (app.current_role() = 'admin');

CREATE POLICY baskets_reminders_admin_staff_rw ON public.baskets_reminders
  USING (
    app.current_role() IN ('admin','service_role')
    OR (
      app.current_role() = 'sacco_staff'
      AND EXISTS (
        SELECT 1
        FROM public.ibimina i
        JOIN public.sacco_officers o ON o.sacco_id = i.sacco_id
        WHERE i.id = baskets_reminders.ikimina_id
          AND o.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    app.current_role() IN ('admin','service_role')
    OR (
      app.current_role() = 'sacco_staff'
      AND EXISTS (
        SELECT 1
        FROM public.ibimina i
        JOIN public.sacco_officers o ON o.sacco_id = i.sacco_id
        WHERE i.id = baskets_reminders.ikimina_id
          AND o.user_id = auth.uid()
      )
    )
  );

CREATE POLICY baskets_reminder_events_admin_staff_rw ON public.baskets_reminder_events
  USING (
    app.current_role() IN ('admin','service_role')
    OR (
      app.current_role() = 'sacco_staff'
      AND EXISTS (
        SELECT 1
        FROM public.baskets_reminders r
        JOIN public.ibimina i ON i.id = r.ikimina_id
        JOIN public.sacco_officers o ON o.sacco_id = i.sacco_id
        WHERE r.id = baskets_reminder_events.reminder_id
          AND o.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    app.current_role() IN ('admin','service_role')
    OR (
      app.current_role() = 'sacco_staff'
      AND EXISTS (
        SELECT 1
        FROM public.baskets_reminders r
        JOIN public.ibimina i ON i.id = r.ikimina_id
        JOIN public.sacco_officers o ON o.sacco_id = i.sacco_id
        WHERE r.id = baskets_reminder_events.reminder_id
          AND o.user_id = auth.uid()
      )
    )
  );

COMMIT;
