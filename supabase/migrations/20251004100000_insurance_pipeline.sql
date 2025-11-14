BEGIN;

-- Enumerations for insurance domain
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'insurance_request_status') THEN
    CREATE TYPE public.insurance_request_status AS ENUM (
      'draft',
      'intake',
      'under_review',
      'quoted',
      'awaiting_payment',
      'paid',
      'issued',
      'cancelled'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'insurance_policy_status') THEN
    CREATE TYPE public.insurance_policy_status AS ENUM (
      'draft',
      'pending_issue',
      'active',
      'expired',
      'cancelled'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'insurance_payment_status') THEN
    CREATE TYPE public.insurance_payment_status AS ENUM (
      'pending',
      'in_review',
      'completed',
      'failed',
      'refunded'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'insurance_task_status') THEN
    CREATE TYPE public.insurance_task_status AS ENUM (
      'open',
      'in_progress',
      'blocked',
      'completed',
      'cancelled'
    );
  END IF;
END
$$;

-- Core insurance tables
CREATE TABLE IF NOT EXISTS public.insurance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  customer_name text,
  customer_wa_id text,
  customer_msisdn text,
  status public.insurance_request_status NOT NULL DEFAULT 'intake',
  source text DEFAULT 'whatsapp',
  preferred_insurer text,
  premium_target_minor integer,
  ocr_confidence numeric(5,2) CHECK (ocr_confidence >= 0 AND ocr_confidence <= 1),
  ocr_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  assigned_agent_id text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.insurance_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.insurance_requests(id) ON DELETE CASCADE,
  plate_number text,
  vin text,
  make text,
  model text,
  body_type text,
  year integer,
  usage text,
  cover_type text,
  sum_insured_minor integer,
  seats integer,
  comesa_requested boolean DEFAULT false,
  extras jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.insurance_requests(id) ON DELETE SET NULL,
  policy_number text UNIQUE,
  insurer text NOT NULL,
  status public.insurance_policy_status NOT NULL DEFAULT 'pending_issue',
  effective_from timestamptz,
  effective_to timestamptz,
  premium_total_minor integer,
  fees_minor integer,
  issued_at timestamptz,
  issued_by text,
  assigned_agent_id text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.insurance_policy_breakdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.insurance_policies(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount_minor integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.insurance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.insurance_requests(id) ON DELETE CASCADE,
  policy_id uuid REFERENCES public.insurance_policies(id) ON DELETE SET NULL,
  doc_type text NOT NULL,
  storage_path text NOT NULL,
  source text DEFAULT 'upload',
  ocr_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ocr_confidence numeric(5,2) CHECK (ocr_confidence >= 0 AND ocr_confidence <= 1),
  uploaded_by text,
  uploaded_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  verified boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.insurance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.insurance_requests(id) ON DELETE CASCADE,
  policy_id uuid REFERENCES public.insurance_policies(id) ON DELETE SET NULL,
  title text NOT NULL,
  task_type text,
  status public.insurance_task_status NOT NULL DEFAULT 'open',
  priority integer NOT NULL DEFAULT 2 CHECK (priority >= 1 AND priority <= 5),
  due_at timestamptz,
  assigned_to text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.insurance_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.insurance_requests(id) ON DELETE SET NULL,
  policy_id uuid REFERENCES public.insurance_policies(id) ON DELETE SET NULL,
  amount_minor integer NOT NULL,
  currency text NOT NULL DEFAULT 'RWF',
  method text,
  status public.insurance_payment_status NOT NULL DEFAULT 'pending',
  reference text,
  momo_reference text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes for faster querying
CREATE INDEX IF NOT EXISTS insurance_requests_status_idx ON public.insurance_requests(status);
CREATE INDEX IF NOT EXISTS insurance_requests_assigned_idx ON public.insurance_requests(assigned_agent_id);
CREATE INDEX IF NOT EXISTS insurance_requests_customer_idx ON public.insurance_requests(customer_id);

CREATE INDEX IF NOT EXISTS insurance_vehicles_request_idx ON public.insurance_vehicles(request_id);

CREATE INDEX IF NOT EXISTS insurance_policies_request_idx ON public.insurance_policies(request_id);
CREATE INDEX IF NOT EXISTS insurance_policies_status_idx ON public.insurance_policies(status);
CREATE INDEX IF NOT EXISTS insurance_policies_assigned_idx ON public.insurance_policies(assigned_agent_id);

CREATE INDEX IF NOT EXISTS insurance_policy_breakdowns_policy_idx ON public.insurance_policy_breakdowns(policy_id);

-- CREATE INDEX IF NOT EXISTS insurance_documents_request_idx ON public.insurance_documents(request_id);
-- CREATE INDEX IF NOT EXISTS insurance_documents_policy_idx ON public.insurance_documents(policy_id);

CREATE INDEX IF NOT EXISTS insurance_tasks_request_idx ON public.insurance_tasks(request_id);
CREATE INDEX IF NOT EXISTS insurance_tasks_assigned_idx ON public.insurance_tasks(assigned_to);

CREATE INDEX IF NOT EXISTS insurance_payments_request_idx ON public.insurance_payments(request_id);
CREATE INDEX IF NOT EXISTS insurance_payments_policy_idx ON public.insurance_payments(policy_id);

-- Updated at triggers
CREATE TRIGGER set_updated_at_on_insurance_requests
  BEFORE UPDATE ON public.insurance_requests
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_updated_at_on_insurance_vehicles
  BEFORE UPDATE ON public.insurance_vehicles
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_updated_at_on_insurance_policies
  BEFORE UPDATE ON public.insurance_policies
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_updated_at_on_insurance_tasks
  BEFORE UPDATE ON public.insurance_tasks
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_updated_at_on_insurance_payments
  BEFORE UPDATE ON public.insurance_payments
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- Roles for insurance RLS usage
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'insurance_admin_role') THEN
    CREATE ROLE insurance_admin_role;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'insurance_ops_role') THEN
    CREATE ROLE insurance_ops_role;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'insurance_agent_role') THEN
    CREATE ROLE insurance_agent_role;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'insurance_finance_role') THEN
    CREATE ROLE insurance_finance_role;
  END IF;
