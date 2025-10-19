-- Phase 5 wallet and marketplace tables

DO $$ BEGIN
  CREATE TYPE "WalletOwnerType" AS ENUM ('vendor', 'buyer', 'platform', 'commission');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "WalletEntryDirection" AS ENUM ('debit', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "IntentStatus" AS ENUM ('pending', 'matched', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "QuoteStatus" AS ENUM ('pending', 'accepted', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "PurchaseStatus" AS ENUM ('pending', 'completed', 'cancelled', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE "WalletAccount" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "ownerType" "WalletOwnerType" NOT NULL,
  "ownerId" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "balance" NUMERIC(18,4) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  "updatedAt" TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX "WalletAccount_tenant_idx" ON "WalletAccount"("tenantId");

CREATE TABLE "WalletTransaction" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "reference" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX "WalletTransaction_tenant_idx" ON "WalletTransaction"("tenantId");

CREATE TABLE "WalletEntry" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "transactionId" UUID NOT NULL REFERENCES "WalletTransaction"("id") ON DELETE CASCADE,
  "accountId" UUID NOT NULL REFERENCES "WalletAccount"("id") ON DELETE CASCADE,
  "amount" NUMERIC(18,4) NOT NULL,
  "direction" "WalletEntryDirection" NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX "WalletEntry_account_idx" ON "WalletEntry"("accountId");
CREATE INDEX "WalletEntry_transaction_idx" ON "WalletEntry"("transactionId");

CREATE TABLE "CommissionSchedule" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "product" TEXT NOT NULL,
  "rate" NUMERIC(5,4) NOT NULL,
  "flatFee" NUMERIC(18,4),
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "effectiveAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "CommissionSchedule_tenant_idx" ON "CommissionSchedule"("tenantId", "product") WHERE "active" = TRUE;

CREATE TABLE "VendorProfile" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "categories" TEXT[] NOT NULL,
  "rating" NUMERIC(4,2),
  "fulfilmentRate" NUMERIC(5,4),
  "avgResponseMs" INTEGER,
  "totalTrips" INTEGER NOT NULL DEFAULT 0,
  "walletAccountId" UUID REFERENCES "WalletAccount"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "VendorProfile_tenant_region_idx" ON "VendorProfile"("tenantId", "region");

CREATE TABLE "BuyerProfile" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "segment" TEXT,
  "walletAccountId" UUID REFERENCES "WalletAccount"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "BuyerProfile_tenant_segment_idx" ON "BuyerProfile"("tenantId", "segment");

CREATE TABLE "Intent" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "buyerId" UUID NOT NULL REFERENCES "BuyerProfile"("id") ON DELETE CASCADE,
  "channel" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "IntentStatus" NOT NULL DEFAULT 'pending',
  "expiresAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "Intent_tenant_status_idx" ON "Intent"("tenantId", "status");

CREATE TABLE "Quote" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "intentId" UUID NOT NULL REFERENCES "Intent"("id") ON DELETE CASCADE,
  "vendorId" UUID NOT NULL REFERENCES "VendorProfile"("id") ON DELETE CASCADE,
  "price" NUMERIC(18,4) NOT NULL,
  "currency" TEXT NOT NULL,
  "etaMinutes" INTEGER,
  "status" "QuoteStatus" NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "acceptedAt" TIMESTAMPTZ
);

CREATE INDEX "Quote_intent_status_idx" ON "Quote"("intentId", "status");

CREATE TABLE "Purchase" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "quoteId" UUID NOT NULL REFERENCES "Quote"("id") ON DELETE CASCADE,
  "transactionId" UUID,
  "status" "PurchaseStatus" NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "fulfilledAt" TIMESTAMPTZ
);
