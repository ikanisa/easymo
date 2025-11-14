BEGIN;

-- Migration: Event Store and Message Queue Infrastructure
-- Purpose: Event sourcing and async job processing for scalable architecture
-- Supports CQRS pattern and reliable asynchronous operations

-- ============================================================================
-- EVENT STORE TABLE (Partitioned for event sourcing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_store (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  aggregate_id text NOT NULL,
  aggregate_type text NOT NULL, -- 'trip', 'order', 'wallet', 'user', etc.
  event_type text NOT NULL,
  event_version integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  correlation_id text,
  causation_id text, -- Event that caused this event
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Partition bootstrapping for event store (default plus current & next month)
-- Default partition captures events until rolling partitions are created
CREATE TABLE IF NOT EXISTS public.event_store_default PARTITION OF public.event_store DEFAULT;

-- Indexes on default partition
CREATE INDEX IF NOT EXISTS idx_event_store_aggregate_default
  ON public.event_store_default (aggregate_type, aggregate_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_store_type_default
  ON public.event_store_default (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_store_correlation_default
  ON public.event_store_default (correlation_id)
  WHERE correlation_id IS NOT NULL;

-- Dynamically provision current and next month partitions with indexes
DO $$
DECLARE
  v_months date[] := ARRAY[
    date_trunc('month', timezone('utc', now()))::date,
    (date_trunc('month', timezone('utc', now()))::date + INTERVAL '1 month')::date
  ];
  v_start date;
  v_end date;
  v_suffix text;
BEGIN
  FOREACH v_start IN ARRAY v_months
  LOOP
    v_end := (v_start + INTERVAL '1 month')::date;
    v_suffix := to_char(v_start, 'YYYY_MM');

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.%I PARTITION OF public.event_store FOR VALUES FROM (%L) TO (%L);',
      'public',
      'event_store_' || v_suffix,
      v_start,
      v_end
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (aggregate_type, aggregate_id, created_at DESC);',
      'idx_event_store_aggregate_' || v_suffix,
      'public',
      'event_store_' || v_suffix
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (event_type, created_at DESC);',
      'idx_event_store_type_' || v_suffix,
      'public',
      'event_store_' || v_suffix
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (correlation_id) WHERE correlation_id IS NOT NULL;',
      'idx_event_store_correlation_' || v_suffix,
      'public',
      'event_store_' || v_suffix
    );
  END LOOP;
END
$$;

-- RLS policies for event store
ALTER TABLE public.event_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_events" ON public.event_store;
CREATE POLICY "service_role_full_access_events" 
  ON public.event_store 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_events" ON public.event_store;
CREATE POLICY "authenticated_read_events" 
  ON public.event_store 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.event_store TO authenticated;
GRANT ALL ON public.event_store TO service_role;

-- ============================================================================
-- MESSAGE QUEUE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.message_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_name text NOT NULL,
  message_type text NOT NULL,
  payload jsonb NOT NULL,
  priority integer DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'dead_letter')),
  scheduled_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  started_at timestamptz,
  processed_at timestamptz,
  error_message text,
  error_stack text,
  correlation_id text,
  idempotency_key text UNIQUE,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for message queue
CREATE INDEX IF NOT EXISTS idx_message_queue_pending 
  ON public.message_queue (status, priority DESC, scheduled_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_message_queue_queue_name 
  ON public.message_queue (queue_name, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_queue_correlation 
  ON public.message_queue (correlation_id) 
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_queue_idempotency 
  ON public.message_queue (idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- RLS policies for message queue
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_queue" ON public.message_queue;
CREATE POLICY "service_role_full_access_queue" 
  ON public.message_queue 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_queue" ON public.message_queue;
CREATE POLICY "authenticated_read_queue" 
  ON public.message_queue 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.message_queue TO authenticated;
GRANT ALL ON public.message_queue TO service_role;

-- ============================================================================
-- BACKGROUND JOBS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.background_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type text NOT NULL,
  job_name text,
  payload jsonb NOT NULL,
  priority integer DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'timeout')),
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  scheduled_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  timeout_seconds integer DEFAULT 300,
  error_message text,
  error_stack text,
  result jsonb,
  correlation_id text,
  idempotency_key text UNIQUE,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for background jobs
CREATE INDEX IF NOT EXISTS idx_background_jobs_pending 
  ON public.background_jobs (status, priority DESC, scheduled_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_background_jobs_type_status 
  ON public.background_jobs (job_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_background_jobs_correlation 
  ON public.background_jobs (correlation_id) 
  WHERE correlation_id IS NOT NULL;

-- RLS policies for background jobs
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_jobs" ON public.background_jobs;
CREATE POLICY "service_role_full_access_jobs" 
  ON public.background_jobs 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_jobs" ON public.background_jobs;
CREATE POLICY "authenticated_read_jobs" 
  ON public.background_jobs 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.background_jobs TO authenticated;
GRANT ALL ON public.background_jobs TO service_role;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to append an event to the event store
CREATE OR REPLACE FUNCTION public.append_event(
  p_aggregate_id text,
  p_aggregate_type text,
  p_event_type text,
  p_payload jsonb,
  p_correlation_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.event_store (
    aggregate_id,
    aggregate_type,
    event_type,
    payload,
    correlation_id,
    metadata,
    user_id
  ) VALUES (
    p_aggregate_id,
    p_aggregate_type,
    p_event_type,
    p_payload,
    p_correlation_id,
    p_metadata,
    auth.uid()
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Function to get aggregate event history
CREATE OR REPLACE FUNCTION public.get_aggregate_events(
  p_aggregate_type text,
  p_aggregate_id text,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  event_type text,
  event_version integer,
  payload jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.event_type,
    e.event_version,
    e.payload,
    e.created_at
  FROM public.event_store e
  WHERE e.aggregate_type = p_aggregate_type
    AND e.aggregate_id = p_aggregate_id
  ORDER BY e.created_at ASC
  LIMIT p_limit;
END;
$$;

-- Function to enqueue a message
CREATE OR REPLACE FUNCTION public.enqueue_message(
  p_queue_name text,
  p_message_type text,
  p_payload jsonb,
  p_priority integer DEFAULT 5,
  p_scheduled_at timestamptz DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id uuid;
  v_existing_message uuid;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_message
    FROM public.message_queue
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
    
    IF v_existing_message IS NOT NULL THEN
      RETURN v_existing_message;
    END IF;
  END IF;
  
  INSERT INTO public.message_queue (
    queue_name,
    message_type,
    payload,
    priority,
    scheduled_at,
    idempotency_key
  ) VALUES (
    p_queue_name,
    p_message_type,
    p_payload,
    p_priority,
    COALESCE(p_scheduled_at, timezone('utc', now())),
    p_idempotency_key
  ) RETURNING id INTO v_message_id;
  
  RETURN v_message_id;
END;
$$;

-- Function to schedule a background job
CREATE OR REPLACE FUNCTION public.schedule_job(
  p_job_type text,
  p_job_name text,
  p_payload jsonb,
  p_scheduled_at timestamptz DEFAULT NULL,
  p_priority integer DEFAULT 5,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id uuid;
  v_existing_job uuid;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_job
    FROM public.background_jobs
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
    
    IF v_existing_job IS NOT NULL THEN
      RETURN v_existing_job;
    END IF;
  END IF;
  
  INSERT INTO public.background_jobs (
    job_type,
    job_name,
    payload,
    priority,
    scheduled_at,
    idempotency_key
  ) VALUES (
    p_job_type,
    p_job_name,
    p_payload,
    p_priority,
    COALESCE(p_scheduled_at, timezone('utc', now())),
    p_idempotency_key
  ) RETURNING id INTO v_job_id;
  
  RETURN v_job_id;
END;
$$;

-- Function to mark job as completed
CREATE OR REPLACE FUNCTION public.complete_job(
  p_job_id uuid,
  p_result jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.background_jobs
  SET 
    status = 'completed',
    result = p_result,
    completed_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  WHERE id = p_job_id
    AND status = 'running';
  
  RETURN FOUND;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.append_event(text, text, text, jsonb, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_aggregate_events(text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_message(text, text, jsonb, integer, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.schedule_job(text, text, jsonb, timestamptz, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_job(uuid, jsonb) TO service_role;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for event store statistics
CREATE OR REPLACE VIEW public.event_store_stats AS
SELECT 
  aggregate_type,
  event_type,
  COUNT(*) as event_count,
  MAX(created_at) as last_event_at
FROM public.event_store
WHERE created_at > now() - interval '24 hours'
GROUP BY aggregate_type, event_type
ORDER BY aggregate_type, event_type;

-- View for message queue statistics
CREATE OR REPLACE VIEW public.message_queue_stats AS
SELECT 
  queue_name,
  status,
  COUNT(*) as message_count,
  MIN(scheduled_at) as oldest_message,
  AVG(retry_count) as avg_retries
FROM public.message_queue
WHERE created_at > now() - interval '24 hours'
GROUP BY queue_name, status
ORDER BY queue_name, status;

-- View for background job statistics
CREATE OR REPLACE VIEW public.background_job_stats AS
SELECT 
  job_type,
  status,
  COUNT(*) as job_count,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
FROM public.background_jobs
WHERE created_at > now() - interval '24 hours'
GROUP BY job_type, status
ORDER BY job_type, status;

-- Grant view access
GRANT SELECT ON public.event_store_stats TO authenticated;
GRANT SELECT ON public.message_queue_stats TO authenticated;
GRANT SELECT ON public.background_job_stats TO authenticated;

COMMIT;
