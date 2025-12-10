-- Migration: Loan Application Infrastructure (Intermediated Only)
-- Description: Digital loan applications routed to SACCO/MFI, no disbursement
-- Date: 2025-10-31

-- Loan products table (defined by SACCO/MFI partners)
CREATE TABLE IF NOT EXISTS public.loan_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  partner_name TEXT, -- SACCO/MFI/Bank name
  partner_logo_url TEXT,
  min_amount NUMERIC(15,2) NOT NULL,
  max_amount NUMERIC(15,2) NOT NULL,
  min_tenor_months INTEGER NOT NULL,
  max_tenor_months INTEGER NOT NULL,
  interest_rate NUMERIC(5,2), -- Annual percentage rate
  interest_rate_description TEXT, -- e.g., "12% per annum, reducing balance"
  required_documents TEXT[] DEFAULT '{}', -- e.g., ["NID", "Proof of Income", "Bank Statement"]
  eligibility_criteria TEXT,
  terms_url TEXT, -- Link to full T&Cs
  enabled BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_products_org_id ON public.loan_products(org_id);
CREATE INDEX IF NOT EXISTS idx_loan_products_enabled ON public.loan_products(enabled) WHERE enabled = true;

-- Loan applications table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_members') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS public.loan_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        group_member_id UUID REFERENCES public.group_members(id) ON DELETE SET NULL,
        user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        product_id UUID NOT NULL REFERENCES public.loan_products(id) ON DELETE RESTRICT';
  ELSE
    -- Create without group_members FK
    EXECUTE '
      CREATE TABLE IF NOT EXISTS public.loan_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        group_member_id UUID,
        user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        product_id UUID NOT NULL REFERENCES public.loan_products(id) ON DELETE RESTRICT';
  END IF;
  
  -- Continue with rest of columns (same for both branches)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loan_applications' AND column_name = 'requested_amount') THEN
    EXECUTE '
      ALTER TABLE public.loan_applications ADD COLUMN
        requested_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      ADD COLUMN tenor_months INTEGER NOT NULL DEFAULT 12,
      ADD COLUMN purpose TEXT,
      ADD COLUMN applicant_name TEXT NOT NULL DEFAULT '''',
      ADD COLUMN applicant_phone TEXT NOT NULL DEFAULT '''',
      ADD COLUMN applicant_email TEXT,
      ADD COLUMN applicant_nid TEXT';
  END IF;
END $$;
  documents JSONB DEFAULT '[]'::jsonb, -- Array of {type, url, uploaded_at}
  
  -- Application status
  status TEXT CHECK (status IN ('DRAFT', 'SUBMITTED', 'RECEIVED', 'UNDER_REVIEW', 'APPROVED', 'DECLINED', 'DISBURSED', 'CANCELLED')) NOT NULL DEFAULT 'DRAFT',
  status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Pre-scoring (optional, P1 tier)
  affordability_score NUMERIC(3,2), -- 0.00 to 1.00
  credit_check_result JSONB,
  
  -- Partner tracking
  partner_reference TEXT, -- Reference number from SACCO/MFI
  partner_callback_url TEXT,
  partner_notes TEXT,
  
  -- Review and approval
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  approval_notes TEXT,
  decline_reason TEXT,
  
  -- Disbursement tracking (metadata only, no funds handling)
  disbursed_amount NUMERIC(15,2),
  disbursed_at TIMESTAMPTZ,
  disbursement_reference TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_applications_org_id ON public.loan_applications(org_id);
CREATE INDEX IF NOT EXISTS idx_loan_applications_user_id ON public.loan_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_applications_product_id ON public.loan_applications(product_id);
CREATE INDEX IF NOT EXISTS idx_loan_applications_status ON public.loan_applications(status);
CREATE INDEX IF NOT EXISTS idx_loan_applications_group_member_id ON public.loan_applications(group_member_id);

-- Loan application status history (audit trail)
CREATE TABLE IF NOT EXISTS public.loan_application_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_application_status_history_application_id ON public.loan_application_status_history(application_id);

-- Enable RLS
ALTER TABLE public.loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_application_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for loan_products
CREATE POLICY "Authenticated users can view enabled loan products"
  ON public.loan_products
  FOR SELECT
  USING (
    enabled = true
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Staff can manage their org loan products"
  ON public.loan_products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = loan_products.org_id
      AND user_id = auth.uid()
    )
  );

-- RLS Policies for loan_applications
CREATE POLICY "Users can view their own applications"
  ON public.loan_applications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create applications"
  ON public.loan_applications
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their draft applications"
  ON public.loan_applications
  FOR UPDATE
  USING (user_id = auth.uid() AND status = 'DRAFT')
  WITH CHECK (user_id = auth.uid() AND status IN ('DRAFT', 'SUBMITTED'));

CREATE POLICY "Staff can view their org applications"
  ON public.loan_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = loan_applications.org_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update their org applications"
  ON public.loan_applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = loan_applications.org_id
      AND user_id = auth.uid()
    )
  );

-- RLS Policies for loan_application_status_history
CREATE POLICY "Users can view their application history"
  ON public.loan_application_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.loan_applications
      WHERE id = loan_application_status_history.application_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view their org application history"
  ON public.loan_application_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.loan_applications la
      INNER JOIN public.org_memberships om ON om.org_id = la.org_id
      WHERE la.id = loan_application_status_history.application_id
      AND om.user_id = auth.uid()
    )
  );

-- Function to track status changes
CREATE OR REPLACE FUNCTION track_loan_application_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.loan_application_status_history (
      application_id,
      from_status,
      to_status,
      changed_by,
      notes
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      CASE 
        WHEN NEW.status = 'APPROVED' THEN NEW.approval_notes
        WHEN NEW.status = 'DECLINED' THEN NEW.decline_reason
        ELSE NEW.partner_notes
      END
    );
    
    NEW.status_updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS track_loan_application_status ON public.loan_applications;
CREATE TRIGGER track_loan_application_status
  BEFORE UPDATE ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION track_loan_application_status_change();

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_loan_products_updated_at ON public.loan_products;
CREATE TRIGGER update_loan_products_updated_at
  BEFORE UPDATE ON public.loan_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_loan_applications_updated_at ON public.loan_applications;
CREATE TRIGGER update_loan_applications_updated_at
  BEFORE UPDATE ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT SELECT ON public.loan_products TO authenticated;
GRANT ALL ON public.loan_applications TO authenticated;
GRANT SELECT ON public.loan_application_status_history TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Comments
COMMENT ON TABLE public.loan_products IS 'Loan products offered by SACCO/MFI partners (intermediation only)';
COMMENT ON TABLE public.loan_applications IS 'Digital loan applications routed to partners, no direct disbursement';
COMMENT ON TABLE public.loan_application_status_history IS 'Audit trail for loan application status changes';
COMMENT ON COLUMN public.loan_applications.status IS 'Application lifecycle: DRAFT → SUBMITTED → RECEIVED → UNDER_REVIEW → APPROVED/DECLINED → DISBURSED';
COMMENT ON COLUMN public.loan_applications.documents IS 'Array of uploaded documents: [{type, url, uploaded_at}]';
COMMENT ON COLUMN public.loan_applications.affordability_score IS 'Optional pre-scoring (P1 tier), range 0.00 to 1.00';
