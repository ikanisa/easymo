# Deploy Share easyMO Migrations - Manual Guide

**Date:** 2025-11-23  
**Issue:** `supabase db push` is hanging - use manual deployment

## Option 1: Via Supabase Dashboard (Recommended)

### Step 1: Go to SQL Editor
1. Open https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql/new
2. Login if needed

### Step 2: Run Migration 1 - User Referrals Table
Copy and paste this SQL:

```sql
-- Migration: Create User Referrals Table
-- File: 20251123151000_create_user_referrals_table.sql

BEGIN;

-- Create user_referrals table
CREATE TABLE IF NOT EXISTS public.user_referrals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    referred_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    referral_code text NOT NULL,
    reward_amount integer DEFAULT 1000,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'invalid')),
    created_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    UNIQUE(referrer_id, referred_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_referrals_referrer ON public.user_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_user_referrals_referred ON public.user_referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_user_referrals_code ON public.user_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_user_referrals_status ON public.user_referrals(status);

-- Enable RLS
ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view referrals they made" ON public.user_referrals 
    FOR SELECT USING (auth.uid() = referrer_id);

CREATE POLICY "Users can view referrals where they were referred" ON public.user_referrals 
    FOR SELECT USING (auth.uid() = referred_id);

-- Grants
GRANT ALL ON public.user_referrals TO service_role;
GRANT SELECT ON public.user_referrals TO authenticated;

-- RPC: Generate Referral Code
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
    LOOP
        v_hash := encode(digest(p_profile_id::text || clock_timestamp()::text, 'sha256'), 'hex');
        v_code := '';
        
        FOR i IN 1..6 LOOP
            v_code := v_code || substring(v_chars, (get_byte(decode(v_hash, 'hex'), i) % 32) + 1, 1);
        END LOOP;
        
        SELECT EXISTS(SELECT 1 FROM public.referral_links WHERE code = v_code) INTO v_exists;
        EXIT WHEN NOT v_exists;
        
        v_attempts := v_attempts + 1;
        EXIT WHEN v_attempts >= 10;
    END LOOP;
    
    RETURN v_code;
END;
$$;

-- RPC: Process Referral
CREATE OR REPLACE FUNCTION public.process_referral(p_code text, p_referred_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_referrer_id uuid;
    v_reward_amount integer := 1000;
    v_result json;
BEGIN
    SELECT user_id INTO v_referrer_id
    FROM public.referral_links
    WHERE code = p_code AND active = true
    LIMIT 1;
    
    IF v_referrer_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid referral code');
    END IF;
    
    IF v_referrer_id = p_referred_id THEN
        RETURN json_build_object('success', false, 'error', 'Cannot refer yourself');
    END IF;
    
    INSERT INTO public.user_referrals (referrer_id, referred_id, referral_code, reward_amount, status, completed_at)
    VALUES (v_referrer_id, p_referred_id, p_code, v_reward_amount, 'completed', now())
    ON CONFLICT (referrer_id, referred_id) DO NOTHING;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Referral already exists');
    END IF;
    
    INSERT INTO public.token_allocations (profile_id, amount, type, description, metadata)
    VALUES (
        v_referrer_id,
        v_reward_amount,
        'referral_bonus',
        'Referral reward for inviting a friend',
        json_build_object('referred_id', p_referred_id, 'code', p_code)
    );
    
    RETURN json_build_object('success', true, 'reward', v_reward_amount, 'referrer_id', v_referrer_id);
END;
$$;

-- Grants for RPC functions
GRANT EXECUTE ON FUNCTION public.generate_referral_code(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_referral(text, uuid) TO service_role;

COMMIT;
```

Click **Run** and verify: `Success. No rows returned`

---

### Step 3: Run Migration 2 - Referral Links Table
Copy and paste this SQL:

```sql
-- Migration: Create Referral Links Table
-- File: 20251123153000_create_referral_links_table.sql

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
```

Click **Run** and verify: `Success. No rows returned`

---

## Option 2: Via Command Line (If CLI Works)

```bash
cd /Users/jeanbosco/workspace/easymo-
supabase db push
```

---

## Verification

After running migrations, verify they worked:

### Check Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('referral_links', 'user_referrals');
```

Expected: 2 rows returned

### Check RPC Functions Exist
```sql
SELECT proname 
FROM pg_proc 
WHERE proname IN ('generate_referral_code', 'process_referral', 'track_referral_click', 'track_referral_signup');
```

Expected: 4 rows returned

### Test Code Generation
```sql
SELECT public.generate_referral_code('00000000-0000-0000-0000-000000000000'::uuid);
```

Expected: Returns 6-character code like `AB23XY`

---

## After Deployment

### Test Share easyMO
1. Send WhatsApp message to +22893002751
2. Tap "🔗 Share easyMO" button
3. Should receive message with:
   - wa.me link
   - Referral code
   - No error message

### Check Database
```sql
SELECT * FROM referral_links ORDER BY created_at DESC LIMIT 5;
```

Should see your referral link entry!

---

## Troubleshooting

### Error: relation "profiles" does not exist
**Fix:** Create profiles table first or use existing user table

### Error: permission denied
**Fix:** Grant service_role permissions:
```sql
GRANT ALL ON public.referral_links TO service_role;
GRANT ALL ON public.user_referrals TO service_role;
```

### Error: function already exists
**Fix:** Use `CREATE OR REPLACE FUNCTION` (already in SQL above)

---

## Status Check

After deployment, you should have:
- ✅ `referral_links` table
- ✅ `user_referrals` table  
- ✅ `generate_referral_code()` RPC
- ✅ `process_referral()` RPC
- ✅ `track_referral_click()` RPC
- ✅ `track_referral_signup()` RPC
- ✅ All indexes and RLS policies

**Share easyMO should now work!** 🎉

