-- Migration: Create Referral Links Table
-- Created: 2025-11-23
-- Purpose: Support referral link generation for share functionality

BEGIN;

CREATE TABLE IF NOT EXISTS public.referral_links (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    code text NOT NULL UNIQUE,
    short_url text,
    active boolean DEFAULT true,
    clicks_count integer DEFAULT 0,
    signups_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referral_links_user ON public.referral_links(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_links_code ON public.referral_links(code);
CREATE INDEX IF NOT EXISTS idx_referral_links_active ON public.referral_links(active) WHERE active = true;

-- Enable RLS
ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their referral links" ON public.referral_links 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their referral links" ON public.referral_links 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their referral links" ON public.referral_links 
    FOR UPDATE USING (auth.uid() = user_id);

-- Grants
GRANT ALL ON public.referral_links TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.referral_links TO authenticated;

-- Function to track referral clicks
CREATE OR REPLACE FUNCTION public.track_referral_click(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.referral_links
    SET clicks_count = clicks_count + 1,
        updated_at = now()
    WHERE code = p_code AND active = true;
    
    RETURN FOUND;
END;
$$;

-- Function to track referral signup
CREATE OR REPLACE FUNCTION public.track_referral_signup(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.referral_links
    SET signups_count = signups_count + 1,
        updated_at = now()
    WHERE code = p_code AND active = true;
    
    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_referral_click(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.track_referral_click(text) TO anon;
GRANT EXECUTE ON FUNCTION public.track_referral_signup(text) TO service_role;

COMMIT;
