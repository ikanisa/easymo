BEGIN;

-- Add test petrol station partner for token transfers
-- Phone: +250788767816 (for testing)

INSERT INTO public.token_partners (name, whatsapp_e164, category, is_active, metadata)
VALUES 
  ('SP Test Petrol Station', '+250788767816', 'petrol_station', true, '{"location": "Kigali", "type": "test"}'::jsonb)
ON CONFLICT (whatsapp_e164) DO UPDATE
SET 
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata;

-- Add more test partners for different categories
INSERT INTO public.token_partners (name, whatsapp_e164, category, is_active, metadata)
VALUES 
  ('Test Supermarket', '+250788000001', 'supermarket', true, '{"location": "Kigali", "type": "test"}'::jsonb),
  ('Test Restaurant', '+250788000002', 'restaurant', true, '{"location": "Musanze", "type": "test"}'::jsonb),
  ('Test Pharmacy', '+250788000003', 'pharmacy', true, '{"location": "Kigali", "type": "test"}'::jsonb)
ON CONFLICT (whatsapp_e164) DO NOTHING;

-- Add category enum check constraint (soft enforcement via check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name='token_partners' AND constraint_name='token_partners_category_check'
  ) THEN
    ALTER TABLE public.token_partners 
    ADD CONSTRAINT token_partners_category_check 
    CHECK (category IS NULL OR category IN (
      'petrol_station', 
      'supermarket', 
      'restaurant', 
      'pharmacy', 
      'retail', 
      'services',
      'utility',
      'transport',
      'accommodation'
    ));
  END IF;
END $$;

-- Add index for category filtering
CREATE INDEX IF NOT EXISTS idx_token_partners_category ON public.token_partners(category, is_active);

-- Create view for partner statistics
CREATE OR REPLACE VIEW public.token_partner_stats AS
SELECT 
  tp.id,
  tp.name,
  tp.category,
  tp.whatsapp_e164,
  tp.is_active,
  COUNT(DISTINCT wt.id) AS total_transactions,
  COALESCE(SUM(CASE WHEN p.user_id = wt.recipient_profile THEN wt.amount_tokens ELSE 0 END), 0) AS total_tokens_received,
  COALESCE(AVG(CASE WHEN p.user_id = wt.recipient_profile THEN wt.amount_tokens ELSE NULL END), 0) AS avg_transaction_size,
  MAX(wt.created_at) AS last_transaction_at
FROM public.token_partners tp
LEFT JOIN public.profiles p ON p.whatsapp_e164 = tp.whatsapp_e164
LEFT JOIN public.wallet_transfers wt ON wt.recipient_profile = p.user_id
GROUP BY tp.id, tp.name, tp.category, tp.whatsapp_e164, tp.is_active;

COMMENT ON VIEW public.token_partner_stats IS 'Partner statistics: transactions and token volumes';

-- Grant access to view
GRANT SELECT ON public.token_partner_stats TO service_role, authenticated;

COMMIT;
