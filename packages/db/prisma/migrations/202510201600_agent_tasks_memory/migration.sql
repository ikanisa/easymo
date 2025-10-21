-- Add AgentTask and InteractionMemory tables
DO $$ BEGIN
  CREATE TYPE "TaskType" AS ENUM ('BROKER_WHATSAPP', 'VOICE_COLD_CALL', 'SUPPORT_WHATSAPP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InteractionChannel" AS ENUM ('WHATSAPP', 'VOICE', 'EMAIL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE "AgentTask" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "contactRef" TEXT NOT NULL,
  "type" "TaskType" NOT NULL,
  "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "result" JSONB,
  "error" TEXT,
  "scheduledAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "runAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "AgentTask_tenant_status_idx" ON "AgentTask" ("tenantId", "status", "scheduledAt");

CREATE TABLE "InteractionMemory" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "contactRef" TEXT NOT NULL,
  "channel" "InteractionChannel" NOT NULL,
  "summary" JSONB NOT NULL,
  "lastInteractionAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "followUpAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "InteractionMemory_tenant_contact_channel_unique"
  ON "InteractionMemory" ("tenantId", "contactRef", "channel");
