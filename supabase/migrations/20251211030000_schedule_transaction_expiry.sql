BEGIN;

-- Migration: Schedule Transaction Expiry
-- Purpose: Enable automatic expiration of stale marketplace transactions
-- Date: 2025-12-11

-- Create cron job log table for tracking execution
CREATE TABLE IF NOT EXISTS public.cron_job_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  records_affected INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_job_log_name_time ON public.cron_job_log(job_name, executed_at DESC);

-- Enable RLS
ALTER TABLE public.cron_job_log ENABLE ROW LEVEL SECURITY;

-- RLS: Service role only
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cron_job_log' AND policyname = 'service_role_manage_cron_log') THEN
        CREATE POLICY "service_role_manage_cron_log" ON public.cron_job_log 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- Wrapper function to call expire_marketplace_transactions and log results
CREATE OR REPLACE FUNCTION public.trigger_transaction_expiry()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count INTEGER;
  v_result jsonb;
BEGIN
  -- Call the expiry function
  PERFORM public.expire_marketplace_transactions();
  
  -- Get count of expired transactions
  SELECT COUNT(*)::INTEGER INTO v_expired_count
  FROM public.marketplace_transactions
  WHERE status = 'expired'
  AND updated_at > NOW() - INTERVAL '1 minute';
  
  -- Log execution
  INSERT INTO public.cron_job_log (
    job_name,
    executed_at,
    status,
    records_affected
  ) VALUES (
    'expire_marketplace_transactions',
    NOW(),
    'success',
    v_expired_count
  );
  
  v_result := jsonb_build_object(
    'success', true,
    'expired_count', v_expired_count,
    'executed_at', NOW()
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  -- Log failure
  INSERT INTO public.cron_job_log (
    job_name,
    executed_at,
    status,
    error
  ) VALUES (
    'expire_marketplace_transactions',
    NOW(),
    'failed',
    SQLERRM
  );
  
  v_result := jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON TABLE public.cron_job_log IS 'Log of scheduled job executions';
COMMENT ON FUNCTION public.trigger_transaction_expiry IS 'Expires stale marketplace transactions and logs execution';

GRANT EXECUTE ON FUNCTION public.trigger_transaction_expiry() TO authenticated;

COMMIT;
