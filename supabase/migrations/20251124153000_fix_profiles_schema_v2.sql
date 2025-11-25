-- Fix profiles table schema to match ensureProfile code
-- The code expects 'phone_number' and 'wa_id' columns.

DO $$ 
BEGIN 
    -- Check if 'phone_number' column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone_number') THEN
        ALTER TABLE public.profiles ADD COLUMN phone_number TEXT;
    END IF;

    -- Check if 'wa_id' column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'wa_id') THEN
        ALTER TABLE public.profiles ADD COLUMN wa_id TEXT;
    END IF;

    -- Add index for fast lookup if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'profiles' AND indexname = 'idx_profiles_phone_number') THEN
        CREATE INDEX idx_profiles_phone_number ON public.profiles(phone_number);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'profiles' AND indexname = 'idx_profiles_wa_id') THEN
        CREATE INDEX idx_profiles_wa_id ON public.profiles(wa_id);
    END IF;

END $$;
