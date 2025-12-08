-- Migration: Create Token Rewards Table
-- Created: 2025-11-23
-- Purpose: Enable token redemption functionality

BEGIN;

CREATE TABLE IF NOT EXISTS public.token_rewards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    reward_name text NOT NULL,
    reward_description text,
    cost_tokens integer NOT NULL CHECK (cost_tokens > 0),
    reward_type text NOT NULL CHECK (reward_type IN ('cash', 'discount', 'service', 'product')),
    is_active boolean DEFAULT true,
    minimum_tokens_required integer DEFAULT 2000,
    redemption_limit integer, -- NULL means unlimited
    redemptions_count integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Seed initial rewards
INSERT INTO public.token_rewards (reward_name, reward_description, cost_tokens, reward_type, minimum_tokens_required)
VALUES 
    ('Cash Out 2000', 'Redeem 2000 tokens for cash', 2000, 'cash', 2000),
    ('Cash Out 5000', 'Redeem 5000 tokens for cash', 5000, 'cash', 2000),
    ('Cash Out 10000', 'Redeem 10000 tokens for cash', 10000, 'cash', 2000),
    ('Ride Discount 10%', '10% off your next ride', 500, 'discount', 2000),
    ('Insurance Discount 5%', '5% off motor insurance', 1000, 'discount', 2000)
ON CONFLICT DO NOTHING;

-- Track redemptions
CREATE TABLE IF NOT EXISTS public.token_redemptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    reward_id uuid NOT NULL REFERENCES public.token_rewards(id) ON DELETE CASCADE,
    tokens_spent integer NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    admin_notes text,
    processed_at timestamptz,
    processed_by uuid REFERENCES public.profiles(user_id),
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_token_rewards_active ON public.token_rewards(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_token_redemptions_profile ON public.token_redemptions(profile_id);
CREATE INDEX IF NOT EXISTS idx_token_redemptions_status ON public.token_redemptions(status);

-- Enable RLS
ALTER TABLE public.token_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_redemptions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public read active rewards" ON public.token_rewards 
    FOR SELECT USING (is_active = true);

CREATE POLICY "Users can view their redemptions" ON public.token_redemptions 
    FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Users can create redemptions" ON public.token_redemptions 
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Grants
GRANT ALL ON public.token_rewards TO service_role;
GRANT SELECT ON public.token_rewards TO authenticated;
GRANT SELECT ON public.token_rewards TO anon;

GRANT ALL ON public.token_redemptions TO service_role;
GRANT SELECT, INSERT ON public.token_redemptions TO authenticated;

COMMIT;
