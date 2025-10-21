BEGIN;

DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'wallet_ledger'
    AND column_name = 'id';

  IF col_type IS DISTINCT FROM 'uuid' THEN
    ALTER TABLE public.wallet_ledger
      ALTER COLUMN id DROP DEFAULT;

    ALTER TABLE public.wallet_ledger
      ALTER COLUMN id TYPE uuid USING gen_random_uuid();

    ALTER TABLE public.wallet_ledger
      ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;
END $$;

COMMIT;
