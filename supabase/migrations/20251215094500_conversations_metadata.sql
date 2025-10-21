-- Add metadata column for conversations to support API key-value pairs
alter table if exists public.conversations
  add column if not exists metadata jsonb default '{}'::jsonb;

-- Index metadata for key lookup operations (GIN handles jsonb contains queries)
create index if not exists conversations_metadata_gin
  on public.conversations
  using gin (metadata);
