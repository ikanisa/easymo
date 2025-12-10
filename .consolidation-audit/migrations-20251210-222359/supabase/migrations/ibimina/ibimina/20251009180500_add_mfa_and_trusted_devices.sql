-- Add MFA support columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_secret_enc BYTEA,
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mfa_methods TEXT[] NOT NULL DEFAULT ARRAY['TOTP']::TEXT[],
  ADD COLUMN IF NOT EXISTS mfa_backup_hashes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS last_mfa_success_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_mfa_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_mfa_step BIGINT;

-- Trusted device registry
CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_fingerprint_hash TEXT NOT NULL,
  user_agent_hash TEXT NOT NULL,
  ip_prefix TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS trusted_devices_user_device_idx
  ON public.trusted_devices(user_id, device_id);

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their trusted devices"
  ON public.trusted_devices
  FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

CREATE POLICY "Users can manage their trusted devices"
  ON public.trusted_devices
  FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

CREATE POLICY "System admins can insert trusted devices"
  ON public.trusted_devices
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
