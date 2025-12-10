BEGIN;

-- Migration: Add observability enhancements
-- Date: 2025-11-12
-- Description: Enhance observability with structured logging and correlation IDs per GROUND_RULES.md

-- Function: Log structured event (compliant with GROUND_RULES.md)
CREATE OR REPLACE FUNCTION public.log_structured_event(
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'::JSONB,
  p_user_id TEXT DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_correlation_id TEXT;
BEGIN
  -- Generate correlation ID if not provided
  v_correlation_id := COALESCE(p_correlation_id, gen_random_uuid()::TEXT);
  
  -- Insert into event store
  INSERT INTO public.event_store (
    event_type,
    event_data,
    user_id,
    correlation_id,
    created_at
  ) VALUES (
    p_event_type,
    p_event_data || jsonb_build_object(
      'timestamp', NOW()::TEXT,
      'source', 'database'
    ),
    p_user_id,
    v_correlation_id,
    NOW()
  ) RETURNING id INTO v_event_id;
  
  -- Also record as metric for aggregation
  PERFORM public.record_metric(
    'event.' || p_event_type,
    1,
    jsonb_build_object(
      'correlation_id', v_correlation_id,
      'user_id', p_user_id
    )
  );
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get events by correlation ID
CREATE OR REPLACE FUNCTION public.get_events_by_correlation(
  p_correlation_id TEXT,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  event_data JSONB,
  user_id TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.event_type,
    e.event_data,
    e.user_id,
    e.created_at
  FROM public.event_store e
  WHERE e.correlation_id = p_correlation_id
  ORDER BY e.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Enhanced audit logging with PII masking
CREATE OR REPLACE FUNCTION public.log_audit_event_enhanced(
  p_user_id TEXT,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_correlation_id TEXT DEFAULT NULL,
  p_mask_pii BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
  v_masked_metadata JSONB;
BEGIN
  -- Mask PII fields if requested
  IF p_mask_pii THEN
    v_masked_metadata := p_metadata;
    -- Mask common PII fields
    IF v_masked_metadata ? 'phone' THEN
      v_masked_metadata := v_masked_metadata || jsonb_build_object('phone', '***MASKED***');
    END IF;
    IF v_masked_metadata ? 'email' THEN
      v_masked_metadata := v_masked_metadata || jsonb_build_object('email', '***MASKED***');
    END IF;
    IF v_masked_metadata ? 'password' THEN
      v_masked_metadata := v_masked_metadata || jsonb_build_object('password', '***MASKED***');
    END IF;
  ELSE
    v_masked_metadata := p_metadata;
  END IF;
  
  -- Insert audit log
  INSERT INTO public.system_audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata,
    correlation_id,
    created_at
  ) VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    v_masked_metadata || jsonb_build_object(
      'timestamp', NOW()::TEXT,
      'pii_masked', p_mask_pii
    ),
    COALESCE(p_correlation_id, gen_random_uuid()::TEXT),
    NOW()
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get audit trail for resource
CREATE OR REPLACE FUNCTION public.get_audit_trail(
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  user_id TEXT,
  action TEXT,
  metadata JSONB,
  correlation_id TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.user_id,
    a.action,
    a.metadata,
    a.correlation_id,
    a.created_at
  FROM public.system_audit_logs a
  WHERE 
    a.resource_type = p_resource_type
    AND a.resource_id = p_resource_id
  ORDER BY a.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.log_structured_event(TEXT, JSONB, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_events_by_correlation(TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_audit_event_enhanced(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_audit_trail(TEXT, TEXT, INTEGER) TO authenticated, service_role;

COMMIT;
