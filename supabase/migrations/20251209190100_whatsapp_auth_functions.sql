-- Migration: WhatsApp Auth Helper Functions
-- Description: Creates helper functions for WhatsApp OTP authentication flows,
-- user management, and organization operations.

BEGIN;

-- =====================================================
-- Function: app.hash_otp_code
-- Securely hash OTP codes using SHA-256
-- =====================================================
CREATE OR REPLACE FUNCTION app.hash_otp_code(code TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(code, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION app.hash_otp_code IS 'Securely hash OTP codes using SHA-256';

-- =====================================================
-- Function: app.generate_otp_code
-- Generate a random 6-digit OTP code
-- =====================================================
CREATE OR REPLACE FUNCTION app.generate_otp_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
BEGIN
  -- Generate 6 random digits
  code := lpad(floor(random() * 1000000)::text, 6, '0');
  RETURN code;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION app.generate_otp_code IS 'Generate a random 6-digit OTP code';

-- =====================================================
-- Function: app.create_whatsapp_otp
-- Create a new OTP record for WhatsApp authentication
-- Returns the plain OTP code (to be sent via WhatsApp) and request ID
-- =====================================================
CREATE OR REPLACE FUNCTION app.create_whatsapp_otp(
  p_phone_number TEXT,
  p_purpose otp_purpose DEFAULT 'login',
  p_device_id TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_expiry_minutes INTEGER DEFAULT 5
)
RETURNS TABLE (
  otp_request_id UUID,
  otp_code TEXT,
  expires_at TIMESTAMPTZ
) AS $$
DECLARE
  v_code TEXT;
  v_code_hash TEXT;
  v_expires_at TIMESTAMPTZ;
  v_otp_id UUID;
  v_user_id UUID;
BEGIN
  -- Generate OTP
  v_code := app.generate_otp_code();
  v_code_hash := app.hash_otp_code(v_code);
  v_expires_at := now() + (p_expiry_minutes || ' minutes')::interval;
  
  -- Try to find existing user by phone
  SELECT up.user_id INTO v_user_id
  FROM app.user_profiles up
  WHERE up.whatsapp_phone = p_phone_number
    OR up.primary_phone = p_phone_number
  LIMIT 1;
  
  -- Insert OTP record
  INSERT INTO app.whatsapp_otps (
    phone_number,
    code_hash,
    purpose,
    expires_at,
    user_id,
    device_id,
    ip_address,
    user_agent
  ) VALUES (
    p_phone_number,
    v_code_hash,
    p_purpose,
    v_expires_at,
    v_user_id,
    p_device_id,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_otp_id;
  
  RETURN QUERY SELECT v_otp_id, v_code, v_expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app.create_whatsapp_otp IS 'Create a new OTP for WhatsApp authentication. Returns the plain code to send via WhatsApp.';

-- =====================================================
-- Function: app.verify_whatsapp_otp
-- Verify an OTP code and return user info if valid
-- =====================================================
CREATE OR REPLACE FUNCTION app.verify_whatsapp_otp(
  p_otp_request_id UUID,
  p_code TEXT,
  p_device_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  user_id UUID,
  phone_number TEXT,
  error_code TEXT,
  error_message TEXT
) AS $$
DECLARE
  v_otp RECORD;
  v_code_hash TEXT;
BEGIN
  -- Get OTP record
  SELECT * INTO v_otp
  FROM app.whatsapp_otps
  WHERE id = p_otp_request_id;
  
  -- Check if OTP exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'OTP_NOT_FOUND', 'OTP request not found';
    RETURN;
  END IF;
  
  -- Check if already used
  IF v_otp.used_at IS NOT NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, v_otp.phone_number, 'OTP_ALREADY_USED', 'OTP has already been used';
    RETURN;
  END IF;
  
  -- Check if expired
  IF v_otp.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::UUID, v_otp.phone_number, 'OTP_EXPIRED', 'OTP has expired';
    RETURN;
  END IF;
  
  -- Check attempt count
  IF v_otp.attempt_count >= v_otp.max_attempts THEN
    RETURN QUERY SELECT false, NULL::UUID, v_otp.phone_number, 'MAX_ATTEMPTS_EXCEEDED', 'Maximum verification attempts exceeded';
    RETURN;
  END IF;
  
  -- Increment attempt count
  UPDATE app.whatsapp_otps
  SET attempt_count = attempt_count + 1
  WHERE id = p_otp_request_id;
  
  -- Verify code hash
  v_code_hash := app.hash_otp_code(p_code);
  
  IF v_code_hash != v_otp.code_hash THEN
    RETURN QUERY SELECT false, NULL::UUID, v_otp.phone_number, 'INVALID_CODE', 'Invalid OTP code';
    RETURN;
  END IF;
  
  -- Mark as used
  UPDATE app.whatsapp_otps
  SET used_at = now(),
      device_id = COALESCE(p_device_id, device_id)
  WHERE id = p_otp_request_id;
  
  -- Return success
  RETURN QUERY SELECT true, v_otp.user_id, v_otp.phone_number, NULL::TEXT, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app.verify_whatsapp_otp IS 'Verify a WhatsApp OTP code. Returns success status and user info.';

-- =====================================================
-- Function: app.upsert_user_profile_from_whatsapp
-- Create or update user profile from WhatsApp phone number
-- Used after successful OTP verification
-- =====================================================
CREATE OR REPLACE FUNCTION app.upsert_user_profile_from_whatsapp(
  p_user_id UUID,
  p_whatsapp_phone TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_display_name TEXT DEFAULT NULL
)
RETURNS app.user_profiles AS $$
DECLARE
  v_profile app.user_profiles;
BEGIN
  INSERT INTO app.user_profiles (
    user_id,
    whatsapp_phone,
    primary_phone,
    full_name,
    display_name
  ) VALUES (
    p_user_id,
    p_whatsapp_phone,
    p_whatsapp_phone,
    p_full_name,
    p_display_name
  )
  ON CONFLICT (user_id) DO UPDATE SET
    whatsapp_phone = COALESCE(EXCLUDED.whatsapp_phone, app.user_profiles.whatsapp_phone),
    full_name = COALESCE(EXCLUDED.full_name, app.user_profiles.full_name),
    display_name = COALESCE(EXCLUDED.display_name, app.user_profiles.display_name),
    updated_at = now()
  RETURNING * INTO v_profile;
  
  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app.upsert_user_profile_from_whatsapp IS 'Create or update user profile after WhatsApp authentication';

-- =====================================================
-- Function: app.upsert_user_device
-- Register or update a user device (mobile app)
-- =====================================================
CREATE OR REPLACE FUNCTION app.upsert_user_device(
  p_user_id UUID,
  p_device_id TEXT,
  p_platform TEXT DEFAULT NULL,
  p_push_token TEXT DEFAULT NULL,
  p_device_name TEXT DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL,
  p_os_version TEXT DEFAULT NULL
)
RETURNS app.user_devices AS $$
DECLARE
  v_device app.user_devices;
BEGIN
  INSERT INTO app.user_devices (
    user_id,
    device_id,
    platform,
    push_token,
    device_name,
    app_version,
    os_version,
    last_active_at
  ) VALUES (
    p_user_id,
    p_device_id,
    p_platform,
    p_push_token,
    p_device_name,
    p_app_version,
    p_os_version,
    now()
  )
  ON CONFLICT (user_id, device_id) DO UPDATE SET
    platform = COALESCE(EXCLUDED.platform, app.user_devices.platform),
    push_token = COALESCE(EXCLUDED.push_token, app.user_devices.push_token),
    device_name = COALESCE(EXCLUDED.device_name, app.user_devices.device_name),
    app_version = COALESCE(EXCLUDED.app_version, app.user_devices.app_version),
    os_version = COALESCE(EXCLUDED.os_version, app.user_devices.os_version),
    is_active = true,
    last_active_at = now()
  RETURNING * INTO v_device;
  
  RETURN v_device;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app.upsert_user_device IS 'Register or update a user device after login';

-- =====================================================
-- Function: app.link_org_device
-- Link a device to an organization (MomoTerminal)
-- =====================================================
CREATE OR REPLACE FUNCTION app.link_org_device(
  p_org_id UUID,
  p_user_id UUID,
  p_device_id TEXT,
  p_phone_number TEXT DEFAULT NULL,
  p_sim_serial TEXT DEFAULT NULL
)
RETURNS app.org_devices AS $$
DECLARE
  v_device app.org_devices;
  v_is_member BOOLEAN;
BEGIN
  -- Verify user is a member of the organization
  SELECT EXISTS (
    SELECT 1 FROM app.org_memberships
    WHERE org_id = p_org_id
      AND user_id = p_user_id
      AND status = 'active'
  ) INTO v_is_member;
  
  IF NOT v_is_member THEN
    RAISE EXCEPTION 'User is not an active member of this organization';
  END IF;
  
  INSERT INTO app.org_devices (
    org_id,
    user_id,
    device_id,
    phone_number,
    sim_serial,
    last_active_at
  ) VALUES (
    p_org_id,
    p_user_id,
    p_device_id,
    p_phone_number,
    p_sim_serial,
    now()
  )
  ON CONFLICT (org_id, device_id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    phone_number = COALESCE(EXCLUDED.phone_number, app.org_devices.phone_number),
    sim_serial = COALESCE(EXCLUDED.sim_serial, app.org_devices.sim_serial),
    is_active = true,
    last_active_at = now()
  RETURNING * INTO v_device;
  
  RETURN v_device;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app.link_org_device IS 'Link a device to an organization for MomoTerminal SMS processing';

-- =====================================================
-- Function: app.get_user_organizations
-- Get all organizations a user belongs to
-- =====================================================
CREATE OR REPLACE FUNCTION app.get_user_organizations(p_user_id UUID)
RETURNS TABLE (
  org_id UUID,
  org_name TEXT,
  org_type app_org_type,
  org_slug TEXT,
  membership_role app_org_role,
  membership_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.org_type,
    o.slug,
    m.role,
    m.status
  FROM app.organizations o
  JOIN app.org_memberships m ON m.org_id = o.id
  WHERE m.user_id = p_user_id
    AND o.is_active = true
  ORDER BY m.role, o.name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION app.get_user_organizations IS 'Get all organizations a user belongs to with their roles';

-- =====================================================
-- Function: app.check_user_is_admin
-- Check if user has a global admin role
-- =====================================================
CREATE OR REPLACE FUNCTION app.check_user_is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM app.global_roles
    WHERE user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION app.check_user_is_admin IS 'Check if user has any global admin role';

-- =====================================================
-- Function: app.check_user_org_access
-- Check if user has access to a specific organization
-- =====================================================
CREATE OR REPLACE FUNCTION app.check_user_org_access(
  p_user_id UUID,
  p_org_id UUID,
  p_required_roles app_org_role[] DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_membership RECORD;
BEGIN
  SELECT * INTO v_membership
  FROM app.org_memberships
  WHERE user_id = p_user_id
    AND org_id = p_org_id
    AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- If no specific roles required, just check membership
  IF p_required_roles IS NULL OR array_length(p_required_roles, 1) IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if user has one of the required roles
  RETURN v_membership.role = ANY(p_required_roles);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION app.check_user_org_access IS 'Check if user has access to organization with optional role requirement';

-- =====================================================
-- Function: app.cleanup_expired_otps
-- Remove expired OTP records (for scheduled cleanup)
-- =====================================================
CREATE OR REPLACE FUNCTION app.cleanup_expired_otps(p_older_than_hours INTEGER DEFAULT 24)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM app.whatsapp_otps
  WHERE expires_at < now() - (p_older_than_hours || ' hours')::interval
    OR (used_at IS NOT NULL AND used_at < now() - (p_older_than_hours || ' hours')::interval);
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app.cleanup_expired_otps IS 'Clean up expired OTP records. Call from scheduled job.';

-- =====================================================
-- Function: app.get_otp_rate_limit_status
-- Check OTP rate limiting for a phone number
-- Returns the number of OTPs sent in the last hour/day
-- =====================================================
CREATE OR REPLACE FUNCTION app.get_otp_rate_limit_status(
  p_phone_number TEXT,
  p_window_hours INTEGER DEFAULT 1
)
RETURNS TABLE (
  otp_count INTEGER,
  oldest_otp_at TIMESTAMPTZ,
  can_send BOOLEAN
) AS $$
DECLARE
  v_count INTEGER;
  v_oldest TIMESTAMPTZ;
  v_max_per_hour INTEGER := 5;
  v_max_per_day INTEGER := 10;
BEGIN
  SELECT COUNT(*), MIN(created_at)
  INTO v_count, v_oldest
  FROM app.whatsapp_otps
  WHERE phone_number = p_phone_number
    AND created_at > now() - (p_window_hours || ' hours')::interval;
  
  RETURN QUERY SELECT 
    COALESCE(v_count, 0),
    v_oldest,
    COALESCE(v_count, 0) < CASE WHEN p_window_hours = 1 THEN v_max_per_hour ELSE v_max_per_day END;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION app.get_otp_rate_limit_status IS 'Check OTP rate limits for a phone number';

-- =====================================================
-- Grant function execution permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION app.hash_otp_code TO service_role;
GRANT EXECUTE ON FUNCTION app.generate_otp_code TO service_role;
GRANT EXECUTE ON FUNCTION app.create_whatsapp_otp TO service_role;
GRANT EXECUTE ON FUNCTION app.verify_whatsapp_otp TO service_role;
GRANT EXECUTE ON FUNCTION app.upsert_user_profile_from_whatsapp TO service_role;
GRANT EXECUTE ON FUNCTION app.upsert_user_device TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.link_org_device TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.get_user_organizations TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.check_user_is_admin TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.check_user_org_access TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.cleanup_expired_otps TO service_role;
GRANT EXECUTE ON FUNCTION app.get_otp_rate_limit_status TO service_role;

COMMIT;
