-- =====================================================================
-- A/B TESTING FRAMEWORK FOR AGENT SYSTEM INSTRUCTIONS
-- =====================================================================
-- Allows testing different prompts/instructions to optimize agent performance
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. CREATE A/B TEST TRACKING TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.ai_agent_instruction_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  experiment_name text NOT NULL,
  variant_a_instruction_id uuid REFERENCES public.ai_agent_system_instructions(id),
  variant_b_instruction_id uuid REFERENCES public.ai_agent_system_instructions(id),
  traffic_split_percent integer DEFAULT 50 CHECK (traffic_split_percent >= 0 AND traffic_split_percent <= 100),
  start_date timestamptz DEFAULT now(),
  end_date timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  success_metric text, -- e.g., 'tool_execution_success_rate', 'user_satisfaction', 'conversation_length'
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instruction_experiments_agent ON public.ai_agent_instruction_experiments(agent_id);
CREATE INDEX IF NOT EXISTS idx_instruction_experiments_status ON public.ai_agent_instruction_experiments(status);

-- =====================================================================
-- 2. CREATE EXPERIMENT RESULTS TRACKING
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.ai_agent_experiment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES public.ai_agent_instruction_experiments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.whatsapp_users(id),
  variant text NOT NULL CHECK (variant IN ('A', 'B')),
  instruction_id uuid REFERENCES public.ai_agent_system_instructions(id),
  conversation_id uuid,
  success boolean,
  user_satisfaction_score integer CHECK (user_satisfaction_score >= 1 AND user_satisfaction_score <= 5),
  conversation_length integer, -- number of messages
  tools_executed integer DEFAULT 0,
  tools_succeeded integer DEFAULT 0,
  response_time_ms integer,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiment_results_experiment ON public.ai_agent_experiment_results(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_results_variant ON public.ai_agent_experiment_results(experiment_id, variant);

-- =====================================================================
-- 3. FUNCTION TO GET INSTRUCTION FOR USER (A/B TEST AWARE)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_agent_instruction_for_user(
  p_agent_id uuid,
  p_user_id uuid
) RETURNS uuid AS $$
DECLARE
  v_experiment_id uuid;
  v_variant text;
  v_instruction_id uuid;
  v_traffic_split integer;
  v_user_hash numeric;
BEGIN
  -- Check if there's an active experiment for this agent
  SELECT id, traffic_split_percent
  INTO v_experiment_id, v_traffic_split
  FROM ai_agent_instruction_experiments
  WHERE agent_id = p_agent_id
    AND status = 'active'
    AND start_date <= NOW()
    AND (end_date IS NULL OR end_date >= NOW())
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no experiment, return default instruction
  IF v_experiment_id IS NULL THEN
    SELECT id INTO v_instruction_id
    FROM ai_agent_system_instructions
    WHERE agent_id = p_agent_id
      AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN v_instruction_id;
  END IF;

  -- Consistent hash-based assignment (same user always gets same variant)
  v_user_hash := (('x' || substring(p_user_id::text, 1, 8))::bit(32)::bigint % 100);

  -- Assign to variant based on traffic split
  IF v_user_hash < v_traffic_split THEN
    v_variant := 'A';
    SELECT variant_a_instruction_id INTO v_instruction_id
    FROM ai_agent_instruction_experiments
    WHERE id = v_experiment_id;
  ELSE
    v_variant := 'B';
    SELECT variant_b_instruction_id INTO v_instruction_id
    FROM ai_agent_instruction_experiments
    WHERE id = v_experiment_id;
  END IF;

  -- Log the assignment
  INSERT INTO ai_agent_experiment_results (
    experiment_id, user_id, variant, instruction_id
  ) VALUES (
    v_experiment_id, p_user_id, v_variant, v_instruction_id
  );

  RETURN v_instruction_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 4. FUNCTION TO RECORD EXPERIMENT RESULT
-- =====================================================================

CREATE OR REPLACE FUNCTION public.record_experiment_result(
  p_experiment_id uuid,
  p_user_id uuid,
  p_success boolean DEFAULT NULL,
  p_satisfaction integer DEFAULT NULL,
  p_conversation_length integer DEFAULT NULL,
  p_tools_executed integer DEFAULT NULL,
  p_tools_succeeded integer DEFAULT NULL,
  p_response_time_ms integer DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS void AS $$
BEGIN
  UPDATE ai_agent_experiment_results
  SET 
    success = COALESCE(p_success, success),
    user_satisfaction_score = COALESCE(p_satisfaction, user_satisfaction_score),
    conversation_length = COALESCE(p_conversation_length, conversation_length),
    tools_executed = COALESCE(p_tools_executed, tools_executed),
    tools_succeeded = COALESCE(p_tools_succeeded, tools_succeeded),
    response_time_ms = COALESCE(p_response_time_ms, response_time_ms),
    metadata = COALESCE(p_metadata, metadata)
  WHERE id = (
    SELECT id FROM ai_agent_experiment_results
    WHERE experiment_id = p_experiment_id
      AND user_id = p_user_id
      AND created_at >= NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 5. VIEW FOR EXPERIMENT ANALYTICS
-- =====================================================================

CREATE OR REPLACE VIEW public.ai_agent_experiment_analytics AS
SELECT 
  e.id as experiment_id,
  e.experiment_name,
  a.slug as agent_slug,
  variants.variant,
  COUNT(*) as sample_size,
  AVG(CASE WHEN r.success THEN 1 ELSE 0 END) as success_rate,
  AVG(r.user_satisfaction_score) as avg_satisfaction,
  AVG(r.conversation_length) as avg_conversation_length,
  AVG(CASE WHEN r.tools_executed > 0 THEN r.tools_succeeded::float / r.tools_executed ELSE NULL END) as tool_success_rate,
  AVG(r.response_time_ms) as avg_response_time_ms,
  MIN(r.created_at) as first_result_at,
  MAX(r.created_at) as last_result_at
FROM ai_agent_instruction_experiments e
JOIN ai_agents a ON a.id = e.agent_id
CROSS JOIN LATERAL (VALUES ('A'), ('B')) AS variants(variant)
LEFT JOIN ai_agent_experiment_results r ON r.experiment_id = e.id 
  AND r.variant = variants.variant
WHERE e.status = 'active'
GROUP BY e.id, e.experiment_name, a.slug, variants.variant;

-- =====================================================================
-- 6. EXAMPLE: CREATE A/B TEST FOR SUPPORT AGENT
-- =====================================================================

-- Create variant B instruction (more concise)
INSERT INTO public.ai_agent_system_instructions (
  agent_id, code, title, instructions, guardrails, memory_strategy, is_active
)
SELECT 
  id,
  'SUPPORT-SYS-V2',
  'Support Agent System Prompt - Concise Version',
  E'You are easyMO Support. Help users quickly and efficiently.

ROUTING:
- Jobs → Jobs AI
- Property → Real Estate AI  
- Rides → Rides AI
- Food → Waiter AI
- Farm → Farmer AI
- Buy/Sell → Marketplace AI
- Insurance → Insurance AI

ACTIONS:
- Check account: get_user_info
- Check wallet: check_wallet_balance
- Complex issues: create_support_ticket
- Show menu: show_main_menu

Be brief, helpful, and route efficiently.',
  'Verify identity. Never share sensitive data. Escalate fraud immediately.',
  'Remember context, past tickets.',
  false -- Not active yet, will be enabled via experiment
FROM public.ai_agents WHERE slug = 'support'
ON CONFLICT (agent_id, code) DO UPDATE SET
  title = EXCLUDED.title,
  instructions = EXCLUDED.instructions,
  is_active = EXCLUDED.is_active;

-- Create experiment
INSERT INTO public.ai_agent_instruction_experiments (
  agent_id,
  experiment_name,
  variant_a_instruction_id,
  variant_b_instruction_id,
  traffic_split_percent,
  status,
  success_metric,
  notes
)
SELECT 
  a.id,
  'Support Agent: Verbose vs Concise Prompts',
  (SELECT id FROM ai_agent_system_instructions WHERE agent_id = a.id AND code = 'SUPPORT-SYS'),
  (SELECT id FROM ai_agent_system_instructions WHERE agent_id = a.id AND code = 'SUPPORT-SYS-V2'),
  50, -- 50/50 split
  'draft', -- Change to 'active' to start experiment
  'user_satisfaction_score',
  'Testing whether more concise instructions improve user satisfaction'
FROM public.ai_agents a
WHERE a.slug = 'support';

COMMIT;

-- =====================================================================
-- USAGE EXAMPLES
-- =====================================================================

-- Start the experiment:
-- UPDATE ai_agent_instruction_experiments 
-- SET status = 'active' 
-- WHERE experiment_name = 'Support Agent: Verbose vs Concise Prompts';

-- View results:
-- SELECT * FROM ai_agent_experiment_analytics 
-- WHERE experiment_name = 'Support Agent: Verbose vs Concise Prompts';

-- Stop experiment and choose winner:
-- UPDATE ai_agent_instruction_experiments 
-- SET status = 'completed', end_date = NOW() 
-- WHERE id = 'experiment_id';
-- 
-- UPDATE ai_agent_system_instructions 
-- SET is_active = true 
-- WHERE id = 'winning_variant_instruction_id';

-- =====================================================================
