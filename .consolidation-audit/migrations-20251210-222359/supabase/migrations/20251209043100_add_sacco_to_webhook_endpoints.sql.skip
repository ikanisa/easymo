-- Add SACCO support to momo_webhook_endpoints
-- Adds sacco_id column and updates service_type constraint

BEGIN;

-- Add sacco_id column to link webhook to a SACCO
ALTER TABLE public.momo_webhook_endpoints
  ADD COLUMN IF NOT EXISTS sacco_id UUID REFERENCES app.saccos(id) ON DELETE CASCADE;

-- Create index for sacco_id
CREATE INDEX IF NOT EXISTS idx_momo_webhook_endpoints_sacco_id 
  ON public.momo_webhook_endpoints(sacco_id);

-- Drop old constraint and recreate with 'sacco' option
ALTER TABLE public.momo_webhook_endpoints 
  DROP CONSTRAINT IF EXISTS momo_webhook_endpoints_service_type_check;

ALTER TABLE public.momo_webhook_endpoints
  ADD CONSTRAINT momo_webhook_endpoints_service_type_check 
  CHECK (service_type IN ('rides', 'marketplace', 'jobs', 'insurance', 'sacco'));

-- =====================================================
-- Function: app.register_sacco_webhook
-- Registers a webhook endpoint for a SACCO
-- =====================================================
CREATE OR REPLACE FUNCTION app.register_sacco_webhook(
  p_sacco_id UUID,
  p_momo_phone_number TEXT,
  p_webhook_secret TEXT,
  p_device_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_webhook_id UUID;
BEGIN
  -- Verify SACCO exists
  IF NOT EXISTS (SELECT 1 FROM app.saccos WHERE id = p_sacco_id AND status = 'active') THEN
    RAISE EXCEPTION 'SACCO not found or inactive: %', p_sacco_id;
  END IF;

  -- Insert or update webhook endpoint
  INSERT INTO public.momo_webhook_endpoints (
    momo_phone_number,
    service_type,
    webhook_secret,
    device_id,
    description,
    sacco_id,
    is_active
  )
  VALUES (
    p_momo_phone_number,
    'sacco',
    p_webhook_secret,
    p_device_id,
    COALESCE(p_description, 'SACCO webhook for ' || (SELECT name FROM app.saccos WHERE id = p_sacco_id)),
    p_sacco_id,
    true
  )
  ON CONFLICT (momo_phone_number) 
  DO UPDATE SET
    service_type = 'sacco',
    webhook_secret = EXCLUDED.webhook_secret,
    device_id = EXCLUDED.device_id,
    description = EXCLUDED.description,
    sacco_id = EXCLUDED.sacco_id,
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_webhook_id;

  RETURN v_webhook_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app.register_sacco_webhook IS 'Registers or updates a webhook endpoint for a SACCO';

COMMIT;
