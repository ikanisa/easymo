BEGIN;

-- ============================================================================
-- EASYMO SIMPLIFIED PROFILE SCHEMA
-- Generated: 2025-12-14T00:00:00Z
-- Purpose: Replace complex profile/wallet system with simple users table
-- ============================================================================

-- ============================================================================
-- 1. DROP OLD TABLES
-- ============================================================================

-- Drop wallet-related tables
DROP TABLE IF EXISTS public.wallet_notification_queue CASCADE;
DROP TABLE IF EXISTS public.wallet_transactions CASCADE;
DROP TABLE IF EXISTS public.wallet_transactions_ibimina CASCADE;
DROP TABLE IF EXISTS public.wallet_accounts CASCADE;
DROP TABLE IF EXISTS public.wallet_accounts_ibimina CASCADE;
DROP TABLE IF EXISTS public.wallet_ledger CASCADE;
DROP TABLE IF EXISTS public.wallet_balance CASCADE;
DROP TABLE IF EXISTS public.wallet_earn_actions CASCADE;
DROP TABLE IF EXISTS public.wallet_promoters CASCADE;

-- Drop referral-related tables
DROP TABLE IF EXISTS public.referral_ledger CASCADE;
DROP TABLE IF EXISTS public.referral_attributions CASCADE;
DROP TABLE IF EXISTS public.promo_rules CASCADE;

-- Drop profile-related tables
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.whatsapp_users CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public."BuyerProfile" CASCADE;
DROP TABLE IF EXISTS public."VendorProfile" CASCADE;
DROP TABLE IF EXISTS public.worker_profiles CASCADE;

-- Drop menu-related tables
DROP TABLE IF EXISTS public.profile_menu_items CASCADE;
DROP TABLE IF EXISTS public.whatsapp_home_menu_items CASCADE;
DROP TABLE IF EXISTS public.profile_assets CASCADE;

-- ============================================================================
-- 2. CREATE SIMPLE USERS TABLE
-- ============================================================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity (WhatsApp is primary)
  phone TEXT NOT NULL UNIQUE,  -- E.164 format: +250788123456
  name TEXT,
  
  -- Preferences
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'fr', 'rw')),
  country TEXT NOT NULL DEFAULT 'RW' CHECK (country IN ('RW', 'BI', 'CD', 'TZ')),
  
  -- Simple wallet (tokens only - no complex ledger)
  tokens INTEGER NOT NULL DEFAULT 0 CHECK (tokens >= 0),
  
  -- Referral
  ref_code TEXT UNIQUE,  -- Auto-generated 6-char code
  referred_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ
);

-- Add indexes for performance
CREATE INDEX idx_users_phone ON public.users(phone);
CREATE INDEX idx_users_ref_code ON public.users(ref_code) WHERE ref_code IS NOT NULL;
CREATE INDEX idx_users_referred_by ON public.users(referred_by) WHERE referred_by IS NOT NULL;
CREATE INDEX idx_users_created_at ON public.users(created_at DESC);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS policies: Users can view their own profile, service role can manage all
CREATE POLICY "users_view_own_profile" ON public.users 
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "service_role_manage_users" ON public.users 
  FOR ALL USING (auth.role() = 'service_role');

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON public.users 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 3. HELPER FUNCTIONS
-- ============================================================================

-- Generate unique 6-character referral code
CREATE OR REPLACE FUNCTION public.generate_ref_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude similar: 0O, 1I
  v_code TEXT;
  v_attempts INTEGER := 0;
  v_max_attempts INTEGER := 10;
BEGIN
  LOOP
    -- Generate 6-char code
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;
    
    -- Check if code is unique
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE ref_code = v_code) THEN
      RETURN v_code;
    END IF;
    
    v_attempts := v_attempts + 1;
    IF v_attempts >= v_max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique referral code after % attempts', v_max_attempts;
    END IF;
  END LOOP;
END;
$$;

-- Get or create user by phone number
CREATE OR REPLACE FUNCTION public.get_or_create_user(
  p_phone TEXT,
  p_name TEXT DEFAULT NULL,
  p_language TEXT DEFAULT 'en',
  p_country TEXT DEFAULT 'RW'
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user public.users;
  v_ref_code TEXT;
BEGIN
  -- Normalize phone number (ensure E.164 format)
  p_phone := TRIM(p_phone);
  IF NOT p_phone ~ '^\+\d{8,15}$' THEN
    RAISE EXCEPTION 'Invalid phone number format. Expected E.164 format: %', p_phone;
  END IF;
  
  -- Try to find existing user
  SELECT * INTO v_user FROM public.users WHERE phone = p_phone;
  
  IF FOUND THEN
    -- Update last_seen_at
    UPDATE public.users 
    SET last_seen_at = NOW()
    WHERE id = v_user.id;
    
    RETURN v_user;
  END IF;
  
  -- Create new user
  v_ref_code := public.generate_ref_code();
  
  INSERT INTO public.users (phone, name, language, country, ref_code, last_seen_at)
  VALUES (p_phone, p_name, p_language, p_country, v_ref_code, NOW())
  RETURNING * INTO v_user;
  
  RETURN v_user;
END;
$$;

-- Add tokens to user account
CREATE OR REPLACE FUNCTION public.add_tokens(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive: %', p_amount;
  END IF;
  
  -- Add tokens
  UPDATE public.users
  SET tokens = tokens + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id
  RETURNING tokens INTO v_new_balance;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;
  
  -- Log the transaction (could be extended to a separate audit table if needed)
  -- For now, we rely on application-level logging
  
  RETURN TRUE;
END;
$$;

-- Use tokens from user account
CREATE OR REPLACE FUNCTION public.use_tokens(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive: %', p_amount;
  END IF;
  
  -- Check current balance
  SELECT tokens INTO v_current_balance
  FROM public.users
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;
  
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient tokens. Current balance: %, requested: %', v_current_balance, p_amount;
  END IF;
  
  -- Deduct tokens
  UPDATE public.users
  SET tokens = tokens - p_amount,
      updated_at = NOW()
  WHERE id = p_user_id
  RETURNING tokens INTO v_new_balance;
  
  RETURN TRUE;
END;
$$;

-- ============================================================================
-- 4. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.users IS 'Simplified user table - single source of truth for user profiles';
COMMENT ON COLUMN public.users.phone IS 'WhatsApp phone number in E.164 format (e.g., +250788123456)';
COMMENT ON COLUMN public.users.tokens IS 'Simple token balance - no complex double-entry ledger';
COMMENT ON COLUMN public.users.ref_code IS 'Unique 6-character referral code for inviting new users';
COMMENT ON COLUMN public.users.referred_by IS 'User who referred this user (for referral tracking)';

COMMENT ON FUNCTION public.generate_ref_code() IS 'Generate unique 6-character referral code (excludes similar chars)';
COMMENT ON FUNCTION public.get_or_create_user(TEXT, TEXT, TEXT, TEXT) IS 'Find existing user by phone or create new user';
COMMENT ON FUNCTION public.add_tokens(UUID, INTEGER, TEXT) IS 'Add tokens to user account';
COMMENT ON FUNCTION public.use_tokens(UUID, INTEGER, TEXT) IS 'Spend tokens from user account (checks for sufficient balance)';

COMMIT;
