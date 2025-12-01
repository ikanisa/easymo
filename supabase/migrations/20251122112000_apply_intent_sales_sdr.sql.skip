-- =====================================================================
-- APPLY INTENT: SALES SDR (Cold Caller) AGENT
-- =====================================================================
-- Domain-specific intent application for Sales/Marketing Cold Caller Agent
-- Called by agent framework after intent is parsed
--
-- FEATURES:
-- - Qualify leads via conversation
-- - Track outreach campaigns
-- - Schedule follow-ups
-- - Log call outcomes
-- - Manage prospect lists
-- - Create opportunities
--
-- INTENT TYPES SUPPORTED:
-- - qualify_lead: Assess lead quality
-- - schedule_followup: Schedule next contact
-- - create_opportunity: Convert lead to opportunity
-- - log_call: Record call outcome
-- - update_lead_status: Change lead status
-- - view_prospects, my_leads: View assigned leads
-- - general_inquiry, help: Show help information
--
-- Created: 2025-11-22 (Agent Refactor - Phase 1)
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_intent_sales_sdr(
  intent_id uuid,
  payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_intent_type text;
  v_user_id uuid;
  v_result jsonb := '{}';
  v_updated_entities jsonb[] := '{}';
  v_matches jsonb[] := '{}';
  v_next_action text;
BEGIN
  -- 1. Get intent details
  SELECT ai.intent_type, wc.user_id
  INTO v_intent_type, v_user_id
  FROM ai_agent_intents ai
  JOIN whatsapp_conversations wc ON wc.id = ai.conversation_id
  WHERE ai.id = intent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intent not found: %', intent_id;
  END IF;

  -- 2. Apply intent based on type
  CASE v_intent_type
    
    -- QUALIFY LEAD
    WHEN 'qualify_lead' THEN
      DECLARE
        v_lead_id uuid;
        v_lead_score int;
        v_qualification_notes text;
        v_company_name text;
        v_industry text;
        v_budget_range text;
      BEGIN
        v_lead_id := COALESCE((payload->>'lead_id')::uuid, gen_random_uuid());
        v_lead_score := COALESCE((payload->>'score')::int, 50);
        v_qualification_notes := payload->>'notes';
        v_company_name := payload->>'company';
        v_industry := payload->>'industry';
        v_budget_range := payload->>'budget';
        
        -- Create or update lead record (assuming sales_leads table)
        INSERT INTO sales_leads (
          id,
          sdr_id,
          phone_number,
          company_name,
          industry,
          budget_range,
          lead_score,
          status,
          qualification_notes
        )
        VALUES (
          v_lead_id,
          v_user_id,
          (SELECT phone_number FROM whatsapp_users WHERE id = v_user_id),
          v_company_name,
          v_industry,
          v_budget_range,
          v_lead_score,
          'qualified',
          v_qualification_notes
        )
        ON CONFLICT (id) DO UPDATE SET
          lead_score = EXCLUDED.lead_score,
          status = EXCLUDED.status,
          qualification_notes = EXCLUDED.qualification_notes,
          updated_at = NOW();
        
        v_next_action := format(
          'Lead qualified with score %s/100. Company: %s. Next: schedule followup or create opportunity.',
          v_lead_score, v_company_name
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'sales_lead',
            'action', 'qualified',
            'lead_id', v_lead_id,
            'score', v_lead_score,
            'company', v_company_name
          )
        ];
      END;
    
    -- SCHEDULE FOLLOW-UP
    WHEN 'schedule_followup', 'schedule_call' THEN
      DECLARE
        v_lead_id uuid;
        v_followup_date timestamptz;
        v_followup_type text;
        v_notes text;
        v_followup_id uuid;
      BEGIN
        v_lead_id := (payload->>'lead_id')::uuid;
        v_followup_date := (payload->>'followup_date')::timestamptz;
        v_followup_type := COALESCE(payload->>'type', 'call');
        v_notes := payload->>'notes';
        
        -- Create followup task
        INSERT INTO sales_followups (
          lead_id,
          sdr_id,
          followup_date,
          followup_type,
          notes,
          status
        )
        VALUES (
          v_lead_id,
          v_user_id,
          v_followup_date,
          v_followup_type,
          v_notes,
          'scheduled'
        )
        RETURNING id INTO v_followup_id;
        
        v_next_action := format(
          'Followup scheduled for %s. Type: %s. Will notify at scheduled time.',
          v_followup_date, v_followup_type
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'followup',
            'action', 'scheduled',
            'followup_id', v_followup_id,
            'lead_id', v_lead_id,
            'date', v_followup_date
          )
        ];
      END;
    
    -- CREATE OPPORTUNITY
    WHEN 'create_opportunity' THEN
      DECLARE
        v_lead_id uuid;
        v_opportunity_id uuid;
        v_opportunity_name text;
        v_value numeric;
        v_stage text;
      BEGIN
        v_lead_id := (payload->>'lead_id')::uuid;
        v_opportunity_name := payload->>'name';
        v_value := (payload->>'value')::numeric;
        v_stage := COALESCE(payload->>'stage', 'prospecting');
        
        -- Create sales opportunity
        INSERT INTO sales_opportunities (
          lead_id,
          sdr_id,
          name,
          value,
          currency,
          stage,
          status
        )
        VALUES (
          v_lead_id,
          v_user_id,
          v_opportunity_name,
          v_value,
          'RWF',
          v_stage,
          'open'
        )
        RETURNING id INTO v_opportunity_id;
        
        -- Update lead status
        UPDATE sales_leads
        SET status = 'opportunity_created'
        WHERE id = v_lead_id;
        
        v_next_action := format(
          'Opportunity created! ID: %s, Value: %s RWF. Notify sales team.',
          v_opportunity_id, v_value
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'opportunity',
            'action', 'created',
            'opportunity_id', v_opportunity_id,
            'value', v_value
          )
        ];
      END;
    
    -- LOG CALL OUTCOME
    WHEN 'log_call', 'call_completed' THEN
      DECLARE
        v_lead_id uuid;
        v_outcome text;
        v_duration_seconds int;
        v_notes text;
        v_call_id uuid;
      BEGIN
        v_lead_id := (payload->>'lead_id')::uuid;
        v_outcome := payload->>'outcome'; -- answered, no_answer, voicemail, etc.
        v_duration_seconds := (payload->>'duration')::int;
        v_notes := payload->>'notes';
        
        -- Log call activity
        INSERT INTO sales_activities (
          lead_id,
          sdr_id,
          activity_type,
          outcome,
          duration_seconds,
          notes
        )
        VALUES (
          v_lead_id,
          v_user_id,
          'call',
          v_outcome,
          v_duration_seconds,
          v_notes
        )
        RETURNING id INTO v_call_id;
        
        v_next_action := format(
          'Call logged. Outcome: %s. Duration: %s sec. Update lead status based on outcome.',
          v_outcome, v_duration_seconds
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'call_activity',
            'action', 'logged',
            'call_id', v_call_id,
            'outcome', v_outcome
          )
        ];
      END;
    
    -- UPDATE LEAD STATUS
    WHEN 'update_lead_status' THEN
      DECLARE
        v_lead_id uuid;
        v_new_status text;
      BEGIN
        v_lead_id := (payload->>'lead_id')::uuid;
        v_new_status := payload->>'status';
        
        UPDATE sales_leads
        SET
          status = v_new_status,
          updated_at = NOW()
        WHERE id = v_lead_id
          AND sdr_id = v_user_id;
        
        v_next_action := format('Lead %s status updated to: %s', v_lead_id, v_new_status);
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'lead_status',
            'action', 'updated',
            'lead_id', v_lead_id,
            'status', v_new_status
          )
        ];
      END;
    
    -- VIEW MY LEADS/PROSPECTS
    WHEN 'view_prospects', 'my_leads' THEN
      DECLARE
        v_leads jsonb;
      BEGIN
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', sl.id,
            'company', sl.company_name,
            'industry', sl.industry,
            'score', sl.lead_score,
            'status', sl.status,
            'created_at', sl.created_at
          )
          ORDER BY sl.created_at DESC
        )
        INTO v_leads
        FROM sales_leads sl
        WHERE sl.sdr_id = v_user_id
          AND sl.status NOT IN ('closed_lost', 'unqualified')
        LIMIT 10;
        
        v_next_action := format(
          'Showing %s active leads. Display with emoji numbers and scores.',
          COALESCE(jsonb_array_length(v_leads), 0)
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'leads_view',
            'action', 'retrieved',
            'count', COALESCE(jsonb_array_length(v_leads), 0),
            'leads', v_leads
          )
        ];
      END;
    
    -- GENERAL INQUIRY / HELP
    WHEN 'general_inquiry', 'help' THEN
      v_next_action := 'Show Sales SDR help: 1️⃣ Qualify Lead 2️⃣ My Prospects 3️⃣ Schedule Followup 4️⃣ Create Opportunity 5️⃣ Log Call';
      v_updated_entities := ARRAY[
        jsonb_build_object(
          'type', 'help',
          'action', 'shown',
          'menu_items', 5
        )
      ];
    
    ELSE
      v_next_action := format('Unknown intent type: %s. Ask user to clarify.', v_intent_type);
      v_updated_entities := ARRAY[
        jsonb_build_object(
          'type', 'error',
          'action', 'unknown_intent',
          'intent_type', v_intent_type
        )
      ];
  END CASE;

  -- 3. Build result object
  v_result := jsonb_build_object(
    'success', true,
    'intent_id', intent_id,
    'intent_type', v_intent_type,
    'user_id', v_user_id,
    'updated_entities', v_updated_entities,
    'matches', v_matches,
    'next_action', v_next_action,
    'applied_at', NOW()
  );

  -- 4. Update intent status
  UPDATE ai_agent_intents
  SET
    status = 'applied',
    applied_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'result', v_result,
      'entities_updated', array_length(v_updated_entities, 1)
    )
  WHERE id = intent_id;

  -- 5. Create match events
  IF array_length(v_matches, 1) > 0 THEN
    INSERT INTO ai_agent_match_events (
      intent_id,
      entity_type,
      entity_id,
      match_score,
      metadata
    )
    SELECT
      intent_id,
      (m->>'entity_type')::text,
      (m->>'entity_id')::uuid,
      (m->>'match_score')::numeric,
      (m->'metadata')::jsonb
    FROM unnest(v_matches) AS m;
  END IF;

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.apply_intent_sales_sdr(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.apply_intent_sales_sdr IS
'Apply sales SDR agent intents: qualify leads, schedule followups, create opportunities, log calls';

COMMIT;
