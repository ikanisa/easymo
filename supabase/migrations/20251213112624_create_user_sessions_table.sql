BEGIN;

-- Create user_sessions table for managing WhatsApp user conversation state
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  active_service TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  last_interaction TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on phone_number for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_phone_number 
  ON public.user_sessions(phone_number);

-- Create index on active_service for analytics
CREATE INDEX IF NOT EXISTS idx_user_sessions_active_service 
  ON public.user_sessions(active_service) 
  WHERE active_service IS NOT NULL;

-- Create index on last_interaction for cleanup/expiry queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_interaction 
  ON public.user_sessions(last_interaction);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_user_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_sessions_updated_at
  BEFORE UPDATE ON public.user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_sessions_updated_at();

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Service role has full access, authenticated users can read their own
CREATE POLICY "service_role_all_user_sessions" ON public.user_sessions
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "users_read_own_session" ON public.user_sessions
  FOR SELECT TO authenticated 
  USING (
    phone_number = (SELECT phone FROM auth.users WHERE id = auth.uid())
  );

-- Comments for documentation
COMMENT ON TABLE public.user_sessions IS 'Manages WhatsApp user conversation state and active services';
COMMENT ON COLUMN public.user_sessions.phone_number IS 'User phone number in E.164 format';
COMMENT ON COLUMN public.user_sessions.active_service IS 'Currently active service/menu (mobility, wallet, etc)';
COMMENT ON COLUMN public.user_sessions.context IS 'Session context data (form state, conversation flow, etc)';
COMMENT ON COLUMN public.user_sessions.last_interaction IS 'Timestamp of last user interaction, used for session expiry';

COMMIT;
