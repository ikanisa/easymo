-- ============================================================================
-- Marketplace Updates - Fix existing tables and add missing columns
-- ============================================================================

BEGIN;

-- Add country_code column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'marketplace_listings' AND column_name = 'country_code'
  ) THEN
    ALTER TABLE marketplace_listings ADD COLUMN country_code TEXT DEFAULT 'RW';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'marketplace_buyer_intents' AND column_name = 'country_code'
  ) THEN
    ALTER TABLE marketplace_buyer_intents ADD COLUMN country_code TEXT DEFAULT 'RW';
  END IF;
END $$;

-- Create transactions table if not exists
CREATE TABLE IF NOT EXISTS marketplace_transactions (
  id TEXT PRIMARY KEY,
  listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL,
  buyer_phone TEXT NOT NULL,
  seller_phone TEXT NOT NULL,
  agreed_price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'RWF',
  payment_method TEXT,
  payment_reference TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'initiated', 'success', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_listings_country ON marketplace_listings(country_code);
CREATE INDEX IF NOT EXISTS idx_buyer_intents_country ON marketplace_buyer_intents(country_code);
CREATE INDEX IF NOT EXISTS idx_transactions_listing ON marketplace_transactions(listing_id);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON marketplace_transactions(buyer_phone);
CREATE INDEX IF NOT EXISTS idx_transactions_seller ON marketplace_transactions(seller_phone);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON marketplace_transactions(status);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON marketplace_transactions TO anon, authenticated;

COMMIT;
