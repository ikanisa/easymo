# Quickstart

This guide walks through setting up Supabase, configuring environment variables, and running the admin app.

## 1) Prerequisites

- Node 18.18+ and `pnpm` v8+
- Supabase CLI (`brew install supabase/tap/supabase` on macOS)
- Access to a Supabase project (local stack or remote)

## 2) Install dependencies

```bash
pnpm install
```

## 3) Configure environment variables

1. Copy `.env.example` to `.env` (shared Node config) and `.env.local` (Next.js browser/runtime config).
2. Fill in the Supabase values from your project:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser anon key only)
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (tooling mirror of the public values)
   - `VITE_SUPABASE_PROJECT_ID` (project ref, e.g., `vacltfdslodqybxojytc`)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
   - `EASYMO_ADMIN_TOKEN` (shared secret required by Edge Functions)
   - `ADMIN_SESSION_SECRET` (16+ chars for cookies)

## 4) Start Supabase

**Local stack**

```bash
supabase start
supabase db reset
supabase db seed --file supabase/seeders/phase2_seed.sql
```

**Remote project**

```bash
supabase link --project-ref <project-ref>
supabase db pull
pnpm functions:deploy          # core admin functions
pnpm functions:deploy:agents   # agent helpers
```

## 5) Run the app

```bash
# Development
pnpm dev

# Production build + serve
pnpm build
pnpm start
```

Visit http://localhost:3000/login after the server starts.

## 6) Helpful scripts

- Netlify/CI build: `pnpm netlify:build`
- Supabase connection smoke test: `pnpm diagnostics:supabase [table_name]`
- Reset local DB: `supabase db reset && supabase db seed --file supabase/seeders/phase2_seed.sql`
