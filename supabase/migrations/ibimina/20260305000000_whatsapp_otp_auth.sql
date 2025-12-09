-- WhatsApp OTP Authentication System
-- Enables passwordless authentication via WhatsApp OTP for client mobile app

-- ============================================================================
-- 1. OTP Codes Table
-- ============================================================================

create table if not exists auth_otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  otp_code_hash text not null, -- SHA256 hash of OTP
  expires_at timestamptz not null,
  attempts int not null default 0,
  verified bool not null default false,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  
  constraint valid_phone_number check (phone_number ~* '^\+250[0-9]{9}$'),
  constraint valid_attempts check (attempts >= 0 and attempts <= 10),
  constraint valid_expiry check (expires_at > created_at)
);

-- Indexes for performance
create index if not exists auth_otp_codes_phone_idx 
  on auth_otp_codes(phone_number, created_at desc);
create index if not exists auth_otp_codes_expires_idx 
  on auth_otp_codes(expires_at) 
  where not verified;
create index if not exists auth_otp_codes_verified_idx 
  on auth_otp_codes(verified, created_at desc);

comment on table auth_otp_codes is 'Stores OTP codes for WhatsApp-based authentication';
comment on column auth_otp_codes.phone_number is 'Rwanda phone number in E.164 format (+250...)';
comment on column auth_otp_codes.otp_code_hash is 'SHA256 hash of the 6-digit OTP code';
comment on column auth_otp_codes.expires_at is 'OTP expiry timestamp (typically 5 minutes from creation)';
comment on column auth_otp_codes.attempts is 'Number of failed verification attempts';

-- ============================================================================
-- 2. OTP Rate Limiting Table
-- ============================================================================

create table if not exists auth_otp_rate_limits (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  attempts int not null default 1,
  window_start timestamptz not null default now(),
  last_attempt timestamptz not null default now(),
  blocked_until timestamptz,
  
  constraint valid_phone_number check (phone_number ~* '^\+250[0-9]{9}$')
);

create unique index if not exists auth_otp_rate_limits_phone_idx 
  on auth_otp_rate_limits(phone_number);

comment on table auth_otp_rate_limits is 'Rate limiting for OTP requests per phone number';
comment on column auth_otp_rate_limits.attempts is 'Number of OTP requests in current window';
comment on column auth_otp_rate_limits.window_start is 'Start of rate limit window (15 min)';
comment on column auth_otp_rate_limits.blocked_until is 'Phone number blocked until this time';

-- ============================================================================
-- 3. User Phone Numbers (extends auth.users)
-- ============================================================================

-- Add phone_number column to user_profiles if not exists
do $$ 
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'user_profiles' and column_name = 'phone_number'
  ) then
    alter table user_profiles add column phone_number text unique;
    alter table user_profiles add constraint valid_phone_number 
      check (phone_number is null or phone_number ~* '^\+250[0-9]{9}$');
    
    create index if not exists user_profiles_phone_idx 
      on user_profiles(phone_number) where phone_number is not null;
      
    comment on column user_profiles.phone_number is 'Verified WhatsApp number for passwordless auth';
  end if;
end $$;

-- ============================================================================
-- 4. Helper Functions
-- ============================================================================

-- Function to check rate limits
create or replace function check_otp_rate_limit(p_phone_number text)
returns jsonb as $$
declare
  v_rate_limit record;
  v_window_minutes int := 15;
  v_max_attempts int := 3;
  v_block_minutes int := 15;
begin
  -- Get or create rate limit record
  select * into v_rate_limit
  from auth_otp_rate_limits
  where phone_number = p_phone_number;
  
  -- If no record, create one
  if not found then
    insert into auth_otp_rate_limits (phone_number)
    values (p_phone_number);
    
    return jsonb_build_object('allowed', true, 'attempts', 1, 'max_attempts', v_max_attempts);
  end if;
  
  -- Check if blocked
  if v_rate_limit.blocked_until is not null and v_rate_limit.blocked_until > now() then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'blocked',
      'blocked_until', v_rate_limit.blocked_until,
      'wait_seconds', extract(epoch from (v_rate_limit.blocked_until - now()))::int
    );
  end if;
  
  -- Check if window has expired
  if now() - v_rate_limit.window_start > (v_window_minutes || ' minutes')::interval then
    -- Reset window
    update auth_otp_rate_limits
    set attempts = 1, window_start = now(), last_attempt = now(), blocked_until = null
    where phone_number = p_phone_number;
    
    return jsonb_build_object('allowed', true, 'attempts', 1, 'max_attempts', v_max_attempts);
  end if;
  
  -- Check if max attempts reached
  if v_rate_limit.attempts >= v_max_attempts then
    -- Block for 15 minutes
    update auth_otp_rate_limits
    set blocked_until = now() + (v_block_minutes || ' minutes')::interval
    where phone_number = p_phone_number;
    
    return jsonb_build_object(
      'allowed', false,
      'reason', 'max_attempts',
      'attempts', v_rate_limit.attempts,
      'max_attempts', v_max_attempts,
      'blocked_until', now() + (v_block_minutes || ' minutes')::interval,
      'wait_seconds', v_block_minutes * 60
    );
  end if;
  
  -- Increment attempts
  update auth_otp_rate_limits
  set attempts = attempts + 1, last_attempt = now()
  where phone_number = p_phone_number;
  
  return jsonb_build_object(
    'allowed', true,
    'attempts', v_rate_limit.attempts + 1,
    'max_attempts', v_max_attempts
  );
