BEGIN;

-- Create whatsapp_users table (lightweight user tracking for WhatsApp)
CREATE TABLE IF NOT EXISTS public.whatsapp_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'fr', 'rw')),
  country TEXT DEFAULT 'RW' CHECK (country IN ('RW', 'BI', 'CD', 'TZ')),
  profile_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_users_phone ON public.whatsapp_users(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_profile_id ON public.whatsapp_users(profile_id);

-- Enable RLS
ALTER TABLE public.whatsapp_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_whatsapp_users" ON public.whatsapp_users
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "users_read_own_whatsapp_user" ON public.whatsapp_users
  FOR SELECT TO authenticated 
  USING (phone = (SELECT phone FROM auth.users WHERE id = auth.uid()));

-- Create get_or_create_user function (works with profiles + whatsapp_users)
CREATE OR REPLACE FUNCTION public.get_or_create_user(
  p_phone TEXT,
  p_name TEXT DEFAULT NULL,
  p_language TEXT DEFAULT 'en',
  p_country TEXT DEFAULT 'RW'
)
RETURNS public.whatsapp_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user public.whatsapp_users;
  v_profile_id UUID;
BEGIN
  -- Normalize phone (E.164 format)
  p_phone := TRIM(p_phone);
  
  -- Try to find existing whatsapp_user
  SELECT * INTO v_user FROM public.whatsapp_users WHERE phone = p_phone;
  
  IF FOUND THEN
    -- Update last_seen_at
    UPDATE public.whatsapp_users 
    SET last_seen_at = NOW(),
        updated_at = NOW()
    WHERE id = v_user.id
    RETURNING * INTO v_user;
    
    RETURN v_user;
  END IF;
  
  -- Check if profile exists with this phone
  SELECT user_id INTO v_profile_id 
  FROM public.profiles 
  WHERE phone_number = p_phone
  LIMIT 1;
  
  -- Create new whatsapp_user
  INSERT INTO public.whatsapp_users (
    phone, 
    name, 
    language, 
    country, 
    profile_id,
    last_seen_at
  )
  VALUES (
    p_phone, 
    p_name, 
    p_language, 
    p_country, 
    v_profile_id,
    NOW()
  )
  RETURNING * INTO v_user;
  
  RETURN v_user;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_or_create_user(TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_or_create_user(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_user(TEXT, TEXT, TEXT, TEXT) TO anon;

-- Comments
COMMENT ON TABLE public.whatsapp_users IS 'Lightweight user tracking for WhatsApp interactions (bridges to profiles table)';
COMMENT ON FUNCTION public.get_or_create_user IS 'Get or create WhatsApp user by phone number, links to profiles if exists';

COMMIT;
