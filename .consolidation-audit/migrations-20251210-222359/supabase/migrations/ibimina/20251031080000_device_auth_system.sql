-- Device-bound authentication system for staff mobile app
-- Implements WebAuthn/FIDO-style challenge-response authentication

-- Device registry: stores public keys for registered staff devices
CREATE TABLE IF NOT EXISTS public.device_auth_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL, -- Unique device identifier
  device_label TEXT, -- User-friendly device name (e.g., "Pixel 6 Pro")
  public_key TEXT NOT NULL, -- EC P-256 or Ed25519 public key (PEM format)
  key_algorithm TEXT NOT NULL DEFAULT 'ES256', -- ES256 (EC P-256) or Ed25519
  device_info JSONB, -- {model, os_version, manufacturer}
  
  -- Device attestation from Play Integrity API
  integrity_verdict JSONB, -- Latest integrity check result
  integrity_status TEXT CHECK (integrity_status IN ('MEETS_DEVICE_INTEGRITY', 'MEETS_BASIC_INTEGRITY', 'MEETS_STRONG_INTEGRITY', 'FAILED')),
  last_integrity_check_at TIMESTAMPTZ,
  
  -- Key lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revocation_reason TEXT,
  
  CONSTRAINT unique_user_device UNIQUE (user_id, device_id)
);

CREATE INDEX device_auth_keys_user_id_idx ON public.device_auth_keys(user_id);
CREATE INDEX device_auth_keys_device_id_idx ON public.device_auth_keys(device_id);
CREATE INDEX device_auth_keys_active_idx ON public.device_auth_keys(user_id, revoked_at) WHERE revoked_at IS NULL;

-- Challenge store: temporary storage for login challenges
CREATE TABLE IF NOT EXISTS public.device_auth_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE, -- Web session identifier
  nonce TEXT NOT NULL UNIQUE, -- One-time random value (128-bit hex)
  origin TEXT NOT NULL, -- Expected web origin (e.g., https://admin.example.com)
  challenge_data JSONB NOT NULL, -- Full challenge payload for verification
  
  -- Challenge lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- Short TTL: 30-60 seconds
  used_at TIMESTAMPTZ, -- Set when challenge is successfully verified
  verified_by_device UUID REFERENCES public.device_auth_keys(id),
  
  -- Audit trail
  ip_address TEXT,
  user_agent TEXT,
  
  CONSTRAINT not_used_and_verified CHECK (
    (used_at IS NULL AND verified_by_device IS NULL) OR 
    (used_at IS NOT NULL AND verified_by_device IS NOT NULL)
  )
);

CREATE INDEX device_auth_challenges_session_id_idx ON public.device_auth_challenges(session_id);
CREATE INDEX device_auth_challenges_nonce_idx ON public.device_auth_challenges(nonce);
CREATE INDEX device_auth_challenges_expires_at_idx ON public.device_auth_challenges(expires_at);

-- Audit log for device authentication events
CREATE TABLE IF NOT EXISTS public.device_auth_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'DEVICE_ENROLLED',
    'DEVICE_REVOKED',
    'CHALLENGE_CREATED',
    'CHALLENGE_VERIFIED',
    'CHALLENGE_FAILED',
    'INTEGRITY_CHECK_PASSED',
    'INTEGRITY_CHECK_FAILED'
  )),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_key_id UUID REFERENCES public.device_auth_keys(id) ON DELETE SET NULL,
  challenge_id UUID REFERENCES public.device_auth_challenges(id) ON DELETE SET NULL,
  
  -- Event details
  success BOOLEAN NOT NULL DEFAULT FALSE,
  failure_reason TEXT,
  metadata JSONB, -- Additional context (IP, location, device info, etc.)
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX device_auth_audit_user_id_idx ON public.device_auth_audit(user_id, created_at DESC);
CREATE INDEX device_auth_audit_device_key_id_idx ON public.device_auth_audit(device_key_id, created_at DESC);
CREATE INDEX device_auth_audit_event_type_idx ON public.device_auth_audit(event_type, created_at DESC);

-- Enable RLS
ALTER TABLE public.device_auth_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_auth_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_auth_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for device_auth_keys
CREATE POLICY "Users can view their own devices"
  ON public.device_auth_keys
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devices during enrollment"
  ON public.device_auth_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices (revoke, update last_used)"
  ON public.device_auth_keys
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System admins can view all devices"
  ON public.device_auth_keys
  FOR SELECT
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

CREATE POLICY "System admins can revoke any device"
  ON public.device_auth_keys
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

-- RLS Policies for device_auth_challenges
-- Note: Challenges are managed by API endpoints, not directly by users
-- Service role key is used for challenge creation/verification
CREATE POLICY "Service role can manage challenges"
  ON public.device_auth_challenges
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for device_auth_audit
CREATE POLICY "Users can view their own audit logs"
  ON public.device_auth_audit
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System admins can view all audit logs"
  ON public.device_auth_audit
  FOR SELECT
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

CREATE POLICY "Service role can insert audit logs"
  ON public.device_auth_audit
  FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Cleanup function: remove expired challenges (run via cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_device_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.device_auth_challenges
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Add cleanup to pg_cron (if available) - run every 5 minutes
-- Note: This assumes pg_cron extension is enabled
-- SELECT cron.schedule('cleanup-device-challenges', '*/5 * * * *', 'SELECT public.cleanup_expired_device_challenges()');
