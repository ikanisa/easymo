-- =====================================================================
-- AI AGENT TOOL EXECUTIONS TABLE
-- =====================================================================
-- Logs all tool executions for monitoring and analytics
-- =====================================================================

BEGIN;

-- Create tool executions table
CREATE TABLE IF NOT EXISTS public.ai_agent_tool_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  tool_id uuid REFERENCES public.ai_agent_tools(id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  inputs jsonb NOT NULL,
  result jsonb,
  error text,
  execution_time_ms integer NOT NULL,
  success boolean NOT NULL DEFAULT false,
  user_id uuid,
  conversation_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tool_executions_agent_id ON public.ai_agent_tool_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool_id ON public.ai_agent_tool_executions(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool_name ON public.ai_agent_tool_executions(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_executions_success ON public.ai_agent_tool_executions(success);
CREATE INDEX IF NOT EXISTS idx_tool_executions_created_at ON public.ai_agent_tool_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_executions_user_id ON public.ai_agent_tool_executions(user_id) WHERE user_id IS NOT NULL;

-- RLS policies
ALTER TABLE public.ai_agent_tool_executions ENABLE ROW LEVEL SECURITY;

-- Admin can view all executions
CREATE POLICY "Admins can view all tool executions"
  ON public.ai_agent_tool_executions
  FOR SELECT
  TO authenticated
  USING (true); -- Simplified - can be restricted later based on actual admin table structure

-- Create helper view for analytics
CREATE OR REPLACE VIEW public.ai_agent_tool_execution_stats AS
SELECT 
  tool_name,
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE success) as successful_executions,
  COUNT(*) FILTER (WHERE NOT success) as failed_executions,
  ROUND(AVG(execution_time_ms)::numeric, 2) as avg_execution_time_ms,
  MIN(execution_time_ms) as min_execution_time_ms,
  MAX(execution_time_ms) as max_execution_time_ms,
  DATE_TRUNC('day', created_at) as date
FROM public.ai_agent_tool_executions
GROUP BY tool_name, DATE_TRUNC('day', created_at)
ORDER BY date DESC, total_executions DESC;

COMMENT ON TABLE public.ai_agent_tool_executions IS 'Logs all AI agent tool executions for monitoring and analytics';
COMMENT ON VIEW public.ai_agent_tool_execution_stats IS 'Daily statistics for tool executions';

COMMIT;
