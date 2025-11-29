-- Enable pgvector extension
create extension if not exists vector;

-- Create documents table with vector embeddings
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  metadata jsonb,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create index for similarity search
create index if not exists documents_embedding_idx 
on documents using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Create function for similarity search
create or replace function match_documents(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Create updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_documents_updated_at
before update on documents
for each row
execute function update_updated_at_column();

-- Grant permissions (adjust as needed)
grant usage on schema public to anon, authenticated;
grant all on documents to anon, authenticated;
grant execute on function match_documents to anon, authenticated;
