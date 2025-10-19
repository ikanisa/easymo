-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums --------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CallDirection') THEN
    CREATE TYPE "CallDirection" AS ENUM ('inbound', 'outbound');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CallPlatform') THEN
    CREATE TYPE "CallPlatform" AS ENUM ('pstn', 'sip');
  END IF;
END$$;

-- Tables -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tenant" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "countries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "AgentConfig" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant" ("id") ON DELETE CASCADE,
  "product" TEXT NOT NULL,
  "languages" TEXT[] NOT NULL DEFAULT ARRAY['en']::TEXT[],
  "voice" TEXT NOT NULL DEFAULT 'Cedar',
  "objective" TEXT NOT NULL,
  "systemPrompt" TEXT NOT NULL,
  "tools" JSONB NOT NULL DEFAULT '[]'::JSONB,
  "policy" JSONB NOT NULL DEFAULT '[]'::JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Lead" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant" ("id") ON DELETE CASCADE,
  "phoneE164" TEXT NOT NULL,
  "name" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "optIn" BOOLEAN NOT NULL DEFAULT FALSE,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "lastContactAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Call" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant" ("id") ON DELETE CASCADE,
  "leadId" UUID REFERENCES "Lead" ("id") ON DELETE SET NULL,
  "direction" "CallDirection" NOT NULL,
  "platform" "CallPlatform" NOT NULL,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "endedAt" TIMESTAMPTZ,
  "status" TEXT,
  "recordingUrl" TEXT,
  "transcript" TEXT,
  "summary" JSONB,
  "agentMetrics" JSONB,
  "handoffTo" TEXT,
  "region" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Disposition" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "callId" UUID NOT NULL REFERENCES "Call" ("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "OptOut" (
  "phoneE164" TEXT PRIMARY KEY,
  "reason" TEXT,
  "ts" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes ------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_tenant_phone_unique"
  ON "Lead" ("tenantId", "phoneE164");
