-- Motor insurance feature gate audit trail
BEGIN;

CREATE TABLE IF NOT EXISTS public.feature_gate_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature text NOT NULL,
  rule_hit text NOT NULL,
  msisdn text NOT NULL,
  detected_country text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_feature_gate_audit_feature
  ON public.feature_gate_audit (feature);
CREATE INDEX IF NOT EXISTS idx_feature_gate_audit_msisdn
  ON public.feature_gate_audit (msisdn);
CREATE INDEX IF NOT EXISTS idx_feature_gate_audit_created_at
  ON public.feature_gate_audit (created_at DESC);

ALTER TABLE public.feature_gate_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY feature_gate_audit_platform_full ON public.feature_gate_audit
  FOR ALL USING (public.auth_role() = 'platform')
  WITH CHECK (public.auth_role() = 'platform');

COMMIT;
