-- Migration: AI Embeddings Vector Store
-- Description: Establishes canonical document & chunk storage for AI agent RAG flows
-- Date: 2025-12-31

create extension if not exists vector;

create table if not exists public.ai_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  source_type text not null check (char_length(source_type) > 0),
  source_uri text,
  title text not null,
  checksum text not null,
  metadata jsonb not null default '{}'::jsonb,
  token_count integer,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_documents_org_checksum_idx
  on public.ai_documents (org_id, checksum);
create index if not exists ai_documents_source_idx
  on public.ai_documents (source_type, created_at desc);

create table if not exists public.ai_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.ai_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536) not null,
  token_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_document_chunks_document_index_idx
  on public.ai_document_chunks (document_id, chunk_index);
create index if not exists ai_document_chunks_created_idx
  on public.ai_document_chunks (created_at desc);
create index if not exists ai_document_chunks_embedding_idx
  on public.ai_document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 200);

create table if not exists public.ai_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.ai_documents(id) on delete cascade,
  source_type text not null,
  source_uri text,
  status text not null check (status in ('pending','processing','completed','failed')) default 'pending',
  metrics jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.ai_reindex_events (
  id uuid primary key default gen_random_uuid(),
  triggered_by uuid references auth.users(id),
  reason text,
  target_org uuid,
  job_count integer default 0,
  chunk_count integer default 0,
  created_at timestamptz not null default now()
);

alter table public.ai_documents enable row level security;
alter table public.ai_document_chunks enable row level security;
alter table public.ai_ingestion_jobs enable row level security;
alter table public.ai_reindex_events enable row level security;

create policy "Org members manage AI documents"
  on public.ai_documents
  for all
  using (
    org_id is null and public.has_role(auth.uid(), 'SYSTEM_ADMIN')
    or exists (
      select 1 from public.org_memberships om
      where om.org_id = ai_documents.org_id
      and om.user_id = auth.uid()
    )
  )
  with check (
    org_id is null and public.has_role(auth.uid(), 'SYSTEM_ADMIN')
    or exists (
      select 1 from public.org_memberships om
      where om.org_id = ai_documents.org_id
      and om.user_id = auth.uid()
    )
  );

create policy "Org members read AI chunks"
  on public.ai_document_chunks
  for select
  using (
    exists (
      select 1 from public.ai_documents d
      join public.org_memberships om on om.org_id = d.org_id
      where d.id = ai_document_chunks.document_id
      and om.user_id = auth.uid()
    )
    or (
      exists (
        select 1 from public.ai_documents d
        where d.id = ai_document_chunks.document_id
        and d.org_id is null
      )
      and public.has_role(auth.uid(), 'SYSTEM_ADMIN')
    )
  );

create policy "Org members insert AI chunks"
  on public.ai_document_chunks
  for insert
  with check (
    exists (
      select 1 from public.ai_documents d
      join public.org_memberships om on om.org_id = d.org_id
      where d.id = ai_document_chunks.document_id
      and om.user_id = auth.uid()
    )
    or (
      exists (
        select 1 from public.ai_documents d
        where d.id = ai_document_chunks.document_id
        and d.org_id is null
      )
      and public.has_role(auth.uid(), 'SYSTEM_ADMIN')
    )
  );

create policy "Org members update AI chunks"
  on public.ai_document_chunks
  for update
  using (
    exists (
      select 1 from public.ai_documents d
      join public.org_memberships om on om.org_id = d.org_id
      where d.id = ai_document_chunks.document_id
      and om.user_id = auth.uid()
    )
    or (
      exists (
        select 1 from public.ai_documents d
        where d.id = ai_document_chunks.document_id
        and d.org_id is null
      )
      and public.has_role(auth.uid(), 'SYSTEM_ADMIN')
    )
  )
  with check (
    exists (
      select 1 from public.ai_documents d
      join public.org_memberships om on om.org_id = d.org_id
      where d.id = ai_document_chunks.document_id
      and om.user_id = auth.uid()
    )
    or (
      exists (
        select 1 from public.ai_documents d
        where d.id = ai_document_chunks.document_id
        and d.org_id is null
      )
      and public.has_role(auth.uid(), 'SYSTEM_ADMIN')
    )
  );

create policy "Org members manage AI ingestion jobs"
  on public.ai_ingestion_jobs
  for all
  using (
    document_id is null
    or exists (
      select 1 from public.ai_documents d
      join public.org_memberships om on om.org_id = d.org_id
      where d.id = ai_ingestion_jobs.document_id
      and om.user_id = auth.uid()
    )
    or public.has_role(auth.uid(), 'SYSTEM_ADMIN')
  )
  with check (
    document_id is null
    or exists (
      select 1 from public.ai_documents d
      join public.org_memberships om on om.org_id = d.org_id
      where d.id = ai_ingestion_jobs.document_id
      and om.user_id = auth.uid()
    )
    or public.has_role(auth.uid(), 'SYSTEM_ADMIN')
  );

create policy "Admins manage AI reindex events"
  on public.ai_reindex_events
  for all
  using (public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  with check (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

drop trigger if exists ai_documents_updated_at on public.ai_documents;
create trigger ai_documents_updated_at
  before update on public.ai_documents
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists ai_document_chunks_updated_at on public.ai_document_chunks;
create trigger ai_document_chunks_updated_at
  before update on public.ai_document_chunks
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists ai_ingestion_jobs_finished_at on public.ai_ingestion_jobs;
create or replace function public.set_finished_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('completed', 'failed') then
    new.finished_at := coalesce(new.finished_at, now());
  elsif new.status = 'processing' then
    new.finished_at := null;
  end if;
  return new;
end;
$$;

create trigger ai_ingestion_jobs_finished_at
  before update on public.ai_ingestion_jobs
  for each row
  execute function public.set_finished_at_timestamp();

create or replace function public.match_ai_document_chunks(
  query_embedding vector(1536),
  match_count int default 5,
  match_threshold double precision default 0.68,
  filter_org uuid default null
)
returns table (
  document_id uuid,
  chunk_id uuid,
  content text,
  similarity double precision,
  title text,
  source_type text,
  source_uri text,
  metadata jsonb
)
language sql
stable
as $$
  select
    d.id as document_id,
    c.id as chunk_id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity,
    d.title,
    d.source_type,
    d.source_uri,
    d.metadata
  from public.ai_document_chunks c
  join public.ai_documents d on d.id = c.document_id
  where (filter_org is null or d.org_id = filter_org)
    and 1 - (c.embedding <=> query_embedding) >= match_threshold
  order by c.embedding <=> query_embedding asc
  limit match_count;
$$;

grant select, insert, update, delete on public.ai_documents to authenticated;
grant select, insert, update, delete on public.ai_document_chunks to authenticated;
grant select, insert, update, delete on public.ai_ingestion_jobs to authenticated;
grant select, insert, update, delete on public.ai_reindex_events to authenticated;
grant all on all tables in schema public to service_role;

grant execute on function public.match_ai_document_chunks(vector, int, double precision, uuid) to authenticated;

grant usage on schema public to authenticated;

comment on table public.ai_documents is 'Source documents tracked for AI embeddings (RAG)';
comment on table public.ai_document_chunks is 'Chunked embeddings stored in pgvector for semantic retrieval';
comment on table public.ai_ingestion_jobs is 'Job log for AI document ingestion and embedding generation';
comment on table public.ai_reindex_events is 'Audit trail for AI embedding reindex operations';
comment on function public.match_ai_document_chunks(vector, int, double precision, uuid) is 'Similarity search helper for AI agent knowledge retrieval';
