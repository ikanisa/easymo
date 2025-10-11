-- SQL assertions for security.claim_notifications()
BEGIN;
SET LOCAL search_path TO public, security;

DO $$
DECLARE
  queued_id uuid;
  locked_id uuid;
  claimed RECORD;
  attempt RECORD;
  reopened RECORD;
BEGIN
  INSERT INTO public.notifications (
    to_wa_id,
    template_name,
    notification_type,
    channel,
    status,
    payload,
    retry_count,
    created_at,
    next_attempt_at
  )
  VALUES (
    '+250780000111',
    'test_template_a',
    'test_claim_notifications',
    'template',
    'queued',
    '{}'::jsonb,
    0,
    timezone('utc', now()) - interval '10 minutes',
    NULL
  )
  RETURNING id INTO queued_id;

  INSERT INTO public.notifications (
    to_wa_id,
    template_name,
    notification_type,
    channel,
    status,
    payload,
    retry_count,
    created_at,
    locked_at,
    next_attempt_at
  )
  VALUES (
    '+250780000112',
    'test_template_b',
    'test_claim_locked',
    'template',
    'queued',
    '{}'::jsonb,
    2,
    timezone('utc', now()) - interval '8 minutes',
    timezone('utc', now()) - interval '5 minutes',
    NULL
  )
  RETURNING id INTO locked_id;

  -- First claim should lock queued_id
  SELECT * INTO claimed FROM security.claim_notifications(1);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected one notification to be claimed';
  END IF;
  IF claimed.id IS DISTINCT FROM queued_id THEN
    RAISE EXCEPTION 'Expected queued notification %, got %', queued_id, claimed.id;
  END IF;
  IF claimed.locked_at IS NULL THEN
    RAISE EXCEPTION 'Claimed notification missing locked_at timestamp';
  END IF;

  -- Second claim should yield no rows while other record remains within lock window
  SELECT * INTO attempt FROM security.claim_notifications(1);
  IF FOUND THEN
    RAISE EXCEPTION 'Expected no additional notifications while lock window active';
  END IF;

  -- Expire lock for second row and ensure it becomes claimable
  UPDATE public.notifications
     SET locked_at = timezone('utc', now()) - interval '20 minutes',
         next_attempt_at = NULL
   WHERE id = locked_id;

  SELECT * INTO reopened FROM security.claim_notifications(1);
  IF NOT FOUND OR reopened.id IS DISTINCT FROM locked_id THEN
    RAISE EXCEPTION 'Expected locked notification % to be claimed after lock expiry', locked_id;
  END IF;

  DELETE FROM public.notifications WHERE id IN (queued_id, locked_id);
END;
$$;

DO $$
BEGIN
  IF NOT has_function_privilege('service_role', 'security.claim_notifications(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role must retain execute privilege on claim_notifications';
  END IF;
  IF has_function_privilege('authenticated', 'security.claim_notifications(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated role must not execute claim_notifications';
  END IF;
  IF has_function_privilege('anon', 'security.claim_notifications(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon role must not execute claim_notifications';
  END IF;
END;
$$;

ROLLBACK;
