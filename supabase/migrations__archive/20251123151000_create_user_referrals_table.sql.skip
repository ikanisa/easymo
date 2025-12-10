-- Migration: Create User Referrals Table
-- Created: 2025-11-23
-- Purpose: Track referral system and rewards

BEGIN;

-- Add referral columns to profiles if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'referral_code') THEN
        ALTER TABLE public.profiles ADD COLUMN referral_code text UNIQUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'referred_by') THEN
        ALTER TABLE public.profiles ADD COLUMN referred_by uuid REFERENCES public.profiles(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'referral_count') THEN
        ALTER TABLE public.profiles ADD COLUMN referral_count integer DEFAULT 0;
    END IF;
END $$;

-- Create index on referral_code
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);

-- Track individual referrals
CREATE TABLE IF NOT EXISTS public.user_referrals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    referred_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    referral_code text NOT NULL,
    tokens_awarded integer DEFAULT 10,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    completed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    UNIQUE(referrer_id, referred_id)
);

-- Referral rewards tracking
CREATE TABLE IF NOT EXISTS public.referral_rewards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    referral_id uuid NOT NULL REFERENCES public.user_referrals(id) ON DELETE CASCADE,
    tokens_earned integer NOT NULL DEFAULT 10,
    reward_type text DEFAULT 'signup' CHECK (reward_type IN ('signup', 'first_transaction', 'bonus')),
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_referrals_referrer ON public.user_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_user_referrals_referred ON public.user_referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_user_referrals_code ON public.user_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_user_referrals_status ON public.user_referrals(status);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_profile ON public.referral_rewards(profile_id);

-- Enable RLS
ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their referrals" ON public.user_referrals 
    FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Users can view their rewards" ON public.referral_rewards 
    FOR SELECT USING (auth.uid() = profile_id);

-- Grants
GRANT ALL ON public.user_referrals TO service_role;
GRANT SELECT ON public.user_referrals TO authenticated;

GRANT ALL ON public.referral_rewards TO service_role;
GRANT SELECT ON public.referral_rewards TO authenticated;

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code(p_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code text;
    v_exists boolean;
    v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    v_hash text;
    v_attempts integer := 0;
BEGIN
    -- Try to generate unique code (max 10 attempts)
    LOOP
        v_hash := encode(digest(p_profile_id::text || clock_timestamp()::text, 'sha256'), 'hex');
        v_code := '';
        
        FOR i IN 1..6 LOOP
            v_code := v_code || substring(v_chars, (get_byte(decode(v_hash, 'hex'), i) % 32) + 1, 1);
        END LOOP;
        
        -- Check if code exists
        SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = v_code) INTO v_exists;
        
        EXIT WHEN NOT v_exists OR v_attempts >= 10;
        v_attempts := v_attempts + 1;
    END LOOP;
    
    IF v_exists THEN
        RAISE EXCEPTION 'Could not generate unique referral code';
    END IF;
    
    RETURN v_code;
END;
$$;

-- Function to process referral
CREATE OR REPLACE FUNCTION public.process_referral(p_referral_code text, p_new_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_referrer_id uuid;
    v_referral_id uuid;
BEGIN
    -- Find referrer by code
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE referral_code = p_referral_code;
    
    IF v_referrer_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Prevent self-referral
    IF v_referrer_id = p_new_user_id THEN
        RETURN false;
    END IF;
    
    -- Update referred user
    UPDATE public.profiles
    SET referred_by = v_referrer_id
    WHERE id = p_new_user_id AND referred_by IS NULL;
    
    -- Create referral record
    INSERT INTO public.user_referrals (referrer_id, referred_id, referral_code, status)
    VALUES (v_referrer_id, p_new_user_id, p_referral_code, 'completed')
    RETURNING id INTO v_referral_id;
    
    -- Award tokens to referrer
    INSERT INTO public.wallet_entries (profile_id, amount_tokens, entry_type, description, metadata)
    VALUES (
        v_referrer_id, 
        10, 
        'referral_bonus', 
        'Referral reward for new user signup',
        jsonb_build_object('referral_id', v_referral_id, 'referred_user', p_new_user_id)
    );
    
    -- Create reward record
    INSERT INTO public.referral_rewards (profile_id, referral_id, tokens_earned, reward_type)
    VALUES (v_referrer_id, v_referral_id, 10, 'signup');
    
    -- Update referrer count
    UPDATE public.profiles
    SET referral_count = referral_count + 1
    WHERE id = v_referrer_id;
    
    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_referral_code(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_referral(text, uuid) TO service_role;

COMMIT;
