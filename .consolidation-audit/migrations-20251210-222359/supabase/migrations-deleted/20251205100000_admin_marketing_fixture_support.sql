-- Align admin marketing fixtures with live schema requirements.

BEGIN;

-- Ensure campaign targets are idempotent based on campaign + subscriber.
CREATE UNIQUE INDEX IF NOT EXISTS campaign_targets_campaign_msisdn_key
  ON public.campaign_targets (campaign_id, msisdn);

-- Enforce unique voucher codes across statuses for admin queries.
CREATE UNIQUE INDEX IF NOT EXISTS vouchers_code5_key
  ON public.vouchers (code5);

-- Provide a sequence-backed default for legacy campaign identifiers so new rows remain compatible.
CREATE SEQUENCE IF NOT EXISTS public.campaigns_legacy_id_seq;
ALTER SEQUENCE public.campaigns_legacy_id_seq OWNED BY public.campaigns.legacy_id;
ALTER TABLE public.campaigns
  ALTER COLUMN legacy_id SET DEFAULT nextval('public.campaigns_legacy_id_seq');

-- Initialize the sequence to the current maximum so new inserts keep incrementing.
SELECT setval(
  'public.campaigns_legacy_id_seq',
  COALESCE((SELECT MAX(legacy_id) FROM public.campaigns), 0)
);

-- Harden the order events sync trigger to support enum-based actor types.
CREATE OR REPLACE FUNCTION public.order_events_sync_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  has_event_type boolean := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_events'
      AND column_name = 'event_type'
  );
  has_actor_type boolean := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_events'
      AND column_name = 'actor_type'
  );
BEGIN
  IF has_event_type THEN
    IF NEW.type IS NULL AND NEW.event_type IS NOT NULL THEN
      NEW.type := NEW.event_type::text;
    ELSIF NEW.type IS NOT NULL THEN
      BEGIN
        NEW.event_type := NEW.type::order_event_type;
      EXCEPTION WHEN OTHERS THEN
        NEW.event_type := 'admin_override';
      END;
    END IF;
  END IF;

  IF has_actor_type
     AND NEW.actor_id IS NOT NULL
     AND (NEW.actor_type IS NULL OR NEW.actor_type::text = '') THEN
    NEW.actor_type := 'admin';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
