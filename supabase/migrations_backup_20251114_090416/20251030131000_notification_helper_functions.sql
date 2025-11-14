BEGIN;

-- ============================================================================
-- Notification Helper Functions
-- Support functions for quiet hours, opt-out checking, and notification processing
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Check if current time is within quiet hours for a contact
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_in_quiet_hours(
  p_wa_id text,
  p_check_time timestamptz DEFAULT NOW()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_quiet_start time;
  v_quiet_end time;
  v_timezone text;
  v_local_time time;
BEGIN
  -- Get contact preferences
  SELECT quiet_hours_start, quiet_hours_end, COALESCE(timezone, 'Africa/Kigali')
  INTO v_quiet_start, v_quiet_end, v_timezone
  FROM public.contact_preferences
  WHERE wa_id = p_wa_id;

  -- If no quiet hours configured, return false
  IF v_quiet_start IS NULL OR v_quiet_end IS NULL THEN
    RETURN false;
  END IF;

  -- Convert check time to contact's local timezone
  v_local_time := (p_check_time AT TIME ZONE v_timezone)::time;

  -- Check if current time is within quiet hours
  -- Handle cases where quiet hours span midnight
  IF v_quiet_start <= v_quiet_end THEN
    -- Normal case: e.g., 22:00 to 07:00 next day
    RETURN v_local_time >= v_quiet_start AND v_local_time < v_quiet_end;
  ELSE
    -- Spans midnight: e.g., 22:00 to 07:00
    RETURN v_local_time >= v_quiet_start OR v_local_time < v_quiet_end;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Check if contact has opted out
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_opted_out(p_wa_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_opted_out boolean;
BEGIN
  SELECT COALESCE(opted_out, false)
  INTO v_opted_out
  FROM public.contact_preferences
  WHERE wa_id = p_wa_id;

  RETURN COALESCE(v_opted_out, false);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Get preferred locale for a contact with fallback
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_contact_locale(
  p_wa_id text,
  p_fallback text DEFAULT 'en'
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_locale text;
BEGIN
  SELECT preferred_locale
  INTO v_locale
  FROM public.contact_preferences
  WHERE wa_id = p_wa_id;

  RETURN COALESCE(v_locale, p_fallback);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Get template by key with locale fallback
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_template_by_key(
  p_template_key text,
  p_locale text DEFAULT 'en',
  p_fallback_locale text DEFAULT 'en'
)
RETURNS TABLE (
  id uuid,
  template_name text,
  domain text,
  category text,
  variables jsonb,
  retry_policy jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Try to get template for requested locale
  RETURN QUERY
  SELECT 
    t.id,
    t.template_name,
    t.domain,
    t.category,
    t.variables,
    t.retry_policy
  FROM public.whatsapp_templates t
  WHERE t.template_key = p_template_key
    AND t.locale = p_locale
    AND t.is_active = true
  LIMIT 1;

  -- If not found, try fallback locale
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      t.id,
      t.template_name,
      t.domain,
      t.category,
      t.variables,
      t.retry_policy
    FROM public.whatsapp_templates t
    WHERE t.template_key = p_template_key
      AND t.locale = p_fallback_locale
      AND t.is_active = true
    LIMIT 1;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Calculate next retry attempt time with exponential backoff
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.calculate_next_retry(
  p_retry_count integer,
  p_base_seconds integer DEFAULT 30,
  p_max_seconds integer DEFAULT 900
)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_backoff_seconds integer;
  v_jitter_seconds integer;
BEGIN
  -- Exponential backoff: base * (2 ^ retry_count)
  v_backoff_seconds := LEAST(p_base_seconds * POWER(2, p_retry_count), p_max_seconds);
  
  -- Add jitter (up to 20% of backoff time)
  v_jitter_seconds := (RANDOM() * 0.2 * v_backoff_seconds)::integer;
  
  RETURN NOW() + ((v_backoff_seconds + v_jitter_seconds) || ' seconds')::interval;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Record notification to audit log
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_notification_event(
  p_notification_id uuid,
  p_event_type text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.notification_audit_log (
    notification_id,
    event_type,
    details
  ) VALUES (
    p_notification_id,
    p_event_type,
    p_details
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Initialize contact preferences for new WhatsApp contact
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.init_contact_preferences(
  p_wa_id text,
  p_profile_id uuid DEFAULT NULL,
  p_locale text DEFAULT 'en'
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_pref_id uuid;
BEGIN
  INSERT INTO public.contact_preferences (
    wa_id,
    profile_id,
    preferred_locale,
    opted_out,
    quiet_hours_start,
    quiet_hours_end,
    timezone
  ) VALUES (
    p_wa_id,
    p_profile_id,
    p_locale,
    false,
    '22:00'::time,  -- Default quiet hours 10 PM
    '07:00'::time,  -- to 7 AM
    'Africa/Kigali'
  )
  ON CONFLICT (wa_id) DO UPDATE SET
    profile_id = COALESCE(EXCLUDED.profile_id, contact_preferences.profile_id),
    preferred_locale = COALESCE(EXCLUDED.preferred_locale, contact_preferences.preferred_locale)
  RETURNING id INTO v_pref_id;

  RETURN v_pref_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Mark contact as opted out
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_opted_out(
  p_wa_id text,
  p_reason text DEFAULT 'user_request'
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- Ensure contact preferences exist
  PERFORM public.init_contact_preferences(p_wa_id);

  -- Mark as opted out
  UPDATE public.contact_preferences
  SET 
    opted_out = true,
    opt_out_at = NOW(),
    opt_out_reason = p_reason,
    updated_at = NOW()
  WHERE wa_id = p_wa_id;

  RETURN true;
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. Get notification queue depth by status
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_notification_queue_stats()
RETURNS TABLE (
  status text,
  count bigint,
  oldest_queued timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.status::text,
    COUNT(*) as count,
    MIN(n.created_at) as oldest_queued
  FROM public.notifications n
  GROUP BY n.status;
END;
$$;

COMMIT;
