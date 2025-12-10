-- Passkey (WebAuthn) storage and MFA recovery codes

create table if not exists public.webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  credential_id text not null,
  credential_public_key bytea not null,
  sign_count bigint not null default 0,
  transports text[] not null default array[]::text[],
  backed_up boolean not null default false,
  device_type text,
  friendly_name text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create unique index if not exists webauthn_credentials_credential_id_idx
  on public.webauthn_credentials (credential_id);

alter table public.webauthn_credentials enable row level security;

create policy webauthn_credentials_self_manage
  on public.webauthn_credentials
  for all
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  with check (auth.uid() = user_id or public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

alter table public.users
  add column if not exists mfa_passkey_enrolled boolean not null default false;

create table if not exists public.mfa_recovery_codes (
  user_id uuid primary key references public.users(id) on delete cascade,
  codes text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_mfa_recovery_codes()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_mfa_recovery_codes_touch on public.mfa_recovery_codes;
create trigger trg_mfa_recovery_codes_touch
  before update on public.mfa_recovery_codes
  for each row
  execute function public.touch_mfa_recovery_codes();

alter table public.mfa_recovery_codes enable row level security;

create policy mfa_recovery_codes_self_manage
  on public.mfa_recovery_codes
  for all
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  with check (auth.uid() = user_id or public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
