-- Create RPC function for getting next job with FOR UPDATE SKIP LOCKED
-- This ensures atomic operation and prevents double-processing

CREATE OR REPLACE FUNCTION get_next_job(p_job_type TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  job_type TEXT,
  payload_json JSONB,
  status TEXT,
  priority INTEGER,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.user_id,
    j.job_type,
    j.payload_json,
    j.status,
    j.priority,
    j.created_at,
    j.started_at,
    j.completed_at,
    j.error_message,
    j.retry_count
  FROM jobs j
  WHERE j.status = 'pending'
    AND (p_job_type IS NULL OR j.job_type = p_job_type)
    AND j.retry_count < 3
  ORDER BY j.priority DESC, j.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
END;
$$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_jobs_status_priority_created 
ON jobs(status, priority DESC, created_at ASC) 
WHERE status = 'pending';

-- Add comment
COMMENT ON FUNCTION get_next_job IS 'Atomically gets the next pending job using FOR UPDATE SKIP LOCKED to prevent double-processing';

