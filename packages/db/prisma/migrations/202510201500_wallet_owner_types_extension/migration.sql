DO $$ BEGIN
  ALTER TYPE "WalletOwnerType" ADD VALUE IF NOT EXISTS 'agent';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "WalletOwnerType" ADD VALUE IF NOT EXISTS 'endorser';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

