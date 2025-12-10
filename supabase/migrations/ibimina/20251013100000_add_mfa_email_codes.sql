-- Email-based MFA support
create table if not exists app.mfa_email_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  salt text not null,
  expires_at timestamptz not null,
  attempt_count int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('UTC', now())
);

create index if not exists idx_mfa_email_codes_user_active
  on app.mfa_email_codes (user_id, expires_at)
  where consumed_at is null;

create index if not exists idx_mfa_email_codes_created
  on app.mfa_email_codes (created_at);

comment on table app.mfa_email_codes is 'One-time email verification codes for MFA channel.';
