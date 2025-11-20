-- Voice bridge persistence for consent + transcripts
alter table public.voice_calls
  add column if not exists consent_recorded_at timestamptz,
  add column if not exists consent_channel text,
  add column if not exists consent_media_url text,
  add column if not exists transcript_locale text default 'en',
  add column if not exists transcript_status text default 'pending',
  add column if not exists last_transcript_segment_at timestamptz;

create table if not exists public.voice_segments (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.voice_calls(id) on delete cascade,
  sequence integer not null,
  speaker text not null check (speaker in ('caller','assistant','system')),
  text text not null,
  confidence numeric,
  started_at timestamptz default now(),
  ended_at timestamptz,
  created_at timestamptz default now()
);

create unique index if not exists voice_segments_call_sequence_idx
  on public.voice_segments(call_id, sequence);

alter table public.voice_segments enable row level security;
create policy "svc_rw_voice_segments" on public.voice_segments for all using (auth.role() = 'service_role') with check (true);

grant all on table public.voice_segments to postgres, anon, authenticated, service_role;
