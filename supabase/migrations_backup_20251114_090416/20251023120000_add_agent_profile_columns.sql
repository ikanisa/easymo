BEGIN;
alter table voice_calls
  add column if not exists agent_profile text,
  add column if not exists agent_profile_confidence text,
  add column if not exists channel text default 'voice',
  add column if not exists campaign_tags text[];

create index if not exists voice_calls_agent_profile_idx on voice_calls (agent_profile);
create index if not exists voice_calls_channel_idx on voice_calls (channel);

alter table wa_threads
  add column if not exists agent_profile text,
  add column if not exists agent_display_name text,
  add column if not exists metadata jsonb default '{}'::jsonb;
COMMIT;
