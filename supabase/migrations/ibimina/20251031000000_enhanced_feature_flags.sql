-- Migration: Enhanced feature flags for African fintech supa app
-- Description: Add feature toggle matrix with org-level and partner-level configurations
-- Date: 2025-10-31

-- Extend configuration table to support feature flag metadata
COMMENT ON TABLE public.configuration IS 'Key-value configuration store for feature flags and operational settings';

-- Insert enhanced feature flag schema with regulatory tiers
INSERT INTO public.configuration (key, description, value)
VALUES (
  'client_feature_matrix',
  'Feature toggle matrix for client app with regulatory tiers (P0=no licenses, P1=partnered, P2=licensed)',
  '{
    "savings": {
      "enabled": true,
      "tier": "P0",
      "features": {
        "ussd_deposit_reference": true,
        "allocation_evidence": true,
        "group_vault_proxy": false,
        "direct_account_api": false
      }
    },
    "loans": {
      "enabled": false,
      "tier": "P0",
      "features": {
        "digital_applications": false,
        "doc_collection": false,
        "pre_scoring": false,
        "offer_accept_disburse": false
      }
    },
    "wallet": {
      "enabled": false,
      "tier": "P0",
      "features": {
        "proxy_wallet": false,
        "transaction_evidence": false,
        "light_custodial": false,
        "full_custodial": false
      }
    },
    "tokens": {
      "enabled": false,
      "tier": "P0",
      "features": {
        "voucher_tokens_offchain": false,
        "stablecoin_onramp": false,
        "multi_chain_settlement": false
      }
    },
    "nfc": {
      "enabled": false,
      "tier": "P0",
      "features": {
        "ndef_tag_reference": false,
        "hce_vouchers": false,
        "card_emulation_closed_loop": false
      }
    },
    "kyc": {
      "enabled": true,
      "tier": "P0",
      "features": {
        "ocr_selfie_capture": true,
        "third_party_screening": false,
        "full_kyc_account_opening": false
      }
    },
    "ai_agent": {
      "enabled": false,
      "tier": "P0",
      "features": {
        "faq_ussd_help": false,
        "whatsapp_bot": false,
        "voice_ivr_ticketing": false
      }
    }
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description;

-- Add org-specific feature overrides table
CREATE TABLE IF NOT EXISTS public.org_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,  -- Note: organizations table may not exist yet
  feature_domain TEXT NOT NULL CHECK (feature_domain IN ('savings', 'loans', 'wallet', 'tokens', 'nfc', 'kyc', 'ai_agent')),
  tier TEXT NOT NULL CHECK (tier IN ('P0', 'P1', 'P2')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  feature_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  partner_agreement_ref TEXT,
  risk_signoff_by UUID REFERENCES auth.users(id),
  risk_signoff_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, feature_domain)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_org_feature_overrides_org_id ON public.org_feature_overrides(org_id);
CREATE INDEX IF NOT EXISTS idx_org_feature_overrides_domain ON public.org_feature_overrides(feature_domain);
CREATE INDEX IF NOT EXISTS idx_org_feature_overrides_enabled ON public.org_feature_overrides(enabled) WHERE enabled = true;

-- Enable RLS
ALTER TABLE public.org_feature_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "System admins manage org feature overrides"
  ON public.org_feature_overrides
  FOR ALL
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

-- Only create this policy if org_memberships table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'org_memberships') THEN
    EXECUTE '
      CREATE POLICY "Staff can read their org feature overrides"
        ON public.org_feature_overrides
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.org_memberships
            WHERE org_id = org_feature_overrides.org_id
            AND user_id = auth.uid()
          )
        )';
  ELSE
    -- Fallback: allow authenticated users to read (can be tightened later)
    EXECUTE '
      CREATE POLICY "Staff can read their org feature overrides"
        ON public.org_feature_overrides
        FOR SELECT
        USING (auth.uid() IS NOT NULL)';
  END IF;
END $$;

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_org_feature_overrides_updated_at ON public.org_feature_overrides;
CREATE TRIGGER update_org_feature_overrides_updated_at
  BEFORE UPDATE ON public.org_feature_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT SELECT ON public.org_feature_overrides TO authenticated;
GRANT ALL ON public.org_feature_overrides TO service_role;

-- Add comments
COMMENT ON TABLE public.org_feature_overrides IS 'Organization-specific feature flag overrides with regulatory tier tracking';
COMMENT ON COLUMN public.org_feature_overrides.tier IS 'Regulatory tier: P0=no licenses, P1=partnered, P2=licensed';
COMMENT ON COLUMN public.org_feature_overrides.partner_agreement_ref IS 'Reference to partnership agreement document or ID';
COMMENT ON COLUMN public.org_feature_overrides.risk_signoff_by IS 'User who approved the risk assessment';