END
$$;

-- Enable RLS
ALTER TABLE public.insurance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_policy_breakdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_payments ENABLE ROW LEVEL SECURITY;

-- Policies for insurance_requests
CREATE POLICY insurance_requests_platform_full ON public.insurance_requests
  FOR ALL USING (public.auth_role() = 'platform')
  WITH CHECK (public.auth_role() = 'platform');

CREATE POLICY insurance_requests_admin_full ON public.insurance_requests
  FOR ALL USING (public.auth_role() = 'insurance_admin')
  WITH CHECK (public.auth_role() = 'insurance_admin');

CREATE POLICY insurance_requests_ops_rw ON public.insurance_requests
  FOR ALL USING (public.auth_role() = 'insurance_ops')
  WITH CHECK (public.auth_role() = 'insurance_ops');

CREATE POLICY insurance_requests_agent_access ON public.insurance_requests
  FOR SELECT USING (
    public.auth_role() IN ('insurance_agent', 'insurance_finance')
    AND (
      insurance_requests.assigned_agent_id = public.auth_wa_id()
      OR insurance_requests.created_by = public.auth_wa_id()
      OR insurance_requests.customer_wa_id = public.auth_wa_id()
    )
  );

CREATE POLICY insurance_requests_agent_update ON public.insurance_requests
  FOR UPDATE USING (
    public.auth_role() = 'insurance_agent'
    AND insurance_requests.assigned_agent_id = public.auth_wa_id()
  )
  WITH CHECK (
    public.auth_role() = 'insurance_agent'
    AND insurance_requests.assigned_agent_id = public.auth_wa_id()
  );

-- Policies for insurance_vehicles
CREATE POLICY insurance_vehicles_platform_full ON public.insurance_vehicles
  FOR ALL USING (public.auth_role() = 'platform')
  WITH CHECK (public.auth_role() = 'platform');

CREATE POLICY insurance_vehicles_admin_full ON public.insurance_vehicles
  FOR ALL USING (public.auth_role() = 'insurance_admin')
  WITH CHECK (public.auth_role() = 'insurance_admin');

