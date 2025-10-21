# PR Summary: Supabase Consolidation

This change consolidates the duplicate Supabase directory structure into a single, canonical tree under `supabase/`.

Summary
- Remove deprecated mirror at `easymo/supabase/`.
- Keep canonical structure under `supabase/` for all Edge Functions, migrations, and seeds.
- Copy over missing items from the deprecated tree:
  - Tests: `supabase/functions/tests/*`
  - Migrations: `20251112090000_phase2_mobility_core.sql`, `20251112091000_phase2_mobility_rls.sql`
  - Seed: `supabase/seed/fixtures/phase_b_seed.sql`
- Update references in scripts/docs:
  - `tools/deploy_supabase_functions.sh` discovers only `supabase/functions/*`.
  - `docs/runbook.md` references canonical paths.
  - `package.json` test script now runs Deno tests from `supabase/functions/tests`.

Rationale
- Avoid drift between two directories and reduce confusion for contributors.
- Simplify deployments and runbooks by standardising on a single tree.
- Keep history clean; deprecated paths removed after content was migrated.

Impact
- Breaking for local scripts referencing `easymo/supabase/*`. Update paths to `supabase/*`.
- CI unaffected; OpenAPI lint workflow added previously.

Upgrade instructions
1. Update local scripts to use canonical paths:
   - Functions: `supabase/functions/*`
   - Migrations: `supabase/migrations/*`
   - Seeds: `supabase/seed/fixtures/*`
2. Validate in your environment:
   - `supabase db push`
   - `supabase functions deploy <fn> --project-ref <ref>`
   - `pnpm test:functions`

Notes
- Migration hygiene warnings remain non-blocking and unchanged.

