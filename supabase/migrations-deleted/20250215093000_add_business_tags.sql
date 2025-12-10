alter table public.businesses
  add column if not exists tags text[] default '{}'::text[];