CREATE POLICY insurance_vehicles_ops_rw ON public.insurance_vehicles
  FOR ALL USING (public.auth_role() = 'insurance_ops')
  WITH CHECK (public.auth_role() = 'insurance_ops');

CREATE POLICY insurance_vehicles_agent_read ON public.insurance_vehicles
  FOR SELECT USING (
    public.auth_role() IN ('insurance_agent', 'insurance_finance')
    AND EXISTS (
      SELECT 1
      FROM public.insurance_requests req
      WHERE req.id = insurance_vehicles.request_id
        AND (
          req.assigned_agent_id = public.auth_wa_id()
          OR req.created_by = public.auth_wa_id()
          OR req.customer_wa_id = public.auth_wa_id()
        )
    )
  );

CREATE POLICY insurance_vehicles_agent_update ON public.insurance_vehicles
  FOR UPDATE USING (
    public.auth_role() = 'insurance_agent'
    AND EXISTS (
      SELECT 1 FROM public.insurance_requests req
      WHERE req.id = insurance_vehicles.request_id
        AND req.assigned_agent_id = public.auth_wa_id()
    )
  )
  WITH CHECK (
    public.auth_role() = 'insurance_agent'
    AND EXISTS (
      SELECT 1 FROM public.insurance_requests req
      WHERE req.id = insurance_vehicles.request_id
        AND req.assigned_agent_id = public.auth_wa_id()
    )
  );

-- Policies for insurance_policies
CREATE POLICY insurance_policies_platform_full ON public.insurance_policies
  FOR ALL USING (public.auth_role() = 'platform')
  WITH CHECK (public.auth_role() = 'platform');

CREATE POLICY insurance_policies_admin_full ON public.insurance_policies
  FOR ALL USING (public.auth_role() = 'insurance_admin')
  WITH CHECK (public.auth_role() = 'insurance_admin');

CREATE POLICY insurance_policies_ops_rw ON public.insurance_policies
  FOR ALL USING (public.auth_role() = 'insurance_ops')
  WITH CHECK (public.auth_role() = 'insurance_ops');

CREATE POLICY insurance_policies_finance_rw ON public.insurance_policies
  FOR ALL USING (public.auth_role() = 'insurance_finance')
  WITH CHECK (public.auth_role() = 'insurance_finance');

CREATE POLICY insurance_policies_agent_read ON public.insurance_policies
  FOR SELECT USING (
    public.auth_role() = 'insurance_agent'
    AND EXISTS (
      SELECT 1
      FROM public.insurance_requests req
      WHERE req.id = insurance_policies.request_id
        AND (
          req.assigned_agent_id = public.auth_wa_id()
          OR req.created_by = public.auth_wa_id()
        )
    )
  );

-- Policies for insurance_policy_breakdowns
CREATE POLICY insurance_policy_breakdowns_full_admin ON public.insurance_policy_breakdowns
  FOR ALL USING (public.auth_role() IN ('platform', 'insurance_admin', 'insurance_ops', 'insurance_finance'))
  WITH CHECK (public.auth_role() IN ('platform', 'insurance_admin', 'insurance_ops', 'insurance_finance'));

CREATE POLICY insurance_policy_breakdowns_agent_read ON public.insurance_policy_breakdowns
  FOR SELECT USING (
    public.auth_role() = 'insurance_agent'
    AND EXISTS (
      SELECT 1
      FROM public.insurance_policies pol
      JOIN public.insurance_requests req ON req.id = pol.request_id
      WHERE pol.id = insurance_policy_breakdowns.policy_id
        AND (
          req.assigned_agent_id = public.auth_wa_id()
          OR req.created_by = public.auth_wa_id()
        )
    )
  );

