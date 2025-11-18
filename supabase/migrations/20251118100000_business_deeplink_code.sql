ALTER TABLE business
  ADD COLUMN IF NOT EXISTS deeplink_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_deeplink_code
  ON business (deeplink_code)
  WHERE deeplink_code IS NOT NULL;
