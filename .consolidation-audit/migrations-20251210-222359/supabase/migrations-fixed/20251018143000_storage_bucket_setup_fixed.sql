BEGIN;

-- Fix storage bucket creation syntax
DO $$
BEGIN
  -- Create buckets with proper syntax
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES 
    ('profiles', 'profiles', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('documents', 'documents', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
    ('kyc', 'kyc', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Set up storage policies
CREATE POLICY "Users can upload own profile images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'profiles' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own profile images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'profiles' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

COMMIT;
