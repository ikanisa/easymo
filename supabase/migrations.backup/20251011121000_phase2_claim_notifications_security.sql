-- Phase 2: move claim_notifications into security schema with tighter grants
BEGIN;

CREATE SCHEMA IF NOT EXISTS security AUTHORIZATION postgres;
COMMENT ON SCHEMA security IS 'Privileged routines requiring definer semantics.';

ALTER FUNCTION public.claim_notifications(integer) SET SCHEMA security;

REVOKE ALL ON FUNCTION security.claim_notifications(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION security.claim_notifications(integer) FROM anon;
REVOKE ALL ON FUNCTION security.claim_notifications(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION security.claim_notifications(integer) TO service_role;

COMMENT ON FUNCTION security.claim_notifications(integer) IS 'Atomically locks and returns up to _limit queued notifications for delivery.';

COMMIT;