end;
$$ language plpgsql security definer;

comment on function check_otp_rate_limit is 'Check if phone number can request another OTP';

-- Function to cleanup expired OTPs
create or replace function cleanup_expired_otps()
returns void as $$
begin
  -- Delete OTPs older than 24 hours
  delete from auth_otp_codes
  where created_at < now() - interval '24 hours';
  
  -- Reset rate limits older than 1 hour
  delete from auth_otp_rate_limits
  where window_start < now() - interval '1 hour'
    and (blocked_until is null or blocked_until < now());
    
  -- Log cleanup
  raise notice 'Cleaned up expired OTPs and rate limits';
end;
$$ language plpgsql security definer;

comment on function cleanup_expired_otps is 'Cleanup expired OTPs and old rate limits (run daily)';

-- Function to verify OTP
create or replace function verify_otp_code(
  p_phone_number text,
  p_otp_code text
)
returns jsonb as $$
declare
  v_otp_record record;
  v_otp_hash text;
  v_user_id uuid;
begin
  -- Hash the provided OTP
  v_otp_hash := encode(digest(p_otp_code, 'sha256'), 'hex');
  
  -- Find valid OTP
  select * into v_otp_record
  from auth_otp_codes
  where phone_number = p_phone_number
    and otp_code_hash = v_otp_hash
    and expires_at > now()
    and not verified
    and attempts < 3
  order by created_at desc
  limit 1;
  
  -- If not found, check for expired or wrong code
  if not found then
    -- Increment attempts on any non-verified recent OTP
    update auth_otp_codes
    set attempts = attempts + 1
    where phone_number = p_phone_number
      and not verified
      and created_at > now() - interval '10 minutes'
      and id = (
        select id from auth_otp_codes
        where phone_number = p_phone_number and not verified
        order by created_at desc limit 1
      );
    
    return jsonb_build_object(
      'success', false,
      'error', 'invalid_otp',
      'message', 'Invalid or expired OTP code'
    );
  end if;
  
  -- Mark as verified
  update auth_otp_codes
  set verified = true, verified_at = now()
  where id = v_otp_record.id;
  
  -- Check if user exists with this phone number
  select id into v_user_id
  from user_profiles
  where phone_number = p_phone_number;
  
  return jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'is_new_user', v_user_id is null,
    'phone_number', p_phone_number
  );
end;
$$ language plpgsql security definer;

comment on function verify_otp_code is 'Verify OTP code and return user info';

-- ============================================================================
-- 5. RLS Policies
-- ============================================================================

-- Enable RLS
alter table auth_otp_codes enable row level security;
alter table auth_otp_rate_limits enable row level security;

-- No direct access to OTP tables (only through functions)
create policy "No direct access to OTP codes"
  on auth_otp_codes for all
  using (false);

create policy "No direct access to rate limits"
  on auth_otp_rate_limits for all
  using (false);

-- ============================================================================
-- 6. Scheduled Cleanup (pg_cron)
-- ============================================================================

-- Run cleanup daily at 2 AM
-- Note: Requires pg_cron extension
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'cleanup-expired-otps',
      '0 2 * * *', -- Daily at 2 AM
      $$select cleanup_expired_otps()$$
    );
  end if;
exception when others then
  raise notice 'pg_cron not available, skipping scheduled cleanup';
end $$;

-- ============================================================================
-- 7. Monitoring View
-- ============================================================================

create or replace view auth_otp_stats as
select
  date_trunc('day', created_at) as date,
  count(*) as total_otps_sent,
  count(*) filter (where verified) as total_verified,
  count(*) filter (where not verified and expires_at < now()) as total_expired,
  count(*) filter (where attempts >= 3) as total_max_attempts,
  round(
    100.0 * count(*) filter (where verified) / nullif(count(*), 0),
    2
  ) as verification_rate_pct,
  avg(extract(epoch from (verified_at - created_at))) filter (where verified) as avg_verify_time_seconds
from auth_otp_codes
group by date_trunc('day', created_at)
order by date desc;

comment on view auth_otp_stats is 'Daily OTP authentication statistics';

-- ============================================================================
-- 8. Grant Permissions
-- ============================================================================

-- Grant execute on functions to authenticated and anon users (for Edge Functions)
grant execute on function check_otp_rate_limit to authenticated, anon;
grant execute on function verify_otp_code to authenticated, anon;
grant execute on function cleanup_expired_otps to postgres;

-- Grant select on stats view to authenticated users
grant select on auth_otp_stats to authenticated;

-- ============================================================================
-- Done
-- ============================================================================

-- Log migration
do $$
begin
  raise notice 'WhatsApp OTP authentication system installed successfully';
  raise notice 'Tables: auth_otp_codes, auth_otp_rate_limits';
  raise notice 'Functions: check_otp_rate_limit, verify_otp_code, cleanup_expired_otps';
  raise notice 'View: auth_otp_stats';
end $$;
