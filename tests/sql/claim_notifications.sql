\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;
SET LOCAL search_path TO public, security;

SELECT plan(9);

CREATE TEMP TABLE tmp_notifications(kind text PRIMARY KEY, id uuid);

WITH queued AS (
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
  RETURNING id
)
INSERT INTO tmp_notifications
SELECT 'queued', id FROM queued;

WITH locked AS (
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
  RETURNING id
)
INSERT INTO tmp_notifications
SELECT 'locked', id FROM locked;

CREATE TEMP TABLE claimed AS
SELECT *
  FROM security.claim_notifications(1);

SELECT is(
  (SELECT count(*) FROM claimed),
  1::bigint,
  'claims exactly one notification when a queued row is available'
);

SELECT is(
  (SELECT id FROM claimed),
  (SELECT id FROM tmp_notifications WHERE kind = 'queued'),
  'returns the queued notification first'
);

SELECT isnt_null(
  (SELECT locked_at FROM claimed),
  'sets locked_at timestamp on the claimed notification'
);

SELECT is(
  (SELECT count(*) FROM security.claim_notifications(1)),
  0::bigint,
  'does not claim additional notifications while the lock window is active'
);

UPDATE public.notifications
   SET locked_at = timezone('utc', now()) - interval '20 minutes',
       next_attempt_at = NULL
 WHERE id = (SELECT id FROM tmp_notifications WHERE kind = 'locked');

CREATE TEMP TABLE reopened AS
SELECT *
  FROM security.claim_notifications(1);

SELECT is(
  (SELECT count(*) FROM reopened),
  1::bigint,
  'reclaims the locked notification after the lock expires'
);

SELECT is(
  (SELECT id FROM reopened),
  (SELECT id FROM tmp_notifications WHERE kind = 'locked'),
  'returns the previously locked notification after expiry'
);

SELECT ok(
  has_function_privilege('service_role', 'security.claim_notifications(integer)', 'EXECUTE'),
  'service_role retains EXECUTE on security.claim_notifications'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'security.claim_notifications(integer)', 'EXECUTE'),
  'authenticated role cannot execute security.claim_notifications'
);

SELECT ok(
  NOT has_function_privilege('anon', 'security.claim_notifications(integer)', 'EXECUTE'),
  'anon role cannot execute security.claim_notifications'
);

SELECT * FROM finish();

ROLLBACK;
