-- Marketplace settings per tenant
CREATE TABLE IF NOT EXISTS "MarketplaceSettings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL,
  "freeContacts" integer NOT NULL DEFAULT 30,
  "windowDays" integer NOT NULL DEFAULT 30,
  "subscriptionTokens" integer NOT NULL DEFAULT 4,
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "MarketplaceSettings_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceSettings_tenant_unique" ON "MarketplaceSettings"("tenantId");
