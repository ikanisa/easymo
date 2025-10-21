# Changelog

All notable changes to this repository are documented here.

## 2025-10-21 – Supabase consolidation

- Breaking: Consolidated duplicate Supabase trees. The canonical tree is now `supabase/`.
  - Removed the deprecated mirror at `easymo/supabase/`.
  - Moved tests, migrations, and seeds to `supabase/` equivalents:
    - `supabase/functions/tests/*`
    - `supabase/migrations/20251112090000_phase2_mobility_core.sql`
    - `supabase/migrations/20251112091000_phase2_mobility_rls.sql`
    - `supabase/seed/fixtures/phase_b_seed.sql`
- Updated scripts and docs to reference canonical paths:
  - `tools/deploy_supabase_functions.sh` discovers only `supabase/functions/*`.
  - `docs/runbook.md` migration/seed commands now use `supabase/*` paths.
  - `package.json` test script now runs Deno tests from `supabase/functions/tests`.
- CI/openapi: Added OpenAPI lint workflow and published spec copies under `apispec/`, `admin-app/public/openapi.yaml`, and `public/openapi.yaml`.

Migration notes
- Update any local scripts or docs that referenced `easymo/supabase/*` to `supabase/*`.
- Optional validation:
  - Apply migrations: `supabase db push` (or per-file if needed).
  - Deploy functions: `supabase functions deploy <fn> --project-ref <ref>`.
  - Run function tests: `pnpm test:functions`.

