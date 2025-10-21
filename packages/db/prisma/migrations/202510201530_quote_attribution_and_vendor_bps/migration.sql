-- Additive: Quote attribution fields and vendor commission bps
DO $$ BEGIN
  CREATE TYPE "AttributionType" AS ENUM ('agent','endorser','ad','unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Quote"
  ADD COLUMN IF NOT EXISTS "attributionType" "AttributionType",
  ADD COLUMN IF NOT EXISTS "attributionEntityId" TEXT;

ALTER TABLE "VendorProfile"
  ADD COLUMN IF NOT EXISTS "commissionAgentBps" INTEGER,
  ADD COLUMN IF NOT EXISTS "commissionEndorserBps" INTEGER,
  ADD COLUMN IF NOT EXISTS "commissionBase" TEXT DEFAULT 'gross';

