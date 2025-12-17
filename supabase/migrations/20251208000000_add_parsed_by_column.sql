-- Add parsed_by column to track which AI parser processed each SMS
-- Values: 'openai' (primary), 'gemini' (fallback), 'regex' (final fallback)

BEGIN;

DO $$
BEGIN
  -- Only run if the table exists in this project.
  IF to_regclass('public.vendor_sms_transactions') IS NOT NULL THEN

    EXECUTE 'ALTER TABLE public.vendor_sms_transactions
             ADD COLUMN IF NOT EXISTS parsed_by TEXT';

    EXECUTE 'ALTER TABLE public.vendor_sms_transactions
             DROP CONSTRAINT IF EXISTS vendor_sms_transactions_parsed_by_check';

    EXECUTE 'ALTER TABLE public.vendor_sms_transactions
             ADD CONSTRAINT vendor_sms_transactions_parsed_by_check
             CHECK (parsed_by IS NULL OR parsed_by IN (''openai'', ''gemini'', ''regex''))';

    EXECUTE 'COMMENT ON COLUMN public.vendor_sms_transactions.parsed_by IS
             ''Which parser processed this SMS: openai (primary), gemini (fallback), or regex (final fallback)''';

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_vendor_txns_parsed_by
             ON public.vendor_sms_transactions(parsed_by)';

    EXECUTE 'UPDATE public.vendor_sms_transactions
             SET parsed_by = ''regex''
             WHERE parsed_by IS NULL';

  END IF;
END $$;

COMMIT;