-- Policies for insurance_documents
-- CREATE POLICY insurance_documents_full_admin ON public.insurance_documents
--   FOR ALL USING (public.auth_role() IN ('platform', 'insurance_admin', 'insurance_ops', 'insurance_finance'))
--   WITH CHECK (public.auth_role() IN ('platform', 'insurance_admin', 'insurance_ops', 'insurance_finance'));
-- 
-- CREATE POLICY insurance_documents_agent_read ON public.insurance_documents
--   FOR SELECT USING (
--     public.auth_role() = 'insurance_agent'
--     AND EXISTS (
--       SELECT 1
--       FROM public.insurance_requests req
--       WHERE req.id = insurance_documents.request_id
--         AND (
--           req.assigned_agent_id = public.auth_wa_id()
--           OR req.created_by = public.auth_wa_id()
--           OR req.customer_wa_id = public.auth_wa_id()
--         )
--     )
--   );
-- 
-- Policies for insurance_tasks
CREATE POLICY insurance_tasks_full_admin ON public.insurance_tasks
  FOR ALL USING (public.auth_role() IN ('platform', 'insurance_admin', 'insurance_ops'))
  WITH CHECK (public.auth_role() IN ('platform', 'insurance_admin', 'insurance_ops'));

CREATE POLICY insurance_tasks_finance_read ON public.insurance_tasks
  FOR SELECT USING (public.auth_role() = 'insurance_finance');

CREATE POLICY insurance_tasks_agent_rw ON public.insurance_tasks
  FOR ALL USING (
    public.auth_role() = 'insurance_agent'
    AND (
      insurance_tasks.assigned_to = public.auth_wa_id()
      OR EXISTS (
        SELECT 1 FROM public.insurance_requests req
        WHERE req.id = insurance_tasks.request_id
          AND req.assigned_agent_id = public.auth_wa_id()
      )
    )
  )
  WITH CHECK (
    public.auth_role() = 'insurance_agent'
    AND (
      insurance_tasks.assigned_to = public.auth_wa_id()
      OR EXISTS (
        SELECT 1 FROM public.insurance_requests req
        WHERE req.id = insurance_tasks.request_id
          AND req.assigned_agent_id = public.auth_wa_id()
      )
    )
  );

-- Policies for insurance_payments
CREATE POLICY insurance_payments_full_admin ON public.insurance_payments
  FOR ALL USING (public.auth_role() IN ('platform', 'insurance_admin', 'insurance_finance'))
  WITH CHECK (public.auth_role() IN ('platform', 'insurance_admin', 'insurance_finance'));

CREATE POLICY insurance_payments_ops_read ON public.insurance_payments
  FOR SELECT USING (public.auth_role() = 'insurance_ops');

CREATE POLICY insurance_payments_agent_read ON public.insurance_payments
  FOR SELECT USING (
    public.auth_role() = 'insurance_agent'
    AND EXISTS (
      SELECT 1
      FROM public.insurance_requests req
      WHERE req.id = insurance_payments.request_id
        AND (
          req.assigned_agent_id = public.auth_wa_id()
          OR req.created_by = public.auth_wa_id()
        )
    )
  );

-- Conditional RLS policies for insurance_documents
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'insurance_documents' 
             AND column_name = 'request_id') THEN
    
    EXECUTE 'ALTER TABLE public.insurance_documents ENABLE ROW LEVEL SECURITY';
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insurance_documents' AND policyname = 'insurance_documents_full_admin') THEN
      EXECUTE 'CREATE POLICY insurance_documents_full_admin ON public.insurance_documents FOR ALL USING (public.auth_role() IN (''platform'', ''insurance_admin'', ''insurance_ops'', ''insurance_finance'')) WITH CHECK (public.auth_role() IN (''platform'', ''insurance_admin'', ''insurance_ops'', ''insurance_finance''))';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insurance_documents' AND policyname = 'insurance_documents_agent_read') THEN
      EXECUTE 'CREATE POLICY insurance_documents_agent_read ON public.insurance_documents FOR SELECT USING (public.auth_role() = ''insurance_agent'' AND EXISTS (SELECT 1 FROM public.insurance_requests req WHERE req.id = insurance_documents.request_id AND (req.assigned_agent_id = public.auth_wa_id() OR req.created_by = public.auth_wa_id() OR req.customer_wa_id = public.auth_wa_id())))';
    END IF;
  END IF;
END $$;

-- Conditional index creation for insurance_documents
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'insurance_documents' 
             AND column_name = 'request_id') THEN
    CREATE INDEX IF NOT EXISTS insurance_documents_request_idx ON public.insurance_documents(request_id);
    CREATE INDEX IF NOT EXISTS insurance_documents_policy_idx ON public.insurance_documents(policy_id);
  END IF;
END $$;
COMMIT;
