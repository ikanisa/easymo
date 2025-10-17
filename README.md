# easymo

This repo follows a standard blueprint to help our Dev Agent (Codex-style) work
better.

- `app/` – app code
- `packages/` – shared libs
- `supabase/` – database, migrations, seeds
- `agent/` – Dev Agent tools + policies
- `.github/workflows/` – CI jobs
- `docs/` – decisions & notes

See `docs/maintenance/refactor-roadmap.md` for the staged cleanup plan that
guides go-live hardening efforts.

## Phase-2 Supabase Integration

The Vite admin panel now calls Supabase directly via the service client defined
in `src/lib/adapter.real.ts`. The adapter issues SQL queries and RPC calls for
settings, users, trips, subscriptions and simulator flows – the legacy REST shim
has been removed.

### Local setup

1. Apply the mobility schema and RLS policies:
   ```bash
   supabase db reset --schema public \
     --file easymo/supabase/migrations/20251112090000_phase2_mobility_core.sql \
     --file easymo/supabase/migrations/20251112091000_phase2_mobility_rls.sql
   ```
2. Seed fixtures for simulator testing:
   ```bash
   supabase db remote commit --file easymo/supabase/seed/fixtures/phase_b_seed.sql
   ```
3. Copy `docs/env/env.sample` to `.env.local` and populate the Supabase,
   WhatsApp, simulator and monitoring secrets.
4. Run the app with `npm run dev`.

### Required environment

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_SERVICE_ROLE_KEY` (injected only into trusted admin builds)
- `SIMULATOR_DEFAULT_RADIUS_KM` / `SIMULATOR_MAX_RESULTS`
- `ADMIN_TOKEN` for securing the Supabase edge functions

### Tests

- `npm test` runs the Vitest suite, including adapter coverage.
- `npm run test:functions` executes Deno-based integration tests for the new
  edge functions (admin settings + simulator flows).
