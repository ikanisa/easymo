-- Additive migration: purchase confirmations and settlement timestamps
ALTER TABLE "Purchase"
  ADD COLUMN IF NOT EXISTS "vendorConfirmedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "buyerConfirmedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMPTZ;

-- Attribution evidence and disputes tables
CREATE TABLE IF NOT EXISTS "AttributionEvidence" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "quoteId" UUID NOT NULL REFERENCES "Quote"("id") ON DELETE CASCADE,
  "artifacts" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Dispute" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "quoteId" UUID NOT NULL REFERENCES "Quote"("id") ON DELETE CASCADE,
  "reason" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
