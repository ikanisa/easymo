-- Fix profiles table schema to match code expectations
-- The code expects 'locale' or 'language' column. 
-- The error says "Could not find the 'language' column".
-- We should ensure both exist or alias them properly, but standardizing on 'locale' is better.
-- However, to fix the immediate error, we will add 'language' as an alias to 'locale' or just add it.

DO $$ 
BEGIN 
    -- Check if 'language' column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'language') THEN
        ALTER TABLE public.profiles ADD COLUMN language TEXT DEFAULT 'en';
    END IF;

    -- Check if 'locale' column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'locale') THEN
        ALTER TABLE public.profiles ADD COLUMN locale TEXT DEFAULT 'en';
    END IF;

    -- Ensure whatsapp_e164 is unique
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'profiles' AND indexname = 'profiles_whatsapp_e164_key') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_whatsapp_e164_key UNIQUE (whatsapp_e164);
    END IF;
END $$;
