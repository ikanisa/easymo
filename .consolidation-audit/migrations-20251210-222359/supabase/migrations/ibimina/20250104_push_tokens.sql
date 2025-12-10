-- Push notification tokens table
create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, platform)
);

-- Index for efficient lookups
create index if not exists push_tokens_user_id_idx on push_tokens(user_id);
create index if not exists push_tokens_token_idx on push_tokens(token);

-- RLS policies
alter table push_tokens enable row level security;

-- Users can manage their own push tokens
create policy "Users can insert their own push tokens"
  on push_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own push tokens"
  on push_tokens for select
  using (auth.uid() = user_id);

create policy "Users can update their own push tokens"
  on push_tokens for update
  using (auth.uid() = user_id);

create policy "Users can delete their own push tokens"
  on push_tokens for delete
  using (auth.uid() = user_id);

-- Service role can manage all tokens (for admin purposes)
create policy "Service role can manage all push tokens"
  on push_tokens for all
  using (auth.jwt() ->> 'role' = 'service_role');

-- Function to update updated_at timestamp
create or replace function update_push_tokens_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger push_tokens_updated_at
  before update on push_tokens
  for each row
  execute function update_push_tokens_updated_at();

-- Grant permissions
grant usage on schema public to authenticated;
grant all on push_tokens to authenticated;
grant all on push_tokens to service_role;
