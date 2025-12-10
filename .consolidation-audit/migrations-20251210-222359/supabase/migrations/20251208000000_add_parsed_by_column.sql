-- Add parsed_by column to track which AI parser processed each SMS
-- Values: 'openai' (primary), 'gemini' (fallback), 'regex' (final fallback)

BEGIN;

-- Add parsed_by column
ALTER TABLE public.vendor_sms_transactions
ADD COLUMN IF NOT EXISTS parsed_by TEXT 
CHECK (parsed_by IS NULL OR parsed_by IN ('openai', 'gemini', 'regex'));

-- Add comment
COMMENT ON COLUMN public.vendor_sms_transactions.parsed_by IS 
'Which parser processed this SMS: openai (primary), gemini (fallback), or regex (final fallback)';

-- Create index for filtering by parser
CREATE INDEX IF NOT EXISTS idx_vendor_txns_parsed_by 
ON public.vendor_sms_transactions(parsed_by);

-- Update existing records to 'regex' since they were parsed before AI integration
UPDATE public.vendor_sms_transactions 
SET parsed_by = 'regex' 
WHERE parsed_by IS NULL;

COMMIT;
