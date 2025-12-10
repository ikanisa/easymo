BEGIN;

-- Migration: WhatsApp Session Management
-- Purpose: Centralized WhatsApp session tracking and management
-- Critical for scalability and multi-device support

-- ============================================================================
-- WHATSAPP SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text UNIQUE NOT NULL,
  session_token text NOT NULL,
  webhook_url text,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive', 'suspended', 'expired')),
  device_info jsonb DEFAULT '{}'::jsonb,
  last_activity_at timestamptz,
  last_message_at timestamptz,
  message_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  last_error text,
  last_error_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  expires_at timestamptz
);

-- Indexes for WhatsApp sessions
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone 
  ON public.whatsapp_sessions (phone_number);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_status 
  ON public.whatsapp_sessions (status) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_expires 
  ON public.whatsapp_sessions (expires_at) 
  WHERE status = 'active' AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_last_activity 
  ON public.whatsapp_sessions (last_activity_at DESC);

-- RLS policies
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_wa_sessions" ON public.whatsapp_sessions;
CREATE POLICY "service_role_full_access_wa_sessions" 
  ON public.whatsapp_sessions 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_wa_sessions" ON public.whatsapp_sessions;
CREATE POLICY "authenticated_read_wa_sessions" 
  ON public.whatsapp_sessions 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.whatsapp_sessions TO authenticated;
GRANT ALL ON public.whatsapp_sessions TO service_role;

-- ============================================================================
-- WHATSAPP MESSAGE QUEUE
-- ============================================================================

-- Table for queuing outbound WhatsApp messages
CREATE TABLE IF NOT EXISTS public.whatsapp_message_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
  recipient_phone text NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('text', 'template', 'media', 'interactive', 'location')),
  message_payload jsonb NOT NULL,
  priority integer DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  scheduled_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  processed_at timestamptz,
  sent_at timestamptz,
  error_message text,
  whatsapp_message_id text,
  correlation_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for message queue
CREATE INDEX IF NOT EXISTS idx_wa_queue_status_scheduled 
  ON public.whatsapp_message_queue (status, scheduled_at) 
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_wa_queue_session 
  ON public.whatsapp_message_queue (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_queue_recipient 
  ON public.whatsapp_message_queue (recipient_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_queue_correlation 
  ON public.whatsapp_message_queue (correlation_id) 
  WHERE correlation_id IS NOT NULL;

-- RLS policies
ALTER TABLE public.whatsapp_message_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_wa_queue" ON public.whatsapp_message_queue;
CREATE POLICY "service_role_full_access_wa_queue" 
  ON public.whatsapp_message_queue 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_wa_queue" ON public.whatsapp_message_queue;
CREATE POLICY "authenticated_read_wa_queue" 
  ON public.whatsapp_message_queue 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.whatsapp_message_queue TO authenticated;
GRANT ALL ON public.whatsapp_message_queue TO service_role;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update session activity
CREATE OR REPLACE FUNCTION public.update_whatsapp_session_activity(
  p_phone_number text,
  p_increment_message_count boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.whatsapp_sessions
  SET 
    last_activity_at = timezone('utc', now()),
    last_message_at = CASE WHEN p_increment_message_count THEN timezone('utc', now()) ELSE last_message_at END,
    message_count = CASE WHEN p_increment_message_count THEN message_count + 1 ELSE message_count END,
    updated_at = timezone('utc', now())
  WHERE phone_number = p_phone_number;
END;
$$;

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_whatsapp_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Mark expired sessions as inactive
  UPDATE public.whatsapp_sessions
  SET 
    status = 'expired',
    updated_at = timezone('utc', now())
  WHERE 
    status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < timezone('utc', now());
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;

-- Function to enqueue a WhatsApp message
CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_message(
  p_recipient_phone text,
  p_message_type text,
  p_message_payload jsonb,
  p_priority integer DEFAULT 5,
  p_correlation_id text DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id uuid;
  v_session_id uuid;
BEGIN
  -- Get the active session for this recipient
  SELECT id INTO v_session_id
  FROM public.whatsapp_sessions
  WHERE phone_number = p_recipient_phone
    AND status = 'active'
  LIMIT 1;
  
  -- Insert the message into the queue
  INSERT INTO public.whatsapp_message_queue (
    session_id,
    recipient_phone,
    message_type,
    message_payload,
    priority,
    correlation_id,
    scheduled_at
  ) VALUES (
    v_session_id,
    p_recipient_phone,
    p_message_type,
    p_message_payload,
    p_priority,
    p_correlation_id,
    COALESCE(p_scheduled_at, timezone('utc', now()))
  ) RETURNING id INTO v_message_id;
  
  RETURN v_message_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_whatsapp_session_activity(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_whatsapp_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_whatsapp_message(text, text, jsonb, integer, text, timestamptz) TO service_role;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for active session statistics
CREATE OR REPLACE VIEW public.whatsapp_session_stats AS
SELECT 
  status,
  COUNT(*) as session_count,
  SUM(message_count) as total_messages,
  AVG(message_count) as avg_messages_per_session,
  MAX(last_activity_at) as last_activity
FROM public.whatsapp_sessions
GROUP BY status
ORDER BY status;

-- View for message queue statistics
CREATE OR REPLACE VIEW public.whatsapp_queue_stats AS
SELECT 
  status,
  COUNT(*) as message_count,
  MIN(scheduled_at) as oldest_message,
  MAX(created_at) as newest_message
FROM public.whatsapp_message_queue
WHERE created_at > now() - interval '24 hours'
GROUP BY status
ORDER BY status;

-- Grant view access
GRANT SELECT ON public.whatsapp_session_stats TO authenticated;
GRANT SELECT ON public.whatsapp_queue_stats TO authenticated;

COMMIT;
