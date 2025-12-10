-- Migration: Add missing columns to all tables
-- Created: 2025-11-23
-- Purpose: Ensure all tables have required columns referenced in code

BEGIN;

-- ===== PROFILES TABLE =====
-- Add metadata column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'metadata') THEN
        ALTER TABLE public.profiles ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Add display_name column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'display_name') THEN
        ALTER TABLE public.profiles ADD COLUMN display_name text;
    END IF;
END $$;

-- ===== WALLET_TRANSFERS TABLE =====
-- Add completed_at column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'wallet_transfers' AND column_name = 'completed_at') THEN
        ALTER TABLE public.wallet_transfers ADD COLUMN completed_at timestamptz;
    END IF;
END $$;

-- ===== REFERRAL_LINKS TABLE =====
-- Add updated_at column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'referral_links' AND column_name = 'updated_at') THEN
        ALTER TABLE public.referral_links ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
END $$;

-- Add clicks_count column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'referral_links' AND column_name = 'clicks_count') THEN
        ALTER TABLE public.referral_links ADD COLUMN clicks_count integer DEFAULT 0;
    END IF;
END $$;

-- Add signups_count column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'referral_links' AND column_name = 'signups_count') THEN
        ALTER TABLE public.referral_links ADD COLUMN signups_count integer DEFAULT 0;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_metadata ON public.profiles USING gin(metadata) WHERE metadata IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referral_links_clicks ON public.referral_links(clicks_count) WHERE clicks_count > 0;
CREATE INDEX IF NOT EXISTS idx_referral_links_signups ON public.referral_links(signups_count) WHERE signups_count > 0;

COMMIT;
