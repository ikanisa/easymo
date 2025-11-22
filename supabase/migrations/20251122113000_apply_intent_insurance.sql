-- =====================================================================
-- APPLY INTENT: INSURANCE AGENT
-- =====================================================================
-- Domain-specific intent application for Insurance Agent
-- Called by agent framework after intent is parsed
--
-- FEATURES:
-- - Submit insurance documents (OCR processed)
-- - Get/renew insurance quotes
-- - Track policy status
-- - Manage vehicle/property insurance
-- - Handle claims
-- - Connect to insurers
--
-- INTENT TYPES SUPPORTED:
-- - submit_documents, upload_docs: Submit insurance documents
-- - get_quote, request_quote: Request insurance quote
-- - renew_policy: Renew existing policy
-- - file_claim: File insurance claim
-- - check_policy_status, my_policies: View policy status
-- - update_vehicle_info: Update vehicle information
-- - general_inquiry, help: Show help information
--
-- Created: 2025-11-22 (Agent Refactor - Phase 1)
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_intent_insurance(
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
    
    -- SUBMIT INSURANCE DOCUMENTS
    WHEN 'submit_documents', 'upload_docs' THEN
      DECLARE
        v_document_id uuid;
        v_document_type text;
        v_document_url text;
        v_vehicle_id uuid;
        v_ocr_status text;
      BEGIN
        v_document_type := payload->>'document_type'; -- license, registration, etc.
        v_document_url := payload->>'document_url';
        v_vehicle_id := (payload->>'vehicle_id')::uuid;
        v_ocr_status := 'pending';
        
        -- Create document record
        INSERT INTO insurance_documents (
          user_id,
          vehicle_id,
          document_type,
          document_url,
          ocr_status,
          status
        )
        VALUES (
          v_user_id,
          v_vehicle_id,
          v_document_type,
          v_document_url,
          v_ocr_status,
          'pending_review'
        )
        RETURNING id INTO v_document_id;
        
        v_next_action := format(
          'Document uploaded! Type: %s. OCR processing in progress. Will notify when ready.',
          v_document_type
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'insurance_document',
            'action', 'uploaded',
            'document_id', v_document_id,
            'document_type', v_document_type,
            'vehicle_id', v_vehicle_id
          )
        ];
      END;
    
    -- GET INSURANCE QUOTE
    WHEN 'get_quote', 'request_quote' THEN
      DECLARE
        v_quote_id uuid;
        v_vehicle_id uuid;
        v_insurance_type text;
        v_coverage_level text;
        v_vehicle_value numeric;
        v_quote_amount numeric;
      BEGIN
        v_vehicle_id := (payload->>'vehicle_id')::uuid;
        v_insurance_type := COALESCE(payload->>'insurance_type', 'comprehensive');
        v_coverage_level := COALESCE(payload->>'coverage_level', 'standard');
        v_vehicle_value := (payload->>'vehicle_value')::numeric;
        
        -- Calculate basic quote (simplified)
        v_quote_amount := CASE v_insurance_type
          WHEN 'comprehensive' THEN v_vehicle_value * 0.05
          WHEN 'third_party' THEN v_vehicle_value * 0.02
          ELSE v_vehicle_value * 0.03
        END;
        
        -- Create quote record
        INSERT INTO insurance_quotes (
          user_id,
          vehicle_id,
          insurance_type,
          coverage_level,
          vehicle_value,
          quote_amount,
          currency,
          valid_until,
          status
        )
        VALUES (
          v_user_id,
          v_vehicle_id,
          v_insurance_type,
          v_coverage_level,
          v_vehicle_value,
          v_quote_amount,
          'RWF',
          NOW() + INTERVAL '30 days',
          'active'
        )
        RETURNING id INTO v_quote_id;
        
        v_next_action := format(
          'Quote generated! %s coverage: %s RWF/year. Valid for 30 days. Show payment options.',
          v_insurance_type, v_quote_amount
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'insurance_quote',
            'action', 'generated',
            'quote_id', v_quote_id,
            'amount', v_quote_amount,
            'insurance_type', v_insurance_type
          )
        ];
        
        v_matches := ARRAY[
          jsonb_build_object(
            'entity_type', 'insurance_quote',
            'entity_id', v_quote_id,
            'match_score', 0.9,
            'metadata', jsonb_build_object(
              'amount', v_quote_amount,
              'type', v_insurance_type
            )
          )
        ];
      END;
    
    -- RENEW POLICY
    WHEN 'renew_policy' THEN
      DECLARE
        v_policy_id uuid;
        v_renewal_id uuid;
        v_new_expiry_date date;
      BEGIN
        v_policy_id := (payload->>'policy_id')::uuid;
        v_new_expiry_date := CURRENT_DATE + INTERVAL '1 year';
        
        -- Create renewal record
        INSERT INTO insurance_renewals (
          policy_id,
          user_id,
          renewal_date,
          new_expiry_date,
          status
        )
        VALUES (
          v_policy_id,
          v_user_id,
          CURRENT_DATE,
          v_new_expiry_date,
          'pending_payment'
        )
        RETURNING id INTO v_renewal_id;
        
        v_next_action := format(
          'Renewal initiated for policy %s. New expiry: %s. Awaiting payment.',
          v_policy_id, v_new_expiry_date
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'insurance_renewal',
            'action', 'initiated',
            'renewal_id', v_renewal_id,
            'policy_id', v_policy_id,
            'new_expiry', v_new_expiry_date
          )
        ];
      END;
    
    -- FILE INSURANCE CLAIM
    WHEN 'file_claim' THEN
      DECLARE
        v_claim_id uuid;
        v_policy_id uuid;
        v_incident_date date;
        v_claim_type text;
        v_description text;
        v_estimated_amount numeric;
      BEGIN
        v_policy_id := (payload->>'policy_id')::uuid;
        v_incident_date := (payload->>'incident_date')::date;
        v_claim_type := payload->>'claim_type'; -- accident, theft, damage
        v_description := payload->>'description';
        v_estimated_amount := (payload->>'estimated_amount')::numeric;
        
        -- Create claim
        INSERT INTO insurance_claims (
          policy_id,
          user_id,
          incident_date,
          claim_type,
          description,
          estimated_amount,
          currency,
          status
        )
        VALUES (
          v_policy_id,
          v_user_id,
          v_incident_date,
          v_claim_type,
          v_description,
          v_estimated_amount,
          'RWF',
          'submitted'
        )
        RETURNING id INTO v_claim_id;
        
        v_next_action := format(
          'Claim filed! Ref: %s. Type: %s. Estimated: %s RWF. Insurer will review within 48h.',
          v_claim_id, v_claim_type, v_estimated_amount
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'insurance_claim',
            'action', 'filed',
            'claim_id', v_claim_id,
            'claim_type', v_claim_type,
            'amount', v_estimated_amount
          )
        ];
      END;
    
    -- CHECK POLICY STATUS / VIEW MY POLICIES
    WHEN 'check_policy_status', 'my_policies', 'view_policies' THEN
      DECLARE
        v_policies jsonb;
      BEGIN
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ip.id,
            'policy_number', ip.policy_number,
            'insurance_type', ip.insurance_type,
            'status', ip.status,
            'premium', ip.premium_amount,
            'currency', ip.currency,
            'start_date', ip.start_date,
            'expiry_date', ip.expiry_date,
            'vehicle_id', ip.vehicle_id
          )
          ORDER BY ip.expiry_date DESC
        )
        INTO v_policies
        FROM insurance_policies ip
        WHERE ip.user_id = v_user_id
          AND ip.status IN ('active', 'expiring_soon')
        LIMIT 10;
        
        v_next_action := format(
          'Showing %s policies. Display with expiry dates and renewal options.',
          COALESCE(jsonb_array_length(v_policies), 0)
        );
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'policies_view',
            'action', 'retrieved',
            'count', COALESCE(jsonb_array_length(v_policies), 0),
            'policies', v_policies
          )
        ];
      END;
    
    -- UPDATE VEHICLE INFORMATION
    WHEN 'update_vehicle_info' THEN
      DECLARE
        v_vehicle_id uuid;
        v_make text;
        v_model text;
        v_year int;
        v_plate_number text;
      BEGIN
        v_vehicle_id := (payload->>'vehicle_id')::uuid;
        v_make := payload->>'make';
        v_model := payload->>'model';
        v_year := (payload->>'year')::int;
        v_plate_number := payload->>'plate_number';
        
        -- Update vehicle (assuming vehicles table)
        UPDATE vehicles
        SET
          make = COALESCE(v_make, make),
          model = COALESCE(v_model, model),
          year = COALESCE(v_year, year),
          plate_number = COALESCE(v_plate_number, plate_number),
          updated_at = NOW()
        WHERE id = v_vehicle_id
          AND owner_id = v_user_id;
        
        v_next_action := format('Vehicle %s information updated.', v_vehicle_id);
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'vehicle',
            'action', 'updated',
            'vehicle_id', v_vehicle_id
          )
        ];
      END;
    
    -- GENERAL INQUIRY / HELP
    WHEN 'general_inquiry', 'help' THEN
      v_next_action := 'Show Insurance help: 1️⃣ Get Quote 2️⃣ My Policies 3️⃣ Renew Policy 4️⃣ File Claim 5️⃣ Upload Documents';
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
GRANT EXECUTE ON FUNCTION public.apply_intent_insurance(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.apply_intent_insurance IS
'Apply insurance agent intents: submit documents, get quotes, renew policies, file claims, manage vehicles';

COMMIT;
