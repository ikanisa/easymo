-- Migration: Add push_subscriptions and members_app_profiles tables
-- Description: Support for web push notifications and client app OCR/onboarding
-- Date: 2025-10-28

-- Create push_subscriptions table for web push notifications
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  topics TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_topics ON public.push_subscriptions USING GIN(topics);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for push_subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create or update members_app_profiles table for client app data
CREATE TABLE IF NOT EXISTS public.members_app_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Identity verification
  id_type TEXT CHECK (id_type IN ('NID', 'DL', 'PASSPORT')),
  id_number TEXT,
  id_document_url TEXT,
  id_document_path TEXT,
  ocr_json JSONB,
  ocr_confidence NUMERIC(3,2),
  
  -- Onboarding status
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step TEXT,
  
  -- Profile data
  preferred_language TEXT DEFAULT 'en',
  notification_preferences JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_members_app_profiles_user_id ON public.members_app_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_members_app_profiles_id_number ON public.members_app_profiles(id_number) WHERE id_number IS NOT NULL;

-- Enable RLS
ALTER TABLE public.members_app_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for members_app_profiles
CREATE POLICY "Users can view their own profile"
  ON public.members_app_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.members_app_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.members_app_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for ID documents if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('id-documents', 'id-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for id-documents bucket
CREATE POLICY "Users can upload their own ID documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'id-documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own ID documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'id-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own ID documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'id-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Add updated_at trigger for push_subscriptions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_members_app_profiles_updated_at ON public.members_app_profiles;
CREATE TRIGGER update_members_app_profiles_updated_at
  BEFORE UPDATE ON public.members_app_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.members_app_profiles TO authenticated;

-- Comments
COMMENT ON TABLE public.push_subscriptions IS 'Web push notification subscriptions for client app';
COMMENT ON TABLE public.members_app_profiles IS 'Client app member profiles with identity verification data';
COMMENT ON COLUMN public.members_app_profiles.ocr_json IS 'Raw OCR extraction results from ID document processing';
COMMENT ON COLUMN public.members_app_profiles.ocr_confidence IS 'OCR confidence score between 0 and 1';
